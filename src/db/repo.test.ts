import { beforeEach, describe, expect, it } from 'vitest'

import { db } from './index.ts'
import {
  createAppliance,
  deriveStatus,
  listApplianceOverviews,
  summariseEnrollment,
  deleteAppliance,
} from './repo.ts'
import type { Session, StoredCheck } from './schema.ts'

function session(overrides: Partial<Session>): Session {
  return {
    id: crypto.randomUUID(),
    applianceId: 'a1',
    kind: 'enrollment',
    startedAt: new Date().toISOString(),
    endedAt: null,
    cleanSeconds: 60,
    totalWindows: 120,
    discardedWindows: 0,
    statesDiscovered: 2,
    ...overrides,
  }
}

function check(status: StoredCheck['status'], unusable = false): StoredCheck {
  return {
    id: crypto.randomUUID(),
    applianceId: 'a1',
    sessionId: 's1',
    profileRevision: 1,
    status,
    unusable,
    score: 0.2,
    dominantStateId: 's-0',
    anomalousFraction: 0,
    levelDeltaDb: 0,
    discardedRatio: 0,
    descriptors: [],
    verdict: null,
    createdAt: new Date().toISOString(),
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

describe('summariseEnrollment', () => {
  it('needs three sessions and 180 clean seconds', () => {
    const two = summariseEnrollment([
      session({ cleanSeconds: 120 }),
      session({ cleanSeconds: 120 }),
    ])
    expect(two.learned).toBe(false)

    const three = summariseEnrollment([
      session({ cleanSeconds: 60 }),
      session({ cleanSeconds: 60 }),
      session({ cleanSeconds: 60 }),
    ])
    expect(three.learned).toBe(true)
    expect(three.cleanSeconds).toBe(180)
  })

  it('ignores check and watch sessions', () => {
    const progress = summariseEnrollment([
      session({ kind: 'check', cleanSeconds: 300 }),
      session({ kind: 'watch', cleanSeconds: 7200 }),
    ])
    expect(progress.sessionCount).toBe(0)
    expect(progress.cleanSeconds).toBe(0)
  })

  it('reports the lower of the two requirements as progress', () => {
    // Three sessions, but only 90 clean seconds: half way, not finished.
    const progress = summariseEnrollment([
      session({ cleanSeconds: 30 }),
      session({ cleanSeconds: 30 }),
      session({ cleanSeconds: 30 }),
    ])
    expect(progress.fraction).toBeCloseTo(0.5)
    expect(progress.learned).toBe(false)
  })
})

describe('deriveStatus', () => {
  const learned = summariseEnrollment([
    session({ cleanSeconds: 60 }),
    session({ cleanSeconds: 60 }),
    session({ cleanSeconds: 60 }),
  ])

  it('reports learning until the normal is learned', () => {
    expect(deriveStatus(summariseEnrollment([]), check('anomalous'))).toBe('learning')
  })

  it('reports never-checked once learned with no checks', () => {
    expect(deriveStatus(learned, null)).toBe('never-checked')
  })

  it('mirrors the last check otherwise', () => {
    expect(deriveStatus(learned, check('watch'))).toBe('watch')
  })

  it('reports unusable over the score when the guards spoiled the check', () => {
    // earshot still returns a status for a spoiled recording; SteadyHum is the
    // one that decides the verdict should not be shown.
    expect(deriveStatus(learned, check('anomalous', true))).toBe('unusable')
  })
})

describe('appliance lifecycle', () => {
  it('creates an appliance that starts learning with no sessions', async () => {
    await createAppliance({ type: 'dishwasher', name: '  Lavavajillas  ', placementNote: '' })
    const [overview] = await listApplianceOverviews()
    expect(overview?.appliance.name).toBe('Lavavajillas')
    expect(overview?.status).toBe('learning')
    expect(overview?.enrollment.sessionCount).toBe(0)
  })

  it('deletes derived rows with the appliance', async () => {
    const appliance = await createAppliance({ type: 'fridge', name: 'Nevera', placementNote: '' })
    const stored = session({ applianceId: appliance.id })
    await db.sessions.add(stored)
    await db.windows.add({
      sessionId: stored.id,
      window: {
        t: 0,
        rmsDbfs: -30,
        classes: [],
        features: {
          rmsDbfs: -30,
          logMel: [],
          bands: [],
          peaks: [],
          spectralFlatness: 0,
          spectralCentroidHz: 0,
          spectralFlux: 0,
          onsets: [],
          onsetPeriodicity: 0,
          onsetPeriodSeconds: 0,
          amplitudeModulationHz: 0,
          amplitudeModulationDepth: 0,
        },
      },
      embedding: { format: 'int8', dimensions: 1024, data: '', scale: 1 },
      rejectedFor: [],
    })

    await deleteAppliance(appliance.id)

    expect(await db.appliances.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.windows.count()).toBe(0)
  })
})
