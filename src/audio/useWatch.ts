import { useCallback, useEffect, useRef, useState } from 'react'

import { createStreamScorer } from 'earshot'
import type { Status, StreamScorer } from 'earshot'

import { db } from '@/db/index.ts'
import { getActiveProfile } from '@/db/repo.ts'
import type { WatchSegment } from '@/db/schema.ts'
import { newId, nowIso } from '@/lib/id.ts'
import { createSegmentTracker } from '@/lib/watchSegments.ts'
import type { OpenSegment } from '@/lib/watchSegments.ts'
import { listen } from './engine.ts'
import type { Listening } from './engine.ts'

/**
 * How many points the timeline keeps.
 *
 * A watch session can run for hours. Rather than grow without bound, the
 * history halves its resolution each time it fills: the strip always spans the
 * whole session, and the memory it costs is fixed.
 */
const TIMELINE_POINTS = 240

export interface TimelinePoint {
  readonly seconds: number
  readonly smoothed: number
  readonly status: Status
}

export interface WatchState {
  readonly watching: boolean
  readonly elapsedSeconds: number
  readonly smoothed: number
  readonly status: Status
  readonly drifting: boolean
  readonly levelDbfs: number | null
  readonly timeline: readonly TimelinePoint[]
  readonly segments: readonly OpenSegment[]
  /** True while the screen is being held awake. */
  readonly screenHeldAwake: boolean
  readonly error: string | null
}

const IDLE: WatchState = {
  watching: false,
  elapsedSeconds: 0,
  smoothed: 0,
  status: 'normal',
  drifting: false,
  levelDbfs: null,
  timeline: [],
  segments: [],
  screenHeldAwake: false,
  error: null,
}

export interface Watcher extends WatchState {
  start: () => void
  stop: () => void
}

/** Minimal shape of the Screen Wake Lock API, which TypeScript types optimistically. */
interface WakeLockSentinel {
  release: () => Promise<void>
}

/**
 * Runs a watch session: continuous listening, scored as it goes.
 *
 * Unlike a check, nothing is scored at the end — there is no end until the
 * user says so. Each window is scored on arrival by earshot's stream scorer,
 * which smooths out the lorry driving past and separately watches for drift,
 * the slow rise no single window would ever flag.
 *
 * Windows are deliberately not retained: at a 1024-number embedding each, a
 * two hour session would hold about fifteen thousand of them for no reader.
 * What is kept is the segment log — the episodes — and the timeline, which is
 * bounded by construction.
 */
