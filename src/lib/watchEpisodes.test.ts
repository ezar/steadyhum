import { beforeEach, describe, expect, it, vi } from 'vitest'

import { describeDifference } from 'earshot'
import type { Profile, Status, WindowResult } from 'earshot'
import type * as Earshot from 'earshot'

import { createEpisodeLog } from './watchEpisodes.ts'
import type { WatchTick } from './watchSegments.ts'

/**
 * The real `describeDifference`, behind a spy.
 *
 * Every test here wants its actual output; one wants to see what it was
 * handed, because the windows an episode is described from never appear in the
 * episode itself. Asserting on the episode instead — its size, its shape —
 * looks like a memory test and passes just as happily when whole embeddings
 * are being retained.
 */
vi.mock('earshot', async (importOriginal) => {
  const actual = await importOriginal<typeof Earshot>()
  return { ...actual, describeDifference: vi.fn(actual.describeDifference) }
})

/** The windows behind the most recent description. */
function describedWindows(): readonly WindowResult[] {
  const call = vi.mocked(describeDifference).mock.calls.at(-1)
  return call?.[2] ?? []
}

beforeEach(() => {
  vi.mocked(describeDifference).mockClear()
})

/**
 * A profile whose learned normal is a quiet, dull hum.
 *
 * Only `featureStats` matters here — `describeDifference` scores each feature
 * against the mean and spread of the matched state and ignores the rest of the
 * profile — so the spreads are set to 1 to make z-scores readable: a window at
 * `spectralCentroidHz` 406 is six standard deviations bright.
 */
function profile(): Profile {
  const stat = (mean: number) => ({
    mean,
    standardDeviation: 1,
    p05: mean - 2,
    p95: mean + 2,
  })
  return {
    schemaVersion: 1,
    revision: 1,
    featureSpace: 'embedding',
    dimensions: 1,
    states: [
      {
        id: 'state-0',
        model: { mean: [0], variance: [1] },
        distances: { mean: 0, standardDeviation: 1, p50: 0, p95: 1, p99: 2 },
        featureStats: {
          level: stat(-40),
          spectralCentroidHz: stat(400),
          spectralFlatness: stat(0.5),
          spectralFlux: stat(0.1),
          onsetPeriodicity: stat(0.1),
          amplitudeModulationHz: stat(5),
          amplitudeModulationDepth: stat(0.2),
          peakFrequencyHz: stat(100),
          peakProminenceDb: stat(3),
        },
        weight: 1,
      },
    ],
    thresholds: { watch: 0.4, anomalous: 0.7 },
    windowCount: 400,
    levelDbfs: stat(-40),
    calibrations: [],
  } as unknown as Profile
}

/** A window that sounds like the learned normal, unless nudged. */
function windowAt(seconds: number, overrides: Partial<Record<string, number>> = {}): WindowResult {
  const rmsDbfs = overrides['level'] ?? -40
  return {
    t: seconds,
    // Big, and exactly what the episode log is supposed to drop.
    embedding: Array.from({ length: 1024 }, () => 0.5),
    classes: [{ label: 'Hum', score: 0.9 }],
    rmsDbfs,
    features: {
      rmsDbfs,
      logMel: Array.from({ length: 64 }, () => -40),
      bands: [],
      peaks: [{ frequencyHz: overrides['peakFrequencyHz'] ?? 100, prominenceDb: 3 }],
      spectralFlatness: 0.5,
      spectralCentroidHz: overrides['spectralCentroidHz'] ?? 400,
      spectralFlux: 0.1,
      onsets: [],
      onsetPeriodicity: 0.1,
      onsetPeriodSeconds: 0,
      amplitudeModulationHz: 5,
      amplitudeModulationDepth: 0.2,
    },
  } as unknown as WindowResult
}

function tick(seconds: number, status: Status, drifting = false): WatchTick {
  return {
    seconds,
    smoothed: status === 'normal' ? 0.1 : status === 'watch' ? 0.5 : 0.9,
    status,
    dominantStateId: 'state-0',
    drifting,
  }
}

/** The z-score of `feature` among an episode's descriptors, or undefined. */
function z(
  descriptors: readonly { feature: string; zScore: number }[],
  feature: string,
): number | undefined {
  return descriptors.find((descriptor) => descriptor.feature === feature)?.zScore
}

