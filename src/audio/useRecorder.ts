import { useCallback, useEffect, useRef, useState } from 'react'

import { HOP_SECONDS } from 'earshot'
import type { GuardReason } from 'earshot'

import { listen } from './engine.ts'
import type { GuardedWindow, Listening } from './engine.ts'

export interface RecorderState {
  readonly recording: boolean
  /** Seconds of audio captured so far, guarded or not. */
  readonly elapsedSeconds: number
  /** Seconds that survived the guards — what enrollment progress counts. */
  readonly cleanSeconds: number
  /** Level of the most recent window, in dBFS; null before the first one. */
  readonly levelDbfs: number | null
  /** Why the most recent window was rejected, if it was. */
  readonly rejectedFor: readonly GuardReason[]
  /** Constraints the browser kept on despite being asked to turn them off. */
  readonly unhonouredConstraints: readonly string[]
  readonly error: string | null
}

const IDLE: RecorderState = {
  recording: false,
  elapsedSeconds: 0,
  cleanSeconds: 0,
  levelDbfs: null,
  rejectedFor: [],
  unhonouredConstraints: [],
  error: null,
}

export interface Recorder extends RecorderState {
  start: () => void
  stop: () => void
}

/**
 * Drives one recording session.
 *
 * Windows arrive roughly every `HOP_SECONDS`; each one updates the live meters
 * and is accumulated. `onFinished` is called once with everything captured,
 * whether the session was stopped by the user or by `maxSeconds`.
 */
export function useRecorder({
  maxSeconds,
  onFinished,
}: {
  /** Stop automatically after this many seconds. Omit to run until stopped. */
  readonly maxSeconds?: number
  readonly onFinished: (windows: readonly GuardedWindow[]) => void
}): Recorder {
  const [state, setState] = useState<RecorderState>(IDLE)
  const session = useRef<Listening | null>(null)
  const finishing = useRef(false)
  const onFinishedRef = useRef(onFinished)

  // Kept in a ref so `stop` stays stable: a recording must not restart because
  // the caller re-created its callback. Assigned in an effect, never in render.
  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  const stop = useCallback(() => {
    const active = session.current
    if (active === null || finishing.current) return
    finishing.current = true
    session.current = null
    void active.stop().then((windows) => {
      finishing.current = false
      setState((previous) => ({ ...previous, recording: false, levelDbfs: null }))
      onFinishedRef.current(windows)
    })
  }, [])

  const start = useCallback(() => {
    if (session.current !== null) return
    setState({ ...IDLE, recording: true })

    void listen((result) => {
      setState((previous) => {
        const next = {
          ...previous,
          elapsedSeconds: result.window.t,
          // Windows overlap by half, so each accepted one adds a hop of
          // genuinely new audio, not a whole window.
          cleanSeconds: result.guard.accepted
            ? previous.cleanSeconds + HOP_SECONDS
            : previous.cleanSeconds,
          levelDbfs: result.window.rmsDbfs,
          rejectedFor: result.guard.reasons,
        }
        return next
      })
    })
      .then((active) => {
        session.current = active
        setState((previous) => ({
          ...previous,
          unhonouredConstraints: active.appliedConstraints.unhonoured,
        }))
      })
      .catch((error: unknown) => {
        setState({
          ...IDLE,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }, [])

  const limit = maxSeconds
  useEffect(() => {
    if (limit === undefined) return
    if (!state.recording) return
    if (state.elapsedSeconds < limit) return
    stop()
  }, [limit, state.recording, state.elapsedSeconds, stop])

  // A navigation away from the screen must not leave the microphone open.
  useEffect(
    () => () => {
      void session.current?.stop()
      session.current = null
    },
    [],
  )

  return { ...state, start, stop }
}
