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

  constructor(name = 'steadyhum') {
    super(name)
    this.version(1).stores({
      appliances: 'id, type, createdAt',
      profiles: 'id, applianceId, [applianceId+active], version',
      sessions: 'id, applianceId, kind, [applianceId+kind], startedAt',
      windows: '++id, sessionId, startSeconds',
      checks: 'id, applianceId, sessionId, createdAt, [applianceId+createdAt]',
      clips: 'id, sessionId, createdAt',
      calibrationLog: 'id, applianceId, checkId, createdAt',
    })
  }
}

export const db = new SteadyHumDatabase()
