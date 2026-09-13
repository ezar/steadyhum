import type { Status } from 'earshot'

/** What the tracker needs from one scored window. */
export interface WatchTick {
  /** Seconds since the session started. */
  readonly seconds: number
  /** Smoothed score in [0, 1]. */
  readonly smoothed: number
  /** Status of the smoothed score. */
  readonly status: Status
  readonly dominantStateId: string
  /** Whether the scorer currently considers the baseline to be drifting. */
  readonly drifting: boolean
}

/** A stretch of the session that sounded unlike normal, still open or closed. */
export interface OpenSegment {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly peakScore: number
  readonly status: Status
  /**
   * The learned state most of its windows matched.
   *
   * Counted, not carried over from the last window. A machine with several
   * states — a washing machine washes, drains and spins — can change state
   * partway through an episode, and this names the baseline the episode is
   * measured and described against. Naming whichever state it happened to end
   * in measures the whole episode against the wrong normal, and the result of
   * that is not a missing answer but a confident description of a difference
   * that was never there.
   */
  readonly dominantStateId: string
  readonly fromDrift: boolean
}

export interface SegmentTracker {
  /** Feed one scored window; returns a segment if this window closed one. */
  push: (tick: WatchTick) => OpenSegment | null
  /** The segment currently open, if any. */
  readonly open: OpenSegment | null
  /** Close whatever is open, at the end of the session. */
  finish: () => OpenSegment | null
}

/**
 * Whether this window is part of an episode.
 *
 * Exported because the caller has to agree with the tracker about it: the
 * windows kept to explain an episode are exactly the windows that opened and
 * sustained it, and a second copy of this rule would eventually describe a
 * different stretch of audio than the one the episode covers.
 *
 * Drift counts. Nothing sounds wrong in any single window of a slow climb,
 * which is the whole reason drift is tracked separately — so a rule that only
 * looked at `status` would hand `describeDifference` an empty set of windows
 * for precisely the episodes hardest to explain.
 */
export function isAbnormal(tick: WatchTick): boolean {
  return tick.status !== 'normal' || tick.drifting
}

/**
 * Collapses a stream of scored windows into episodes.
 *
 * An hour of watching is seven thousand scores, which is not something anyone
 * can read. What a person actually wants to know is "did anything happen, and
 * when" — so contiguous stretches above normal become one segment each.
 *
 * A segment survives short dips back to normal. Without that, a machine
 * hovering at the threshold produces a rash of one-window segments that look
 * like many separate events when they are one. `graceSeconds` is how long it
 * waits, in session time rather than window counts, so it stays meaningful if
 * the hop size ever changes.
 */
export function createSegmentTracker(graceSeconds = 5): SegmentTracker {
  let open: OpenSegment | null = null
  /** When the current segment last looked abnormal. Used for the grace period. */
  let lastAbnormalSeconds = 0
  /** How many of the open segment's windows matched each state. */
  let windowsPerState = new Map<string, number>()

  function close(): OpenSegment | null {
    if (open === null) return null
    const closed = open
    open = null
    return closed
  }

  return {
    push(tick: WatchTick): OpenSegment | null {
      if (isAbnormal(tick)) {
        lastAbnormalSeconds = tick.seconds
        if (open === null) windowsPerState = new Map()
        windowsPerState.set(
          tick.dominantStateId,
          (windowsPerState.get(tick.dominantStateId) ?? 0) + 1,
        )
        open =
          open === null
            ? {
                startSeconds: tick.seconds,
                endSeconds: tick.seconds,
                peakScore: tick.smoothed,
                status: tick.status,
                dominantStateId: tick.dominantStateId,
                fromDrift: tick.drifting && tick.status === 'normal',
              }
            : {
                ...open,
                endSeconds: tick.seconds,
                peakScore: Math.max(open.peakScore, tick.smoothed),
                // Report the worst it got, not the state it happened to end in.
                status: worse(open.status, tick.status),
                dominantStateId: dominant(windowsPerState),
                /*
                 * Drift is the claim "nothing sounds wrong, the baseline is
                 * climbing". The moment something does sound wrong the label
                 * stops being true, so it needs the same condition the segment
                 * was opened under, not just `drifting`.
                 */
                fromDrift: open.fromDrift && tick.drifting && tick.status === 'normal',
              }
        return null
      }

      if (open === null) return null
      // Normal again, but keep the segment open briefly: a machine sitting on
      // the threshold would otherwise produce a rash of one-window episodes.
      if (tick.seconds - lastAbnormalSeconds < graceSeconds) return null
      return close()
    },
    get open(): OpenSegment | null {
      return open
    },
    finish(): OpenSegment | null {
      return close()
    },
  }
}

const SEVERITY: Readonly<Record<Status, number>> = { normal: 0, watch: 1, anomalous: 2 }

function worse(a: Status, b: Status): Status {
  return SEVERITY[b] > SEVERITY[a] ? b : a
}

/** The state with the most windows; ties go to whichever was seen first. */
function dominant(windowsPerState: ReadonlyMap<string, number>): string {
  let best = ''
  let bestCount = -1
  for (const [stateId, count] of windowsPerState) {
    if (count > bestCount) {
      best = stateId
      bestCount = count
    }
  }
  return best
}
