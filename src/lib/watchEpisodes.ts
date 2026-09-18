import { describeDifference } from 'earshot'
import type { Descriptor, Profile, WindowResult } from 'earshot'

import { createUniformSample } from './uniformSample.ts'
import { createSegmentTracker, isAbnormal } from './watchSegments.ts'
import type { OpenSegment, WatchTick } from './watchSegments.ts'

/**
 * An episode, and as much of *how* it differed as can honestly be said.
 *
 * The segment alone answers "did anything happen, and when". On its own that
 * leaves the reader with a coloured line and nothing to listen for, which is
 * the gap the descriptors close — without ever naming a cause, which SteadyHum
 * does not know and will not guess at.
 */
export interface WatchEpisode extends OpenSegment {
  /** Worst first. Often empty, which is a real answer rather than a failure. */
  readonly descriptors: readonly Descriptor[]
}

/** A sampled window, kept with the state it matched. */
interface StatedWindow {
  readonly stateId: string
  readonly window: WindowResult
}

export interface EpisodeLog {
  /** Feed one scored window; returns an episode if this window ended one. */
  push: (tick: WatchTick, window: WindowResult) => WatchEpisode | null
  /** Close whatever is open, at the end of the session. */
  finish: () => WatchEpisode | null
}

/**
 * How many of an episode's windows are kept to describe it.
 *
 * At earshot's window every 0.4875 s, roughly two minutes of audio. An
 * episode has no upper length — a machine that never returns to normal is one
 * episode lasting the whole session — so something has to bound this. Larger
 * would buy very little: these become one mean per feature, and a couple of
 * hundred evenly spread windows pin a mean down about as well as several
 * thousand.
 */
export const EPISODE_SAMPLE_WINDOWS = 240

/**
 * The episode log of a watch session: which episodes there were, and how each
 * one differed.
 *
 * This exists as its own unit because of what it has to get right and how
 * invisibly it could get it wrong. Every mistake available here produces
 * descriptors that look entirely plausible — a confident sentence about the
 * wrong stretch of audio reads exactly like a confident sentence about the
 * right one — and this app's whole claim is that it does not say more than it
 * knows. So the window bookkeeping lives here, in the open, rather than inside
 * a React callback where nothing can test it.
 */
export function createEpisodeLog(
  profile: Profile,
  sampleWindows: number = EPISODE_SAMPLE_WINDOWS,
): EpisodeLog {
  const tracker = createSegmentTracker()
  const sample = createUniformSample<StatedWindow>(sampleWindows)

  /**
   * Close a segment, describing it from the windows it was made of.
   *
   * The sample is taken rather than read, so the next episode starts from
   * nothing. Leaving these windows in place would describe the next episode
   * partly in terms of this one — contamination that nothing downstream could
   * ever reveal, since the output is a fluent sentence either way.
   */
  function close(segment: OpenSegment | null): WatchEpisode | null {
    if (segment === null) return null
    /*
     * Only the windows that matched the state being described.
     *
     * `describeDifference` measures against exactly one state's baseline, and
     * a machine with several states can change state mid-episode — a washing
     * machine washes, then drains, then spins. Handing it every window of the
     * episode measures the drain against the spin's normal, and the ordinary
     * difference between two phases of healthy running comes back as a
     * confident finding about a fault. Silence would be better than that; the
     * dominant state's own windows are better still.
     */
    const windows = sample
      .take()
      .filter((sampled) => sampled.stateId === segment.dominantStateId)
      .map((sampled) => sampled.window)
    if (windows.length === 0) return { ...segment, descriptors: [] }
    return {
      ...segment,
      descriptors: describeDifference(profile, segment.dominantStateId, windows),
    }
  }

  return {
    push(tick: WatchTick, window: WindowResult): WatchEpisode | null {
      /*
       * The rule is `isAbnormal`, not "the tracker has something open".
       *
       * They differ over the grace period — the short dip back to normal the
       * tracker holds an episode open through, in case it resumes — and those
       * windows are the ones that sound like the machine's normal. Averaging
       * them in pulls every z-score towards zero, which does not look like a
       * bug in the output: it looks like a milder finding, or like a feature
       * that never moved far enough to be worth reporting.
       *
       * Using the same predicate the tracker opens segments on is what keeps
       * the windows describing an episode and the episode's own span talking
       * about the same stretch of audio.
       */
      if (isAbnormal(tick)) {
        sample.push({ stateId: tick.dominantStateId, window: forDescriptors(window) })
      }
      return close(tracker.push(tick))
    },
    finish(): WatchEpisode | null {
      return close(tracker.finish())
    },
  }
}

/**
 * The window, minus the two arrays a descriptor has no use for.
 *
 * `describeDifference` reads `features` and nothing else, while `embedding`
 * carries 1024 numbers and `classes` a list per window. Kept whole, a
 * two-minute sample would hold several megabytes of vectors behind a handful
 * of sentences — for the length of a session meant to run unattended, on a
 * phone, for hours.
 *
 * Empty is a shape earshot itself produces: it is what a window carries when
 * the embedder or classifier is not configured, so nothing downstream can be
 * surprised by it.
 */
function forDescriptors(window: WindowResult): WindowResult {
  return { ...window, embedding: [], classes: [] }
}
