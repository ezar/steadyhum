import { useCallback, useEffect, useRef, useState } from 'react'

import { createStreamScorer, HOP_SECONDS } from 'earshot'
import type { Status, StreamScorer } from 'earshot'

import { db } from '@/db/index.ts'
import { getActiveProfile } from '@/db/repo.ts'
import type { WatchSegment } from '@/db/schema.ts'
import { newId, nowIso } from '@/lib/id.ts'
import { createSegmentTracker } from '@/lib/watchSegments.ts'
import type { OpenSegment, SegmentTracker } from '@/lib/watchSegments.ts'
import { createTimeline } from '@/lib/watchTimeline.ts'
import type { Timeline, TimelinePoint } from '@/lib/watchTimeline.ts'
import { listen } from './engine.ts'
import type { Listening } from './engine.ts'

export type { TimelinePoint }

export interface WatchState {
  readonly watching: boolean
  readonly elapsedSeconds: number
  readonly smoothed: number
  readonly status: Status
  readonly drifting: boolean
  readonly levelDbfs: number | null
  readonly timeline: readonly TimelinePoint[]
  readonly segments: readonly OpenSegment[]
  /** True while the screen is actually being held awake, moment to moment. */
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
  released: boolean
}

/** Everything `persist` needs, held outside React so unmount can still save. */
interface SessionRecord {
  id: string
  startedAt: string
  segments: OpenSegment[]
  total: number
  clean: number
  discarded: number
  /** A write is in flight; a second caller must not start another. */
  saving: boolean
  /** The write landed. Only then is it safe to stop trying. */
  saved: boolean
}

/**
 * Runs a watch session: continuous listening, scored as it goes.
 *
 * Unlike a check, nothing is scored at the end — there is no end until the user
 * says so. Each window is scored on arrival by earshot's stream scorer, which
 * smooths out the lorry driving past and separately watches for drift, the slow
 * rise no single window would ever flag.
 *
 * Windows are deliberately not retained: at a 1024-number embedding each, a two
 * hour session would hold about fifteen thousand of them for no reader. What is
 * kept is the segment log — the episodes — and the timeline, bounded by
 * construction.
 *
 * The session's own record lives in a ref rather than in React state, because
 * the two moments that must persist it — the stop button and unmounting — both
 * happen when reading state is unreliable or too late.
 */
