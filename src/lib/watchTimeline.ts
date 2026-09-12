import type { Status } from 'earshot'

/** How many buckets the timeline keeps before halving its own resolution. */
export const TIMELINE_POINTS = 240

export interface TimelinePoint {
  readonly seconds: number
  readonly smoothed: number
  readonly status: Status
}

export interface Timeline {
  /** Add one scored window; returns the strip to render. */
  push: (point: TimelinePoint) => readonly TimelinePoint[]
  /** The strip as it stands. */
  readonly points: readonly TimelinePoint[]
  /** How many windows each bucket currently spans. */
  readonly stride: number
}

/**
 * The session so far, as a fixed number of equal-width buckets.
 *
 * A watch session runs for hours, so the strip cannot grow with it. Two
 * properties have to survive that, and getting one without the other makes the
 * picture lie:
 *
 * - **Every bucket spans the same amount of time.** `WatchTimeline` draws each
 *   at equal width, so unequal buckets put events at the wrong place. Simply
 *   halving the whole array on overflow does exactly that: already-merged old
 *   buckets get merged again with brand-new single points, and after two hours
 *   the first bar covered 93% of the session while the last covered one window.
 * - **Peaks survive.** A bucket takes the highest score and worst status of the
 *   windows it covers, never whichever happened to land on an even index. A
 *   spike is the thing a watch session exists to catch; losing it to make room
 *   defeats the feature.
 *
 * So windows accumulate into the bucket being filled, and only when the strip
 * is full do buckets merge pairwise and the stride double — which keeps every
 * bucket the same width as every other.
 */
export function createTimeline(): Timeline {
  let points: TimelinePoint[] = []
  let stride = 1
  /** Windows pushed so far; the next one is window number `count`. */
  let count = 0

  return {
    push(point: TimelinePoint): readonly TimelinePoint[] {
      /*
       * Which bucket this window belongs in, derived rather than tracked.
       *
       * Bucket k always covers windows [k * stride, (k + 1) * stride), so the
       * arithmetic alone guarantees equal widths — there is no running counter
       * to get out of step after a halving. Halving preserves it: new bucket k
       * covers old buckets 2k and 2k+1, which is exactly [k * 2 * stride,
       * (k + 1) * 2 * stride).
       */
      const bucket = Math.floor(count / stride)
      count += 1

      const existing = points[bucket]
      points =
        existing === undefined
          ? [...points, point]
          : points.map((entry, index) => (index === bucket ? merge(entry, point) : entry))

      if (points.length > TIMELINE_POINTS) {
        const halved: TimelinePoint[] = []
        for (let index = 0; index < points.length; index += 2) {
          const first = points[index] as TimelinePoint
          const second = points[index + 1]
          halved.push(second === undefined ? first : merge(first, second))
        }
        points = halved
        stride *= 2
      }

      return points
    },
    get points(): readonly TimelinePoint[] {
      return points
    },
    get stride(): number {
      return stride
    },
  }
}

const SEVERITY: Readonly<Record<Status, number>> = { normal: 0, watch: 1, anomalous: 2 }

/** One bucket covering both, keeping the earlier start and the worse reading. */
function merge(first: TimelinePoint, second: TimelinePoint): TimelinePoint {
  return {
    seconds: first.seconds,
    smoothed: Math.max(first.smoothed, second.smoothed),
    status: SEVERITY[second.status] > SEVERITY[first.status] ? second.status : first.status,
  }
}
