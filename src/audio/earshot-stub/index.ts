/**
 * Stand-in for the `earshot` package until it ships its first release.
 *
 * `earshot` is the framework-agnostic audio engine (capture worklet, resampling,
 * feature extraction, YAMNet wrappers, k-means, profile learning, scoring,
 * descriptors) described in `earshot-spec.md` and consumed from GitHub. At the
 * time this scaffold was written the repository contained only a README, so
 * there is no tag to pin and nothing to install.
 *
 * Everything here throws `EarshotError('not-implemented')`. The app treats that
 * one code as "the engine is not wired up yet" and says so in plain language
 * instead of pretending to listen. See docs/decisions/0001-earshot-seam.md for
 * the two-line change that replaces this folder with the real package.
 */

import { EarshotError } from './contract.ts'
import type {
  AnalysisWindow,
  CheckResult,
  Engine,
  EngineOptions,
  LearnOptions,
  Profile,
  ScoreOptions,
  UserVerdict,
} from './contract.ts'

export * from './contract.ts'

const NOT_IMPLEMENTED =
  'The earshot audio engine is not installed yet. See docs/earshot-integration.md.'

function unavailable(): never {
  throw new EarshotError('not-implemented', NOT_IMPLEMENTED)
}

/** @see {@link Engine} */
export function createEngine(_options: EngineOptions): Promise<Engine> {
  return Promise.reject(new EarshotError('not-implemented', NOT_IMPLEMENTED))
}

/**
 * Learns a profile from enrollment sessions (section 6.3).
 *
 * @param _sessions One array of windows per enrollment session.
 */
export function learnProfile(
  _sessions: readonly (readonly AnalysisWindow[])[],
  _options?: LearnOptions,
): Profile {
  return unavailable()
}

/** Scores a check against a learned profile (section 6.4). */
export function scoreCheck(
  _profile: Profile,
  _windows: readonly AnalysisWindow[],
  _options?: ScoreOptions,
): CheckResult {
  return unavailable()
}

/** Applies a user verdict to a profile's thresholds (section 6.7). */
export function applyVerdict(
  _profile: Profile,
  _check: CheckResult,
  _verdict: UserVerdict,
): Profile {
  return unavailable()
}
