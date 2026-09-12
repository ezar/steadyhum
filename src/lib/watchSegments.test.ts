import { describe, expect, it } from 'vitest'

import { createSegmentTracker } from './watchSegments.ts'
import type { WatchTick } from './watchSegments.ts'

function tick(seconds: number, overrides: Partial<WatchTick> = {}): WatchTick {
  return {
    seconds,
    smoothed: 0.1,
    status: 'normal',
    dominantStateId: 'state-1',
    drifting: false,
    ...overrides,
  }
}

const abnormal = (seconds: number, overrides: Partial<WatchTick> = {}): WatchTick =>
  tick(seconds, { status: 'anomalous', smoothed: 0.8, ...overrides })

describe('createSegmentTracker', () => {
  it('opens nothing while everything sounds normal', () => {
    const tracker = createSegmentTracker()
    for (const seconds of [0, 1, 2, 3]) expect(tracker.push(tick(seconds))).toBeNull()
    expect(tracker.open).toBeNull()
    expect(tracker.finish()).toBeNull()
  })

  it('collapses a contiguous stretch into one segment', () => {
    const tracker = createSegmentTracker()
    tracker.push(tick(0))
    for (const seconds of [1, 2, 3]) expect(tracker.push(abnormal(seconds))).toBeNull()

    // Closed only once the grace period has elapsed in normal audio.
    expect(tracker.push(tick(4))).toBeNull()
    const closed = tracker.push(tick(20))

    expect(closed).toEqual({
      startSeconds: 1,
      endSeconds: 3,
      peakScore: 0.8,
      status: 'anomalous',
      dominantStateId: 'state-1',
      fromDrift: false,
    })
  })

  it('rides out a dip rather than splitting one episode in two', () => {
    // A machine sitting on the threshold flickers. Without the grace period
    // this reads as several separate events, which is the wrong story.
    const tracker = createSegmentTracker(5)
    tracker.push(abnormal(10))
    expect(tracker.push(tick(11))).toBeNull()
    expect(tracker.push(abnormal(12))).toBeNull()

    const closed = tracker.finish()
    expect(closed?.startSeconds).toBe(10)
    expect(closed?.endSeconds).toBe(12)
  })

  it('splits genuinely separate episodes', () => {
    const tracker = createSegmentTracker(5)
    tracker.push(abnormal(10))
    const first = tracker.push(tick(30))
    expect(first?.startSeconds).toBe(10)

    tracker.push(abnormal(60))
    const second = tracker.finish()
    expect(second?.startSeconds).toBe(60)
  })

  it('reports the worst status reached, not the one it ended on', () => {
    const tracker = createSegmentTracker()
    tracker.push(tick(0, { status: 'watch', smoothed: 0.4 }))
    tracker.push(abnormal(1))
    tracker.push(tick(2, { status: 'watch', smoothed: 0.4 }))

    const closed = tracker.finish()
    expect(closed?.status).toBe('anomalous')
    expect(closed?.peakScore).toBe(0.8)
  })

  it('opens a segment on drift alone, while the status is still normal', () => {
    // Drift is the slow rise no single window would ever flag; missing it is
    // the whole reason the scorer tracks it separately.
    const tracker = createSegmentTracker()
    tracker.push(tick(0, { drifting: true }))
    expect(tracker.open?.fromDrift).toBe(true)
    expect(tracker.open?.status).toBe('normal')
  })

  it('stops calling it drift once the status itself goes bad', () => {
    const tracker = createSegmentTracker()
    tracker.push(tick(0, { drifting: true }))
    tracker.push(abnormal(1, { drifting: false }))
    expect(tracker.finish()?.fromDrift).toBe(false)
  })

  it('stops calling it drift even while the drift itself continues', () => {
    // The version of this test that flipped `drifting` to false passed against
    // a tracker that only checked `drifting` on extension, so it proved
    // nothing. Drift means "nothing sounds wrong, the baseline is climbing";
    // once something does sound wrong the label is simply untrue, whatever the
    // drift detector still says.
    const tracker = createSegmentTracker()
    tracker.push(tick(0, { drifting: true }))
    tracker.push(abnormal(1, { drifting: true }))
    const closed = tracker.finish()
    expect(closed?.fromDrift).toBe(false)
    expect(closed?.status).toBe('anomalous')
  })

  it('closes whatever is open when the session ends', () => {
    const tracker = createSegmentTracker()
    tracker.push(abnormal(5))
    const closed = tracker.finish()
    expect(closed?.startSeconds).toBe(5)
    // And nothing is left behind for a second call to hand out again.
    expect(tracker.finish()).toBeNull()
  })
})
