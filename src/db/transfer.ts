import { PROFILE_SCHEMA_VERSION } from 'earshot'
import type { Profile } from 'earshot'

import { newId, nowIso } from '@/lib/id.ts'

import { db } from './index.ts'
import { createAppliance, getActiveProfile, saveProfile } from './repo.ts'
import { APPLIANCE_TYPES } from './schema.ts'
import type { Appliance, ApplianceType, StoredProfile } from './schema.ts'

export const PROFILE_EXPORT_FORMAT = 'steadyhum.profile'
export const PROFILE_EXPORT_VERSION = 1

/**
 * A learned normal, portable between phones in the same household.
 *
 * Carries states, thresholds and descriptor baselines. It never carries audio:
 * recordings do not leave the device they were made on, not even to a sibling
 * device.
 */
export interface ProfileExport {
  readonly format: typeof PROFILE_EXPORT_FORMAT
  readonly formatVersion: number
  readonly exportedAt: string
  readonly appliance: {
    readonly type: ApplianceType
    readonly name: string
    readonly placementNote: string
  }
  readonly profile: Profile
}

export class ProfileImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileImportError'
  }
}

export async function exportProfile(applianceId: string): Promise<ProfileExport> {
  const appliance = await db.appliances.get(applianceId)
  if (appliance === undefined) throw new ProfileImportError('unknown-appliance')
  const stored = await getActiveProfile(applianceId)
  if (stored === null) throw new ProfileImportError('no-profile')
  return buildExport(appliance, stored)
}

export function buildExport(appliance: Appliance, stored: StoredProfile): ProfileExport {
  return {
    format: PROFILE_EXPORT_FORMAT,
    formatVersion: PROFILE_EXPORT_VERSION,
    exportedAt: nowIso(),
    appliance: {
      type: appliance.type,
      name: appliance.name,
      placementNote: appliance.placementNote,
    },
    profile: stored.profile,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses and validates an exported profile without trusting any of its fields. */
export function parseProfileExport(raw: string): ProfileExport {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ProfileImportError('not-json')
  }
  if (!isRecord(parsed)) throw new ProfileImportError('not-an-object')
  if (parsed['format'] !== PROFILE_EXPORT_FORMAT) throw new ProfileImportError('wrong-format')
  if (parsed['formatVersion'] !== PROFILE_EXPORT_VERSION) {
    throw new ProfileImportError('unsupported-version')
  }

  const appliance = parsed['appliance']
  if (!isRecord(appliance)) throw new ProfileImportError('missing-appliance')
  const type = appliance['type']
  if (typeof type !== 'string' || !APPLIANCE_TYPES.includes(type as ApplianceType)) {
    throw new ProfileImportError('unknown-appliance-type')
  }
  const name = appliance['name']
  if (typeof name !== 'string' || name.trim() === '') throw new ProfileImportError('missing-name')
  const placementNote = appliance['placementNote']

  const profile = parsed['profile']
  if (!isRecord(profile)) throw new ProfileImportError('missing-profile')
  if (profile['schemaVersion'] !== PROFILE_SCHEMA_VERSION) {
    throw new ProfileImportError('unsupported-profile-schema')
  }
  if (typeof profile['revision'] !== 'number') throw new ProfileImportError('missing-revision')
  if (!Array.isArray(profile['states']) || profile['states'].length === 0) {
    throw new ProfileImportError('missing-states')
  }
  if (!isRecord(profile['thresholds'])) throw new ProfileImportError('missing-thresholds')

  return {
    format: PROFILE_EXPORT_FORMAT,
    formatVersion: PROFILE_EXPORT_VERSION,
    exportedAt: typeof parsed['exportedAt'] === 'string' ? parsed['exportedAt'] : nowIso(),
    appliance: {
      type: type as ApplianceType,
      name: name.trim(),
      placementNote: typeof placementNote === 'string' ? placementNote : '',
    },
    profile: profile as unknown as Profile,
  }
}

/** Creates a new appliance from an exported profile. */
export async function importProfile(payload: ProfileExport): Promise<Appliance> {
  const appliance = await createAppliance({
    type: payload.appliance.type,
    name: payload.appliance.name,
    placementNote: payload.appliance.placementNote,
  })
  await saveProfile(appliance.id, payload.profile)
  return appliance
}

/** Filename used when the export is saved to disk. */
export function exportFileName(payload: ProfileExport): string {
  const slug = payload.appliance.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `steadyhum-${slug === '' ? newId() : slug}.json`
}
