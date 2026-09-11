import type { CheckStatus, Profile } from 'earshot'

import { newId, nowIso } from '@/lib/id.ts'

import { db } from './index.ts'
import {
  MIN_ENROLLMENT_CLEAN_SECONDS,
  MIN_ENROLLMENT_SESSIONS,
  WINDOW_RETENTION_DAYS,
} from './schema.ts'
import type { Appliance, ApplianceType, Session, StoredCheck, StoredProfile } from './schema.ts'

/** What a card on Home shows. `learning` outranks any check result. */
export type ApplianceStatus = 'learning' | 'never-checked' | CheckStatus

export interface EnrollmentProgress {
  readonly sessionCount: number
  readonly cleanSeconds: number
  readonly learned: boolean
  /** Completion in [0, 1], the lower of the two requirements. */
  readonly fraction: number
}

export interface ApplianceOverview {
  readonly appliance: Appliance
  readonly enrollment: EnrollmentProgress
  readonly status: ApplianceStatus
  readonly lastCheck: StoredCheck | null
}

export async function createAppliance(input: {
  type: ApplianceType
  name: string
  placementNote: string
}): Promise<Appliance> {
  const timestamp = nowIso()
  const appliance: Appliance = {
    id: newId(),
    type: input.type,
    name: input.name.trim(),
    placementNote: input.placementNote.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await db.appliances.add(appliance)
  return appliance
}

export async function renameAppliance(id: string, name: string): Promise<void> {
  await db.appliances.update(id, { name: name.trim(), updatedAt: nowIso() })
}

export async function updatePlacementNote(id: string, placementNote: string): Promise<void> {
  await db.appliances.update(id, { placementNote: placementNote.trim(), updatedAt: nowIso() })
}

/** Deletes an appliance and everything derived from it. */
export async function deleteAppliance(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.appliances, db.profiles, db.sessions, db.windows, db.checks, db.clips, db.calibrationLog],
    async () => {
      const sessions = await db.sessions.where('applianceId').equals(id).toArray()
      const sessionIds = sessions.map((session) => session.id)
      await db.windows.where('sessionId').anyOf(sessionIds).delete()
      await db.clips.where('sessionId').anyOf(sessionIds).delete()
      await db.sessions.where('applianceId').equals(id).delete()
      await db.profiles.where('applianceId').equals(id).delete()
      await db.checks.where('applianceId').equals(id).delete()
      await db.calibrationLog.where('applianceId').equals(id).delete()
      await db.appliances.delete(id)
    },
  )
}

export function summariseEnrollment(sessions: readonly Session[]): EnrollmentProgress {
  const enrollmentSessions = sessions.filter((session) => session.kind === 'enrollment')
  const sessionCount = enrollmentSessions.length
  const cleanSeconds = enrollmentSessions.reduce(
    (total, session) => total + session.cleanSeconds,
    0,
  )
  const learned =
    sessionCount >= MIN_ENROLLMENT_SESSIONS && cleanSeconds >= MIN_ENROLLMENT_CLEAN_SECONDS
  const fraction = Math.min(
    1,
    Math.min(sessionCount / MIN_ENROLLMENT_SESSIONS, cleanSeconds / MIN_ENROLLMENT_CLEAN_SECONDS),
  )
  return { sessionCount, cleanSeconds, learned, fraction }
}

export function deriveStatus(
  enrollment: EnrollmentProgress,
  lastCheck: StoredCheck | null,
): ApplianceStatus {
  if (!enrollment.learned) return 'learning'
  if (lastCheck === null) return 'never-checked'
  return lastCheck.status
}

export async function getApplianceOverview(id: string): Promise<ApplianceOverview | null> {
  const appliance = await db.appliances.get(id)
  if (appliance === undefined) return null
  const sessions = await db.sessions.where('applianceId').equals(id).toArray()
  const enrollment = summariseEnrollment(sessions)
  const lastCheck = await lastCheckFor(id)
  return { appliance, enrollment, status: deriveStatus(enrollment, lastCheck), lastCheck }
}

export async function listApplianceOverviews(): Promise<ApplianceOverview[]> {
  const appliances = await db.appliances.orderBy('createdAt').toArray()
  return Promise.all(
    appliances.map(async (appliance) => {
      const sessions = await db.sessions.where('applianceId').equals(appliance.id).toArray()
      const enrollment = summariseEnrollment(sessions)
      const lastCheck = await lastCheckFor(appliance.id)
      return { appliance, enrollment, status: deriveStatus(enrollment, lastCheck), lastCheck }
    }),
  )
}

async function lastCheckFor(applianceId: string): Promise<StoredCheck | null> {
  const checks = await db.checks.where('applianceId').equals(applianceId).sortBy('createdAt')
  return checks.at(-1) ?? null
}

export async function listChecks(applianceId: string): Promise<StoredCheck[]> {
  const checks = await db.checks.where('applianceId').equals(applianceId).sortBy('createdAt')
  return checks.reverse()
}

export async function getActiveProfile(applianceId: string): Promise<StoredProfile | null> {
  const profiles = await db.profiles.where('applianceId').equals(applianceId).toArray()
  return profiles.find((stored) => stored.active) ?? null
}

/** Stores a new profile version and retires the previous active one. */
export async function saveProfile(applianceId: string, profile: Profile): Promise<StoredProfile> {
  const stored: StoredProfile = {
    id: newId(),
    applianceId,
    version: profile.version,
    active: true,
    profile,
    createdAt: nowIso(),
  }
  await db.transaction('rw', db.profiles, async () => {
    const existing = await db.profiles.where('applianceId').equals(applianceId).toArray()
    await Promise.all(
      existing
        .filter((candidate) => candidate.active)
        .map((candidate) => db.profiles.update(candidate.id, { active: false })),
    )
    await db.profiles.add(stored)
  })
  return stored
}

/** Drops window-level rows past the retention window. Aggregates are untouched. */
export async function pruneOldWindows(retentionDays = WINDOW_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const stale = await db.sessions.filter((session) => session.startedAt < cutoff).toArray()
  if (stale.length === 0) return 0
  const ids = stale.map((session) => session.id)
  return db.windows.where('sessionId').anyOf(ids).delete()
}
