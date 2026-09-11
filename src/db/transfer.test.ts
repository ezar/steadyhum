import { describe, expect, it } from 'vitest'

import { parseProfileExport, ProfileImportError } from './transfer.ts'

const valid = {
  format: 'steadyhum.profile',
  formatVersion: 1,
  exportedAt: '2026-03-03T10:00:00.000Z',
  appliance: { type: 'washing-machine', name: 'Lavadora', placementNote: 'En la balda' },
  profile: {
    version: 4,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-03T10:00:00.000Z',
    states: [{ id: 's1' }],
    marginZ: 1,
    cleanSeconds: 240,
    sessionCount: 3,
  },
}

function expectRejected(payload: unknown, reason: string): void {
  expect(() => parseProfileExport(JSON.stringify(payload))).toThrow(new ProfileImportError(reason))
}

describe('parseProfileExport', () => {
  it('accepts a well-formed export', () => {
    const parsed = parseProfileExport(JSON.stringify(valid))
    expect(parsed.appliance.name).toBe('Lavadora')
    expect(parsed.profile.version).toBe(4)
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
})
