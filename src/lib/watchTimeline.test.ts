import { describe, expect, it } from 'vitest'

import { appendPoint, TIMELINE_POINTS } from './watchTimeline.ts'
import type { TimelinePoint } from './watchTimeline.ts'

function point(seconds: number, smoothed = 0.1, status: TimelinePoint['status'] = 'normal') {
  return { seconds, smoothed, status }
}

/** Feed `count` quiet points, with `spike` dropped in at `spikeAt`. */
function run(count: number, spikeAt?: number, spike?: TimelinePoint): readonly TimelinePoint[] {
  let timeline: readonly TimelinePoint[] = []
  for (let index = 0; index < count; index += 1) {
    timeline = appendPoint(
      timeline,
      index === spikeAt && spike !== undefined ? spike : point(index),
    )
  }
  return timeline
}

describe('appendPoint', () => {
  it('keeps every point until the cap', () => {
    expect(run(TIMELINE_POINTS)).toHaveLength(TIMELINE_POINTS)
  })

  it('never grows past the cap, however long the session runs', () => {
    for (const count of [TIMELINE_POINTS + 1, TIMELINE_POINTS * 4, 5000]) {
      expect(run(count).length).toBeLessThanOrEqual(TIMELINE_POINTS)
    }
  })

  it('keeps a one-off spike alive through many halvings', () => {
    // The whole point of watching is catching the moment something happened.
    // Dropping alternate points to make room deletes exactly that, which is
    // what the first version of this did.
    const spike = point(7, 0.95, 'anomalous')
    const timeline = run(5000, 7, spike)

    expect(timeline.some((entry) => entry.smoothed === 0.95)).toBe(true)
    expect(timeline.some((entry) => entry.status === 'anomalous')).toBe(true)
  })

  it('carries the worse status of the pair it merges', () => {
    const spike = point(3, 0.4, 'watch')
    const timeline = run(TIMELINE_POINTS * 2 + 2, 3, spike)
    expect(timeline.some((entry) => entry.status === 'watch')).toBe(true)
  })

  it('keeps the timeline in chronological order', () => {
    const timeline = run(2000)
    const seconds = timeline.map((entry) => entry.seconds)
    expect([...seconds].sort((a, b) => a - b)).toEqual(seconds)
  })

  it('still spans the whole session after halving, not just the recent part', () => {
    // Dropping the oldest points instead would turn the strip into a moving
    // window, scrolling the episode you want to look at off the left edge.
    const timeline = run(2000)
    expect(timeline[0]?.seconds).toBe(0)
    expect(timeline.at(-1)?.seconds).toBe(1999)
  })
})
