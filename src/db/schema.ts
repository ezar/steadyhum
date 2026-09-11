import type {
  ClassScore,
  Confidence,
  Descriptor,
  Interference,
  Profile,
  UserVerdict,
  WindowFeatures,
} from 'earshot'
import type { CheckStatus } from 'earshot'

/** Appliance types. Only affects icons, placement tips and copy, never the model. */
export type ApplianceType =
  | 'washing-machine'
  | 'dryer'
  | 'dishwasher'
  | 'fridge'
  | 'boiler'
  | 'heat-pump'
  | 'ac-indoor'
  | 'extractor-hood'
  | 'other'

export const APPLIANCE_TYPES: readonly ApplianceType[] = [
  'washing-machine',
  'dryer',
  'dishwasher',
  'fridge',
  'boiler',
  'heat-pump',
  'ac-indoor',
  'extractor-hood',
  'other',
]

export interface Appliance {
  readonly id: string
  readonly type: ApplianceType
  readonly name: string
  /** Free text, e.g. "phone on the shelf left of the machine, at chest height". */
  readonly placementNote: string
  /** ISO 8601. */
  readonly createdAt: string
  readonly updatedAt: string
}

/** A learned normal. One row per version; exactly one is active per appliance. */
export interface StoredProfile {
  readonly id: string
  readonly applianceId: string
  readonly version: number
  readonly active: boolean
  readonly profile: Profile
  readonly createdAt: string
}

export type SessionKind = 'enrollment' | 'check' | 'watch'

export interface Session {
  readonly id: string
  readonly applianceId: string
  readonly kind: SessionKind
  readonly startedAt: string
  readonly endedAt: string | null
  /** Seconds of audio that survived the noise guard. */
  readonly cleanSeconds: number
  readonly totalWindows: number
  readonly discardedWindows: number
  /** States discovered in this enrollment session, null for other kinds. */
  readonly statesDiscovered: number | null
}

/**
 * One analysis window, quantized for storage. About 1 KB each: a two hour watch
 * session is roughly 15k windows, 15 MB. Pruned after
 * {@link WINDOW_RETENTION_DAYS}; the aggregates in `checks` are kept forever.
 */
export interface StoredWindow {
  readonly id?: number
  readonly sessionId: string
  readonly startSeconds: number
  readonly levelDbfs: number
  /** Int8-quantized embedding; multiply by `embeddingScale` to restore. */
  readonly embedding: Int8Array
  readonly embeddingScale: number
  readonly topClasses: readonly ClassScore[]
  readonly features: WindowFeatures
  readonly interference: Interference | null
}

export interface StoredCheck {
  readonly id: string
  readonly applianceId: string
  readonly sessionId: string
  /** The profile version this check was scored against. */
  readonly profileVersion: number
  readonly status: CheckStatus
  readonly score: number
  readonly confidence: Confidence
  readonly matchedStateId: string | null
  readonly unmatchedState: boolean
  readonly levelDeltaDb: number
  readonly discardedRatio: number
  readonly descriptors: readonly Descriptor[]
  readonly verdict: UserVerdict | null
  readonly createdAt: string
}

export interface Clip {
  readonly id: string
  readonly sessionId: string
  readonly startSeconds: number
  readonly blob: Blob
  readonly createdAt: string
}

/** Lets the user undo a verdict that moved their thresholds (section 6.7). */
export interface CalibrationEntry {
  readonly id: string
  readonly applianceId: string
  readonly checkId: string
  readonly verdict: UserVerdict
  readonly previousMarginZ: number
  readonly nextMarginZ: number
  readonly createdAt: string
  readonly undone: boolean
}

/** Window-level rows older than this are pruned; aggregates are kept forever. */
export const WINDOW_RETENTION_DAYS = 90

/** Enrollment is complete at this many sessions (section 6.3). */
export const MIN_ENROLLMENT_SESSIONS = 3

/** Enrollment is complete at this much clean audio, in seconds. */
export const MIN_ENROLLMENT_CLEAN_SECONDS = 180

/** Shortest useful enrollment session, in seconds. */
export const MIN_SESSION_SECONDS = 60

/** Recommended enrollment session length, in seconds. */
export const RECOMMENDED_SESSION_SECONDS = 120

/** Length of a "Listen now" check, in seconds. */
export const CHECK_SECONDS = 30

/** Above this share of discarded windows a check has no verdict (section 6.4). */
export const MAX_DISCARDED_RATIO = 0.4

/** Level difference that triggers the placement warning, in dB. */
export const LEVEL_GUARD_DB = 6