export function useWatch(applianceId: string): Watcher {
  const [state, setState] = useState<WatchState>(IDLE)
  const session = useRef<Listening | null>(null)
  const scorer = useRef<StreamScorer | null>(null)
  const tracker = useRef<ReturnType<typeof createSegmentTracker> | null>(null)
  const sessionId = useRef<string | null>(null)
  const startedAt = useRef<string | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const counts = useRef({ total: 0, discarded: 0, clean: 0 })
  /** Seconds each timeline point currently represents; doubles as it fills. */
  const timelineStride = useRef(1)

  const persist = useCallback(
    async (segments: readonly OpenSegment[]): Promise<void> => {
      const id = sessionId.current
      if (id === null) return
      const rows: WatchSegment[] = segments.map((segment) => ({
        id: newId(),
        sessionId: id,
        applianceId,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        peakScore: segment.peakScore,
        status: segment.status,
        dominantStateId: segment.dominantStateId,
        fromDrift: segment.fromDrift,
        createdAt: nowIso(),
      }))
      await db.transaction('rw', [db.sessions, db.watchSegments], async () => {
        await db.sessions.add({
          id,
          applianceId,
          kind: 'watch',
          startedAt: startedAt.current ?? nowIso(),
          endedAt: nowIso(),
          cleanSeconds: counts.current.clean,
          totalWindows: counts.current.total,
          discardedWindows: counts.current.discarded,
          statesDiscovered: null,
        })
        if (rows.length > 0) await db.watchSegments.bulkAdd(rows)
      })
    },
    [applianceId],
  )

  const releaseWakeLock = useCallback(() => {
    const held = wakeLock.current
    wakeLock.current = null
    if (held !== null) void held.release().catch(() => undefined)
    setState((previous) => ({ ...previous, screenHeldAwake: false }))
  }, [])

  const stop = useCallback(() => {
    const active = session.current
    if (active === null) return
    session.current = null
    releaseWakeLock()

    const last = tracker.current?.finish() ?? null
    void active.stop().then(() => {
      setState((previous) => {
        const segments = last === null ? previous.segments : [...previous.segments, last]
        void persist(segments)
        return { ...previous, watching: false, segments, levelDbfs: null }
      })
    })
  }, [persist, releaseWakeLock])

  const start = useCallback(() => {
    if (session.current !== null) return
    setState({ ...IDLE, watching: true })
    counts.current = { total: 0, discarded: 0, clean: 0 }
    timelineStride.current = 1
    sessionId.current = newId()
    startedAt.current = nowIso()

    void (async () => {
      const stored = await getActiveProfile(applianceId)
      if (stored === null) throw new Error('no active profile')
      scorer.current = createStreamScorer(stored.profile)
      tracker.current = createSegmentTracker()

      /*
       * Ask the screen to stay awake. A watch session the user starts and puts
       * on the worktop is useless if the phone sleeps and suspends the audio
       * graph a minute later. Not every browser has this, and it can be
       * refused, so it is best-effort and the UI says which it got.
       */
      const wakeLockApi = (navigator as { wakeLock?: { request: (t: string) => Promise<unknown> } })
        .wakeLock
      if (wakeLockApi !== undefined) {
        try {
          wakeLock.current = (await wakeLockApi.request('screen')) as WakeLockSentinel
          setState((previous) => ({ ...previous, screenHeldAwake: true }))
        } catch {
          // Refused, or the page was not visible. Watching still works.
        }
      }

      const active = await listen(
        (result) => {
          const engine = scorer.current
          const segmenter = tracker.current
          if (engine === null || segmenter === null) return

          counts.current.total += 1
          if (result.guard.accepted) counts.current.clean += 1
          else counts.current.discarded += 1

          // A window the guards rejected is not evidence about the machine, so
          // it must not move the score. The timeline simply does not advance.
          if (!result.guard.accepted) {
            setState((previous) => ({
              ...previous,
              elapsedSeconds: result.window.t,
              levelDbfs: result.window.rmsDbfs,
            }))
            return
          }

          const update = engine.push(result.window)
          const closed = segmenter.push({
            seconds: result.window.t,
            smoothed: update.smoothed,
            status: update.status,
            dominantStateId: update.window.stateId,
            drifting: update.drift.drifting,
          })

          setState((previous) => ({
            ...previous,
            elapsedSeconds: result.window.t,
            smoothed: update.smoothed,
            status: update.status,
            drifting: update.drift.drifting,
            levelDbfs: result.window.rmsDbfs,
            timeline: appendPoint(
              previous.timeline,
              { seconds: result.window.t, smoothed: update.smoothed, status: update.status },
              timelineStride,
            ),
            segments: closed === null ? previous.segments : [...previous.segments, closed],
          }))
        },
        { retainWindows: false },
      )
      session.current = active
    })().catch((error: unknown) => {
      releaseWakeLock()
      // The screen shows its own sentence; this is for whoever is debugging.
      console.error('watch session failed to start', error)
      setState({ ...IDLE, error: error instanceof Error ? error.message : String(error) })
    })
  }, [applianceId, releaseWakeLock])

  // Leaving the screen must not leave the microphone open or the screen awake.
  useEffect(
    () => () => {
      void session.current?.stop()
      session.current = null
      const held = wakeLock.current
      wakeLock.current = null
      if (held !== null) void held.release().catch(() => undefined)
    },
    [],
  )

  return { ...state, start, stop }
}

/**
 * Append a point, halving the resolution rather than growing past the cap.
 *
 * Dropping the oldest points instead would make the strip a moving window, so
 * the hour you left it running would scroll off and the episode you want to
 * see with it.
 */
function appendPoint(
  timeline: readonly TimelinePoint[],
  point: TimelinePoint,
  stride: { current: number },
): readonly TimelinePoint[] {
  const next = [...timeline, point]
  if (next.length <= TIMELINE_POINTS) return next
  stride.current *= 2
  return next.filter((_, index) => index % 2 === 0)
}
