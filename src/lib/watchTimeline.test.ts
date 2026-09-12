import { describe, expect, it } from 'vitest'

import { createTimeline, TIMELINE_POINTS } from './watchTimeline.ts'
import type { TimelinePoint } from './watchTimeline.ts'

function point(
  seconds: number,
  smoothed = 0.1,
  status: TimelinePoint['status'] = 'normal',
): TimelinePoint {
  return { seconds, smoothed, status }
}

/** Feed `count` quiet windows, with `spike` dropped in at `spikeAt`. */
function run(count: number, spikeAt?: number, spike?: TimelinePoint): readonly TimelinePoint[] {
  const timeline = createTimeline()
  for (let index = 0; index < count; index += 1) {
    timeline.push(index === spikeAt && spike !== undefined ? spike : point(index))
  }
  return timeline.points
}

/** Distance between consecutive bucket starts. */
function gaps(points: readonly TimelinePoint[]): number[] {
  return points
    .slice(1)
    .map((entry, index) => entry.seconds - (points[index] as TimelinePoint).seconds)
}

describe('createTimeline', () => {
  it('keeps every window until the cap', () => {
    expect(run(TIMELINE_POINTS)).toHaveLength(TIMELINE_POINTS)
  })

  it('never grows past the cap, however long the session runs', () => {
    for (const count of [TIMELINE_POINTS + 1, TIMELINE_POINTS * 4, 15_000]) {
      expect(run(count).length).toBeLessThanOrEqual(TIMELINE_POINTS)
    }
  })

  it('keeps every bucket the same width', () => {
    // The strip draws each bucket at equal width, so unequal buckets put events
    // at the wrong place. Halving the whole array on overflow — merging old
    // merged buckets with brand-new single points — produced a first bar
    // covering 93% of a two hour session and a last bar covering one window.
    for (const count of [1000, 5000, 15_000]) {
      const spacing = gaps(run(count))
      expect(new Set(spacing).size, `uneven buckets at ${count} windows`).toBe(1)
    }
  })

  it('spans the whole session, not just the recent part', () => {
    const points = run(15_000)
    expect(points[0]?.seconds).toBe(0)
    // The last bucket starts within one stride of the end.
    const stride = gaps(points)[0] as number
    expect((points.at(-1)?.seconds ?? 0) + stride).toBeGreaterThanOrEqual(14_999)
  })

  it('keeps a one-off spike alive through many halvings', () => {
    const spike = point(7, 0.95, 'anomalous')
    const points = run(15_000, 7, spike)
    expect(points.some((entry) => entry.smoothed === 0.95)).toBe(true)
    expect(points.some((entry) => entry.status === 'anomalous')).toBe(true)
  })

  it('carries the worse status of the windows a bucket covers', () => {
    const points = run(TIMELINE_POINTS * 2 + 2, 3, point(3, 0.4, 'watch'))
    expect(points.some((entry) => entry.status === 'watch')).toBe(true)
  })

  it('stays in chronological order', () => {
    const seconds = run(5000).map((entry) => entry.seconds)
    expect([...seconds].sort((a, b) => a - b)).toEqual(seconds)
  })

  it('doubles the stride rather than dropping the oldest windows', () => {
    const timeline = createTimeline()
    for (let index = 0; index < TIMELINE_POINTS; index += 1) timeline.push(point(index))
    expect(timeline.stride).toBe(1)

    for (let index = TIMELINE_POINTS; index < TIMELINE_POINTS * 2 + 2; index += 1) {
      timeline.push(point(index))
    }
    expect(timeline.stride).toBeGreaterThan(1)
    expect(timeline.points[0]?.seconds).toBe(0)
  })
})