describe('createEpisodeLog', () => {
  it('says nothing at all while the machine sounds normal', () => {
    const log = createEpisodeLog(profile())
    for (let index = 0; index < 50; index += 1) {
      expect(log.push(tick(index, 'normal'), windowAt(index))).toBeNull()
    }
    expect(log.finish()).toBeNull()
  })

  it('describes an episode from the windows inside it', () => {
    const log = createEpisodeLog(profile())
    // Ten seconds of a much brighter sound, then back to normal for long
    // enough to close the episode.
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 406 }))
    }
    let episode = null
    for (let index = 10; index < 30; index += 1) {
      episode ??= log.push(tick(index, 'normal'), windowAt(index))
    }

    expect(episode).not.toBeNull()
    expect(z(episode?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(6, 5)
  })

  it('leaves out the quiet windows it held the episode open through', () => {
    /*
     * The grace period keeps an episode open across a short dip so that one
     * event does not become a rash of one-window episodes. Those dip windows
     * sound like the machine's normal, so averaging them into the description
     * pulls every z-score towards zero — which does not look like a bug, it
     * looks like a milder finding, or like no finding at all.
     */
    const log = createEpisodeLog(profile())
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 406 }))
    }
    let episode = null
    for (let index = 10; index < 30; index += 1) {
      episode ??= log.push(tick(index, 'normal'), windowAt(index))
    }

    // Diluted by even the handful of grace windows, this would land near 4.
    expect(z(episode?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(6, 5)
  })

  it('starts each episode from a clean sample', () => {
    const log = createEpisodeLog(profile())

    // A first episode, six standard deviations bright.
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 406 }))
    }
    let first = null
    for (let index = 10; index < 30; index += 1) {
      first ??= log.push(tick(index, 'normal'), windowAt(index))
    }
    expect(z(first?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(6, 5)

    // A second, two standard deviations dull. If the first episode's windows
    // were still in the sample this would come out bright — describing the
    // wrong sound entirely, in a perfectly fluent sentence.
    for (let index = 30; index < 40; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 398 }))
    }
    let second = null
    for (let index = 40; index < 60; index += 1) {
      second ??= log.push(tick(index, 'normal'), windowAt(index))
    }
    expect(z(second?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(-2, 5)
  })

  it('describes an episode opened by drift, where no window looks wrong', () => {
    // Drift is the case where every window reads `normal` and the baseline is
    // climbing. A rule that only kept windows whose status was above normal
    // would hand back no windows at all, for precisely the episodes hardest to
    // explain.
    const log = createEpisodeLog(profile())
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'normal', true), windowAt(index, { spectralCentroidHz: 403 }))
    }
    const episode = log.finish()

    expect(episode?.fromDrift).toBe(true)
    expect(z(episode?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(3, 5)
  })

  it('closes the episode still open when the session ends', () => {
    const log = createEpisodeLog(profile())
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 406 }))
    }
    const episode = log.finish()

    expect(episode?.startSeconds).toBe(0)
    expect(episode?.status).toBe('anomalous')
    expect(z(episode?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(6, 5)
    // And nothing is left behind to close twice.
    expect(log.finish()).toBeNull()
  })

  it('describes a long episode by the whole of it, not just its start', () => {
    /*
     * An hour-long episode is far more windows than are kept. What is kept has
     * to be spread across the whole thing: an episode that begins mildly and
     * ends badly, described only by its opening minutes, reads as mild.
     */
    const log = createEpisodeLog(profile(), 32)
    const total = 4_000
    for (let index = 0; index < total; index += 1) {
      // Brightness climbs steadily from 400 Hz to 408 Hz across the episode,
      // averaging 404 — four standard deviations — over the whole span.
      const centroid = 400 + (8 * index) / (total - 1)
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: centroid }))
    }
    const episode = log.finish()

    // Described by its first windows this lands near 0; by its last, near 8.
    expect(z(episode?.descriptors ?? [], 'spectralCentroidHz')).toBeCloseTo(4, 1)
  })

  it('reports nothing when no feature moved far enough to be worth saying', () => {
    // earshot only names a feature that moved more than 1.5 standard
    // deviations. An episode can be plainly above normal — the score is
    // computed from the embedding, not from these nine numbers — with nothing
    // interpretable to say about it, and saying nothing is the honest answer.
    const log = createEpisodeLog(profile())
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index))
    }
    expect(log.finish()?.descriptors).toEqual([])
  })

  it('keeps the features of each window and none of the embeddings', () => {
    /*
     * A session runs for hours on a phone, and the sample is the one place
     * windows accumulate. Each carries a 1024-number embedding and a class
     * list that nothing in the description reads.
     */
    const log = createEpisodeLog(profile())
    for (let index = 0; index < 10; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 406 }))
    }
    log.finish()

    const windows = describedWindows()
    expect(windows).toHaveLength(10)
    for (const window of windows) {
      expect(window.embedding).toEqual([])
      expect(window.classes).toEqual([])
      // And the part a descriptor is actually built from survives intact.
      expect(window.features.spectralCentroidHz).toBe(406)
    }
  })

  it('describes a long episode from no more windows than it is allowed', () => {
    const log = createEpisodeLog(profile(), 32)
    for (let index = 0; index < 4_000; index += 1) {
      log.push(tick(index, 'anomalous'), windowAt(index, { spectralCentroidHz: 406 }))
    }
    log.finish()
    expect(describedWindows().length).toBeLessThanOrEqual(32)
  })
})
