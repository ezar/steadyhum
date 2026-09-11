/**
 * Turning a finished recording into stored rows.
 *
 * This is the boundary earshot deliberately does not cross: it returns plain
 * data and SteadyHum decides what to keep. Embeddings are quantized here rather
 * than at capture time so the scorer always works with full precision.
 */
import {
  HOP_SECONDS,
  calibrate,
  dequantize,
  describeDifference,
  learnProfile,
  quantize,
  scoreCheck,
} from 'earshot'
import type { Profile, Verdict, WindowResult } from 'earshot'

import type { GuardedWindow } from '@/audio/engine.ts'
import { newId, nowIso } from '@/lib/id.ts'

import { db } from './index.ts'
import { getActiveProfile, saveProfile, summariseEnrollment } from './repo.ts'
import { MAX_DISCARDED_RATIO } from './schema.ts'
import type { SessionKind, StoredCheck, StoredWindow, UserVerdict } from './schema.ts'

function accepted(windows: readonly GuardedWindow[]): WindowResult[] {
  return windows.filter((entry) => entry.guard.accepted).map((entry) => entry.window)
}

function toStoredWindows(sessionId: string, windows: readonly GuardedWindow[]): StoredWindow[] {
  return windows.map(({ window, guard }) => {
    const { embedding, ...rest } = window
    return {
      sessionId,
      window: rest,
      embedding: quantize(embedding, 'int8'),
      rejectedFor: guard.reasons,
    }
  })
}

/** Share of windows the guards threw away, in [0, 1]. */
export function discardedRatio(windows: readonly GuardedWindow[]): number {
  if (windows.length === 0) return 1
  const kept = windows.filter((entry) => entry.guard.accepted).length
  return 1 - kept / windows.length
}

export interface EnrollmentOutcome {
  readonly sessionId: string
  readonly cleanSeconds: number
  /** Number of states in the profile, or null when there is not enough audio yet. */
  readonly statesDiscovered: number | null
  readonly learned: boolean
}

/**
 * Stores one enrollment session and, once there is enough clean audio, relearns
 * the appliance's profile from every enrollment session it has.
 */
export async function saveEnrollmentSession(
  applianceId: string,
  windows: readonly GuardedWindow[],
  startedAt: string,
): Promise<EnrollmentOutcome> {
  const sessionId = newId()
  const clean = accepted(windows)
  const cleanSeconds = clean.length * HOP_SECONDS

  await db.transaction('rw', [db.sessions, db.windows], async () => {
    await db.sessions.add({
      id: sessionId,
      applianceId,
      kind: 'enrollment' satisfies SessionKind,
      startedAt,
      endedAt: nowIso(),
      cleanSeconds,
      totalWindows: windows.length,
      discardedWindows: windows.length - clean.length,
      statesDiscovered: null,
    })
    await db.windows.bulkAdd(toStoredWindows(sessionId, windows))
  })

  const sessions = await db.sessions.where('applianceId').equals(applianceId).toArray()
  const progress = summariseEnrollment(sessions)
  if (!progress.learned) {
    return { sessionId, cleanSeconds, statesDiscovered: null, learned: false }
  }

  // Relearn from scratch: the profile is a fit over every session, not an
  // accumulation, so a new session can change how the states are drawn.
  const profile = learnProfile(await allEnrollmentWindows(applianceId))
  await saveProfile(applianceId, profile)
  await db.sessions.update(sessionId, { statesDiscovered: profile.states.length })

  return { sessionId, cleanSeconds, statesDiscovered: profile.states.length, learned: true }
}

/** Every guard-accepted enrollment window an appliance has, at full precision. */
async function allEnrollmentWindows(applianceId: string): Promise<WindowResult[]> {
  const sessions = await db.sessions.where('applianceId').equals(applianceId).toArray()
  const ids = sessions.filter((session) => session.kind === 'enrollment').map((s) => s.id)
  const stored = await db.windows.where('sessionId').anyOf(ids).toArray()
  return stored.filter((row) => row.rejectedFor.length === 0).map(toWindowResult)
}

/**
 * Restores a stored window to the shape earshot's learning and scoring want.
 *
 * `dequantize` returns a Float32Array for the DSP paths; `WindowResult` is a
 * JSON-compatible type, so the vector goes back to a plain array here.
 */
function toWindowResult(row: StoredWindow): WindowResult {
  return { ...row.window, embedding: Array.from(dequantize(row.embedding)) }
}

export interface CheckOutcome {
  readonly check: StoredCheck
  readonly profile: Profile
}

/** Scores a finished check against the appliance's active profile and stores it. */
export async function saveCheck(
  applianceId: string,
  windows: readonly GuardedWindow[],
  startedAt: string,
): Promise<CheckOutcome | null> {
  const stored = await getActiveProfile(applianceId)
  if (stored === null) return null

  const sessionId = newId()
  const clean = accepted(windows)
  const discarded = discardedRatio(windows)
  const result = scoreCheck(stored.profile, clean)
  const descriptors = describeDifference(stored.profile, result.dominantStateId, clean)

  const check: StoredCheck = {
    id: newId(),
    applianceId,
    sessionId,
    profileRevision: result.profileRevision,
    status: result.status,
    unusable: discarded > MAX_DISCARDED_RATIO || clean.length === 0,
    score: result.score,
    dominantStateId: result.dominantStateId,
    anomalousFraction: result.anomalousFraction,
    levelDeltaDb: levelDelta(stored.profile, clean),
    discardedRatio: discarded,
    descriptors,
    verdict: null,
    createdAt: nowIso(),
  }

  await db.transaction('rw', [db.sessions, db.windows, db.checks], async () => {
    await db.sessions.add({
      id: sessionId,
      applianceId,
      kind: 'check' satisfies SessionKind,
      startedAt,
      endedAt: nowIso(),
      cleanSeconds: clean.length * HOP_SECONDS,
      totalWindows: windows.length,
      discardedWindows: windows.length - clean.length,
      statesDiscovered: null,
    })
    await db.windows.bulkAdd(toStoredWindows(sessionId, windows))
    await db.checks.add(check)
  })

  return { check, profile: stored.profile }
}

/** Mean check level minus the profile's learned level, in dB. */
function levelDelta(profile: Profile, windows: readonly WindowResult[]): number {
  if (windows.length === 0) return 0
  const mean = windows.reduce((total, window) => total + window.rmsDbfs, 0) / windows.length
  return mean - profile.levelDbfs.mean
}

/**
 * Folds the user's judgement back into the profile (section 6.7).
 *
 * "Not sure" is recorded against the check but never reaches earshot: it would
 * move the thresholds on no evidence.
 */
export async function applyUserVerdict(
  applianceId: string,
  check: StoredCheck,
  verdict: UserVerdict,
): Promise<void> {
  await db.checks.update(check.id, { verdict })
  if (verdict === 'not-sure') return

  const stored = await getActiveProfile(applianceId)
  if (stored === null) return

  const windows = await db.windows.where('sessionId').equals(check.sessionId).toArray()
  const clean = windows.filter((row) => row.rejectedFor.length === 0).map(toWindowResult)
  if (clean.length === 0) return

  const updated = calibrate(stored.profile, verdict satisfies Verdict, clean)
  await saveProfile(applianceId, updated)
  await db.calibrationLog.add({
    id: newId(),
    applianceId,
    checkId: check.id,
    verdict,
    previousRevision: stored.profile.revision,
    nextRevision: updated.revision,
    createdAt: nowIso(),
    undone: false,
  })
}
