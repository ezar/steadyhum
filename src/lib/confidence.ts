import {
  LEVEL_GUARD_DB,
  MAX_DISCARDED_RATIO,
  MIN_ENROLLMENT_CLEAN_SECONDS,
  MIN_ENROLLMENT_SESSIONS,
} from '@/db/schema.ts'
import type { StoredCheck } from '@/db/schema.ts'
import type { EnrollmentProgress } from '@/db/repo.ts'

export type ConfidenceLevel = 'low' | 'medium' | 'high'

/** Why confidence is not high. `null` when nothing is holding it back. */
export type ConfidenceReason = 'discarded' | 'level' | 'enrollment'

export interface Confidence {
  readonly level: ConfidenceLevel
  readonly reason: ConfidenceReason | null
}

/**
 * How much this particular verdict deserves to be trusted.
 *
 * This is not a probability, and it is deliberately not dressed up as one. It
 * is the answer to a narrower question: is there anything about *this* check
 * that should make the reader take it with a pinch of salt? Three things can,
 * and all three are already measured:
 *
 * - how much of the recording survived the guards, since the verdict is scored
 *   on what was left;
 * - whether the phone was where it was during learning, since comparing a
 *   recording made from the doorway against one made up close is not a fair
 *   comparison;
 * - how much "normal" there was to compare against, since a profile at exactly
 *   the minimum has seen far less of the machine than one with twice that.
 *
 * The result is the *worst* of the three, not their average. Averaging would
 * let a richly enrolled appliance mask a recording that was half thrown away,
 * which is precisely the case the reader needs warning about. A chain is as
 * strong as its weakest link, and so is a verdict.
 *
 * An unusable check gets no confidence at all: it has no verdict to qualify.
 */
export function confidenceOf(check: StoredCheck, enrollment: EnrollmentProgress): Confidence {
  if (check.unusable) return { level: 'low', reason: 'discarded' }

  // Ordered by how immediate the reader's remedy is: record again somewhere
  // quieter, move the phone back, add a session. Ties therefore name the thing
  // easiest to act on.
  let worst: Confidence = { level: fromDiscarded(check.discardedRatio), reason: 'discarded' }
  for (const factor of [
    { level: fromLevel(check.levelDeltaDb), reason: 'level' as const },
    { level: fromEnrollment(enrollment), reason: 'enrollment' as const },
  ]) {
    if (RANK[factor.level] < RANK[worst.level]) worst = factor
  }

  return worst.level === 'high' ? { level: 'high', reason: null } : worst
}

const RANK: Readonly<Record<ConfidenceLevel, number>> = { low: 0, medium: 1, high: 2 }

/**
 * Discarded windows, as a share of the recording.
 *
 * The bands sit below `MAX_DISCARDED_RATIO`, the point at which the check is
 * refused outright: everything here is a check that was scored, just on less
 * evidence than one would like.
 */
function fromDiscarded(ratio: number): ConfidenceLevel {
  if (ratio >= MAX_DISCARDED_RATIO / 2) return 'low'
  if (ratio >= MAX_DISCARDED_RATIO / 4) return 'medium'
  return 'high'
}

/**
 * Distance from where the machine was learned, read through loudness.
 *
 * `LEVEL_GUARD_DB` is already the point the product treats as "the phone is not
 * where it was", so it is the point confidence drops too, rather than a second
 * threshold invented here.
 */
function fromLevel(deltaDb: number): ConfidenceLevel {
  const drift = Math.abs(deltaDb)
  if (drift >= LEVEL_GUARD_DB) return 'low'
  if (drift >= LEVEL_GUARD_DB / 2) return 'medium'
  return 'high'
}

/**
 * How much normal the profile was built from.
 *
 * Meeting the minimum is enough to produce a verdict — that is what the minimum
 * means — but not enough to call the result solid. Twice the required audio and
 * one session more than the minimum is treated as a profile that has genuinely
 * seen the machine, which matches what enrolment already tells people: more
 * sessions, tighter warnings.
 */
function fromEnrollment(enrollment: EnrollmentProgress): ConfidenceLevel {
  if (!enrollment.learned) return 'low'
  const rich =
    enrollment.sessionCount > MIN_ENROLLMENT_SESSIONS &&
    enrollment.cleanSeconds >= MIN_ENROLLMENT_CLEAN_SECONDS * 2
  return rich ? 'high' : 'medium'
}