export function useWatch(applianceId: string): Watcher {
  const [state, setState] = useState<WatchState>(IDLE)
  const session = useRef<Listening | null>(null)
  const scorer = useRef<StreamScorer | null>(null)
  const tracker = useRef<SegmentTracker | null>(null)
  const record = useRef<SessionRecord | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const timeline = useRef<Timeline | null>(null)
  /**
   * Bumped by every start and every stop.
   *
   * Starting takes seconds — loading models, then the microphone prompt — and
   * `stop()` or a navigation can land in the middle of it. Comparing the token
   * after each await is what lets a session that nobody wants any more shut
   * itself down instead of leaving the microphone open for the life of the tab.
   */
  const token = useRef(0)

  const persist = useCallback(async (): Promise<void> => {
    const current = record.current
    if (current === null || current.saving || current.saved) return
    /*
     * A session that heard nothing is not a session.
     *
     * Backing out while the engine is still loading is the common way to get
     * here, and a row of zeroes in the history says something happened when
     * nothing did.
     */
    if (current.total === 0) {
      current.saved = true
      return
    }
    // `saving` stops the second caller — stopping and then unmounting — from
    // inserting the same session twice. `saved` is only set once the write has
    // actually landed, so a failed transaction can still be retried on unmount
    // rather than silently losing the session.
    current.saving = true

    const rows: WatchSegment[] = current.segments.map((segment) => ({
      id: newId(),
      sessionId: current.id,
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
        id: current.id,
        applianceId,
        kind: 'watch',
        startedAt: current.startedAt,
        endedAt: nowIso(),
        // Windows overlap by half, so each accepted one is a hop of genuinely
        // new audio — not a whole window, and certainly not one second.
        cleanSeconds: current.clean * HOP_SECONDS,
        totalWindows: current.total,
        discardedWindows: current.discarded,
        statesDiscovered: null,
      })
      if (rows.length > 0) await db.watchSegments.bulkAdd(rows)
    })
    current.saved = true
    current.saving = false
  }, [applianceId])

  const releaseWakeLock = useCallback(() => {
    const held = wakeLock.current
    wakeLock.current = null
    if (held !== null) void held.release().catch(() => undefined)
  }, [])

  /**
   * Ask the screen to stay awake, best effort.
   *
   * A session left on the worktop is useless if the phone sleeps and suspends
   * the audio graph. The lock is dropped by the browser whenever the page is
   * hidden and is not restored on its own, so this is called again when the
   * page comes back rather than assuming the first grant still holds.
   */
  const acquireWakeLock = useCallback(async (): Promise<void> => {
    if (wakeLock.current !== null && !wakeLock.current.released) return
    const api = (navigator as { wakeLock?: { request: (kind: string) => Promise<unknown> } })
      .wakeLock
    if (api === undefined) {
      setState((previous) => ({ ...previous, screenHeldAwake: false }))
      return
    }
    try {
      wakeLock.current = (await api.request('screen')) as WakeLockSentinel
      setState((previous) => ({ ...previous, screenHeldAwake: true }))
    } catch {
      // Refused, or the page was not visible. Watching still works.
      wakeLock.current = null
      setState((previous) => ({ ...previous, screenHeldAwake: false }))
    }
  }, [])

  const finish = useCallback((): void => {
    token.current += 1
    const active = session.current
    session.current = null
    releaseWakeLock()

    const last = tracker.current?.finish() ?? null
    if (last !== null) record.current?.segments.push(last)
    const segments = [...(record.current?.segments ?? [])]

    // Persist first, and never from inside a state updater: React may run an
    // updater twice, and a duplicate insert would reject on the primary key.
    void persist().catch((error: unknown) => {
      console.error('could not save the watch session', error)
    })

    const stopping = active?.stop() ?? Promise.resolve([])
    void stopping
      .catch((error: unknown) => {
        // Whatever happened to the microphone, the session is over as far as
        // the screen is concerned; leaving it "watching" strands the user with
        // a dead Stop button.
        console.error('could not stop the microphone cleanly', error)
      })
      .finally(() => {
        setState((previous) => ({
          ...previous,
          watching: false,
          segments,
          levelDbfs: null,
          screenHeldAwake: false,
        }))
      })
  }, [persist, releaseWakeLock])

  const start = useCallback(() => {
    if (session.current !== null) return
    const mine = (token.current += 1)

    setState({ ...IDLE, watching: true })
    record.current = {
      id: newId(),
      startedAt: nowIso(),
      segments: [],
      total: 0,
      clean: 0,
      discarded: 0,
      saving: false,
      saved: false,
    }

    void (async () => {
      const stored = await getActiveProfile(applianceId)
      if (token.current !== mine) return
      if (stored === null) throw new Error('no active profile')

      scorer.current = createStreamScorer(stored.profile)
      tracker.current = createSegmentTracker()
      timeline.current = createTimeline()
      await acquireWakeLock()
      if (token.current !== mine) {
        releaseWakeLock()
        return
      }

      const active = await listen(
        (result) => {
          const engine = scorer.current
          const segmenter = tracker.current
          const strip = timeline.current
          const current = record.current
          if (engine === null || segmenter === null || strip === null || current === null) return

          current.total += 1
          if (result.guard.accepted) current.clean += 1
          else current.discarded += 1

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
          if (closed !== null) current.segments.push(closed)
          const segments = [...current.segments]
          const points = strip.push({
            seconds: result.window.t,
            smoothed: update.smoothed,
            status: update.status,
          })

          setState((previous) => ({
            ...previous,
            elapsedSeconds: result.window.t,
            smoothed: update.smoothed,
            status: update.status,
            drifting: update.drift.drifting,
            levelDbfs: result.window.rmsDbfs,
            timeline: points,
            segments,
          }))
        },
        { retainWindows: false },
      )

      // Stopped or navigated away while the engine was still starting: shut the
      // microphone down rather than leaving it open with nobody listening.
      if (token.current !== mine) {
        void active.stop()
        releaseWakeLock()
        return
      }
      session.current = active
    })().catch((error: unknown) => {
      releaseWakeLock()
      /*
       * Clear the record. A start that never produced a window has nothing to
       * save, and leaving it behind made the retry button a no-op: every click
       * bounced off the "a session is already in progress" guard, so the only
       * way to try again after denying the microphone was to leave the screen
       * and come back.
       */
      record.current = null
      timeline.current = null
      // The screen shows its own sentence; this is for whoever is debugging.
      console.error('watch session failed to start', error)
      setState({ ...IDLE, error: error instanceof Error ? error.message : String(error) })
    })
  }, [acquireWakeLock, applianceId, releaseWakeLock])

  // The browser drops the wake lock whenever the page is hidden, and does not
  // give it back. Without this the screen quietly stops being held awake while
  // the UI still promises that it is.
  useEffect(() => {
    if (!state.watching) return
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void acquireWakeLock()
      else setState((previous) => ({ ...previous, screenHeldAwake: false }))
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [acquireWakeLock, state.watching])

  /*
   * Leaving the screen ends the session rather than discarding it.
   *
   * Backing out of an hour of watching used to close the microphone and throw
   * away the session row and every episode with it.
   */
  useEffect(
    () => () => {
      token.current += 1
      const active = session.current
      session.current = null

      const last = tracker.current?.finish() ?? null
      if (last !== null) record.current?.segments.push(last)
      void persist().catch((error: unknown) => {
        console.error('could not save the watch session', error)
      })

      void active?.stop().catch(() => undefined)
      const held = wakeLock.current
      wakeLock.current = null
      if (held !== null) void held.release().catch(() => undefined)
    },
    [persist],
  )

  return { ...state, start, stop: finish }
}
