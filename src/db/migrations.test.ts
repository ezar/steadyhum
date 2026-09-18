import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { SteadyHumDatabase } from './index.ts'

/**
 * Upgrades, run against a database actually written by the older version.
 *
 * Opening the current schema on an empty database proves nothing: every
 * upgrade function is skipped when there is no older database to upgrade. So
 * these tests build the old schema by hand, write a row in the old shape,
 * close it, and only then open the real class — which is the sequence a user
 * with existing data goes through, and the only one where a broken migration
 * shows up.
 *
 * The old schema is spelled out rather than imported on purpose. It is a
 * record of what version 2 actually wrote; if it were shared with the live
 * schema it would follow every future edit and stop describing the past.
 */
const V2_STORES = {
  appliances: 'id, type, createdAt',
  profiles: 'id, applianceId, [applianceId+active], revision',
  sessions: 'id, applianceId, kind, [applianceId+kind], startedAt',
  windows: '++id, sessionId',
  checks: 'id, applianceId, sessionId, createdAt, [applianceId+createdAt]',
  clips: 'id, sessionId, createdAt',
  calibrationLog: 'id, applianceId, checkId, createdAt',
} as const

const V2_WATCH_SEGMENTS = 'id, sessionId, applianceId, [applianceId+createdAt], createdAt'

/** A watch segment exactly as version 2 wrote it: no `descriptors` field. */
function oldSegment(id: string): Record<string, unknown> {
  return {
    id,
    sessionId: 'session-1',
    applianceId: 'appliance-1',
    startSeconds: 12,
    endSeconds: 30,
    peakScore: 0.7,
    status: 'anomalous',
    dominantStateId: 'state-0',
    fromDrift: false,
    createdAt: new Date().toISOString(),
  }
}

const opened: Dexie[] = []

/** Build and open the version 2 database under `name`, then fill it. */
async function openVersion2(name: string): Promise<Dexie> {
  const old = new Dexie(name)
  old.version(1).stores(V2_STORES)
  old.version(2).stores({ watchSegments: V2_WATCH_SEGMENTS })
  await old.open()
  opened.push(old)
  return old
}

afterEach(async () => {
  for (const database of opened.splice(0)) {
    database.close()
    await database.delete().catch(() => undefined)
  }
})

describe('version 3', () => {
  it('gives every old segment the descriptors its type promises', async () => {
    const name = `migration-backfill-${crypto.randomUUID()}`
    const old = await openVersion2(name)
    await old.table('watchSegments').bulkAdd([oldSegment('one'), oldSegment('two')])
    old.close()

    const upgraded = new SteadyHumDatabase(name)
    opened.push(upgraded)
    await upgraded.open()

    const rows = await upgraded.watchSegments.toArray()
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.descriptors).toEqual([])
  })

  it('leaves the rest of the row alone', async () => {
    const name = `migration-intact-${crypto.randomUUID()}`
    const old = await openVersion2(name)
    await old.table('watchSegments').add(oldSegment('one'))
    old.close()

    const upgraded = new SteadyHumDatabase(name)
    opened.push(upgraded)
    await upgraded.open()

    const row = await upgraded.watchSegments.get('one')
    expect(row).toMatchObject({
      sessionId: 'session-1',
      applianceId: 'appliance-1',
      startSeconds: 12,
      endSeconds: 30,
      peakScore: 0.7,
      status: 'anomalous',
      dominantStateId: 'state-0',
      fromDrift: false,
    })
  })

  it('keeps every store and index the earlier versions declared', async () => {
    /*
     * Version 3 adds no `stores` call, on the belief that Dexie carries the
     * previous version's schema forward. If that belief is wrong the upgrade
     * does not merely skip a backfill — it drops every table in the database.
     */
    const name = `migration-schema-${crypto.randomUUID()}`
    const old = await openVersion2(name)
    await old.table('appliances').add({
      id: 'appliance-1',
      name: 'Lavadora',
      type: 'washing-machine',
      createdAt: new Date().toISOString(),
    })
    old.close()

    const upgraded = new SteadyHumDatabase(name)
    opened.push(upgraded)
    await upgraded.open()

    expect(upgraded.tables.map((table) => table.name).sort()).toEqual([
      'appliances',
      'calibrationLog',
      'checks',
      'clips',
      'profiles',
      'sessions',
      'watchSegments',
      'windows',
    ])
    // The data survived, and so did the compound index the overview screen uses.
    expect(await upgraded.appliances.get('appliance-1')).toMatchObject({ name: 'Lavadora' })
    expect(
      await upgraded.watchSegments.where('[applianceId+createdAt]').between([''], ['￿']).count(),
    ).toBe(0)
  })
})
