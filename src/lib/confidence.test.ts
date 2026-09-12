import { describe, expect, it } from 'vitest'

import { confidenceOf } from './confidence.ts'
import {
  LEVEL_GUARD_DB,
  MAX_DISCARDED_RATIO,
  MIN_ENROLLMENT_CLEAN_SECONDS,
  MIN_ENROLLMENT_SESSIONS,
} from '@/db/schema.ts'
import type { StoredCheck } from '@/db/schema.ts'
import type { EnrollmentProgress } from '@/db/repo.ts'

/** A check with nothing wrong with it; each test spoils one thing. */
function check(overrides: Partial<StoredCheck> = {}): StoredCheck {
  return {
    id: 'c1',
    applianceId: 'a1',
    sessionId: 's1',
    profileRevision: 1,
    status: 'normal',
    unusable: false,
    score: 0.1,
    dominantStateId: 'state-1',
    anomalousFraction: 0,
    levelDeltaDb: 0,
    discardedRatio: 0,
    descriptors: [],
    verdict: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** An appliance enrolled well past the minimum. */
function richEnrollment(overrides: Partial<EnrollmentProgress> = {}): EnrollmentProgress {
  return {
    sessionCount: MIN_ENROLLMENT_SESSIONS + 2,
    cleanSeconds: MIN_ENROLLMENT_CLEAN_SECONDS * 3,
    learned: true,
    fraction: 1,
    ...overrides,
  }
}

describe('confidenceOf', () => {
  it('is high when nothing is wrong', () => {
    expect(confidenceOf(check(), richEnrollment())).toEqual({ level: 'high', reason: null })
  })

  it('reports the worst factor rather than averaging them', () => {
    // A richly enrolled appliance, recorded from the right place, but with
    // nearly half the recording thrown away. Averaging would call this fine;
    // it is exactly the case the reader needs warning about.
    const result = confidenceOf(
      check({ discardedRatio: MAX_DISCARDED_RATIO * 0.9 }),
      richEnrollment(),
    )
    expect(result).toEqual({ level: 'low', reason: 'discarded' })
  })

  it('drops to low once the level guard would fire, in either direction', () => {
    for (const delta of [LEVEL_GUARD_DB, -LEVEL_GUARD_DB, LEVEL_GUARD_DB * 2]) {
      expect(confidenceOf(check({ levelDeltaDb: delta }), richEnrollment())).toEqual({
        level: 'low',
        reason: 'level',
      })
    }
  })

  it('treats a bare-minimum profile as medium, not high', () => {
    const barely = richEnrollment({
      sessionCount: MIN_ENROLLMENT_SESSIONS,
      cleanSeconds: MIN_ENROLLMENT_CLEAN_SECONDS,
    })
    expect(confidenceOf(check(), barely)).toEqual({ level: 'medium', reason: 'enrollment' })
  })

  it('needs both more sessions and more audio before calling a profile rich', () => {
    const manyShortSessions = richEnrollment({
      sessionCount: MIN_ENROLLMENT_SESSIONS + 5,
      cleanSeconds: MIN_ENROLLMENT_CLEAN_SECONDS,
    })
    expect(confidenceOf(check(), manyShortSessions).level).toBe('medium')

    const oneLongSession = richEnrollment({
      sessionCount: MIN_ENROLLMENT_SESSIONS,
      cleanSeconds: MIN_ENROLLMENT_CLEAN_SECONDS * 10,
    })
    expect(confidenceOf(check(), oneLongSession).level).toBe('medium')
  })

  it('never claims high for a profile that is not learned yet', () => {
    const unlearned = richEnrollment({ learned: false, fraction: 0.5 })
    expect(confidenceOf(check(), unlearned)).toEqual({ level: 'low', reason: 'enrollment' })
  })

  it('gives an unusable check no verdict to qualify', () => {
    expect(confidenceOf(check({ unusable: true }), richEnrollment())).toEqual({
      level: 'low',
      reason: 'discarded',
    })
  })

  it('holds a clean check at high right up to the first band edge', () => {
    const justInside = check({
      discardedRatio: MAX_DISCARDED_RATIO / 4 - 0.001,
      levelDeltaDb: LEVEL_GUARD_DB / 2 - 0.001,
    })
    expect(confidenceOf(justInside, richEnrollment()).level).toBe('high')
  })
})
