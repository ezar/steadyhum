import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type {
  Appliance,
  CalibrationEntry,
  Clip,
  Session,
  StoredCheck,
  StoredProfile,
  StoredWindow,
  WatchSegment,
} from './schema.ts'

/**
 * Local-only storage. Nothing in here is ever uploaded; the only network
 * requests the app makes are for the app itself and the models.
 */
export class SteadyHumDatabase extends Dexie {
  declare appliances: EntityTable<Appliance, 'id'>
  declare profiles: EntityTable<StoredProfile, 'id'>
  declare sessions: EntityTable<Session, 'id'>
  declare windows: EntityTable<StoredWindow, 'id'>
  declare checks: EntityTable<StoredCheck, 'id'>
  declare clips: EntityTable<Clip, 'id'>
  declare calibrationLog: EntityTable<CalibrationEntry, 'id'>
  declare watchSegments: EntityTable<WatchSegment, 'id'>

  constructor(name = 'steadyhum') {
    super(name)
    this.version(1).stores({
      appliances: 'id, type, createdAt',
      profiles: 'id, applianceId, [applianceId+active], revision',
      sessions: 'id, applianceId, kind, [applianceId+kind], startedAt',
      windows: '++id, sessionId',
      checks: 'id, applianceId, sessionId, createdAt, [applianceId+createdAt]',
      clips: 'id, sessionId, createdAt',
      calibrationLog: 'id, applianceId, checkId, createdAt',
    })
    /*
     * Watch mode's segment log. Purely additive — Dexie creates the store and
     * leaves every existing table alone, so no upgrade function is needed and
     * nobody's profiles are touched.
     */
    this.version(2).stores({
      watchSegments: 'id, sessionId, applianceId, [applianceId+createdAt], createdAt',
    })
    /*
     * Episodes gained their descriptors — how the machine differed, not just
     * that it did.
     *
     * No index changes, so no `stores` call: Dexie carries the previous
     * version's schema forward. The upgrade exists only to make the type true
     * of every row. `WatchSegment.descriptors` is not optional, and a row
     * written by version 2 has no such field, so without this backfill anything
     * reading the table would be handed `undefined` by a type promising an
     * array — the kind of lie that surfaces as a crash months later, in the one
     * screen that finally reads the column.
     */
    this.version(3).upgrade(async (transaction) => {
      await transaction
        .table<UpgradingSegment>('watchSegments')
        .toCollection()
        .modify((segment) => {
          segment.descriptors ??= []
        })
    })
  }
}

/**
 * A watch segment as the version 3 upgrade finds it.
 *
 * `WatchSegment` describes rows written from version 3 onwards, where
 * `descriptors` is present and readonly. Neither is true of what is on disk
 * partway through the upgrade, which is the one place the field is both
 * missing and about to be written.
 */
type UpgradingSegment = { descriptors?: WatchSegment['descriptors'] }

export const db = new SteadyHumDatabase()
