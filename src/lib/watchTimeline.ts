import type { Status } from 'earshot'

/** How many points the timeline keeps before halving its own resolution. */
export const TIMELINE_POINTS = 240

export interface TimelinePoint {
  readonly seconds: number
  readonly smoothed: number
  readonly status: Status
}

/**
 * Append a point, halving the resolution rather than growing past the cap.
 *
 * Each surviving point takes the *peak* of the pair it replaces, not whichever
 * happened to sit at an even index. Dropping alternate points deletes short
 * spikes outright, and a spike is exactly what a watch session exists to
 * catch — losing it to make room is the one thing this must not do.
 */
export function appendPoint(
  timeline: readonly TimelinePoint[],
  point: TimelinePoint,
): readonly TimelinePoint[] {
  const next = [...timeline, point]
  if (next.length <= TIMELINE_POINTS) return next

  const halved: TimelinePoint[] = []
  for (let index = 0; index < next.length; index += 2) {
    const first = next[index] as TimelinePoint
    const second = next[index + 1]
    halved.push(second === undefined ? first : worseOf(first, second))
  }
  return halved
}

const SEVERITY: Readonly<Record<Status, number>> = { normal: 0, watch: 1, anomalous: 2 }

/** The more alarming of two points, keeping the earlier timestamp. */
function worseOf(first: TimelinePoint, second: TimelinePoint): TimelinePoint {
  const status = SEVERITY[second.status] > SEVERITY[first.status] ? second.status : first.status
  return {
    seconds: first.seconds,
    smoothed: Math.max(first.smoothed, second.smoothed),
    status,
  }
}
