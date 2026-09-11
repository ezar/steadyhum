import { PROFILE_SCHEMA_VERSION } from 'earshot'
import { describe, expect, it } from 'vitest'

import { parseProfileExport, ProfileImportError } from './transfer.ts'

const valid = {
  format: 'steadyhum.profile',
  formatVersion: 1,
  exportedAt: '2026-03-03T10:00:00.000Z',
  appliance: { type: 'washing-machine', name: 'Lavadora', placementNote: 'En la balda' },
  profile: {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    revision: 4,
    featureSpace: 'embedding',
    dimensions: 1024,
    states: [{ id: 's1' }],
    thresholds: { watch: 0.4, anomalous: 0.7 },
    windowCount: 420,
    levelDbfs: { mean: -34, standardDeviation: 2 },
    calibrations: [],
  },
}

function expectRejected(payload: unknown, reason: string): void {
  expect(() => parseProfileExport(JSON.stringify(payload))).toThrow(new ProfileImportError(reason))
}

describe('parseProfileExport', () => {
  it('accepts a well-formed export', () => {
    const parsed = parseProfileExport(JSON.stringify(valid))
    expect(parsed.appliance.name).toBe('Lavadora')
    expect(parsed.profile.revision).toBe(4)
  })

  it('rejects anything that is not this format', () => {
    expect(() => parseProfileExport('not json')).toThrow(ProfileImportError)
    expectRejected({ ...valid, format: 'something-else' }, 'wrong-format')
    expectRejected({ ...valid, formatVersion: 99 }, 'unsupported-version')
  })

  it('rejects an unknown appliance type', () => {
    expectRejected(
      { ...valid, appliance: { ...valid.appliance, type: 'nuclear-reactor' } },
      'unknown-appliance-type',
    )
  })

  it('rejects a profile with no states', () => {
    expectRejected({ ...valid, profile: { ...valid.profile, states: [] } }, 'missing-states')
  })

  it('rejects a profile written by a different earshot schema', () => {
    expectRejected(
      { ...valid, profile: { ...valid.profile, schemaVersion: PROFILE_SCHEMA_VERSION + 1 } },
      'unsupported-profile-schema',
    )
  })
})
