import type {
  Descriptor,
  GuardReason,
  Profile,
  QuantizedEmbedding,
  Status,
  Verdict,
  WindowResult,
} from 'earshot'

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

/** A learned normal. One row per revision; exactly one is active per appliance. */
export interface StoredProfile {
  readonly id: string
  readonly applianceId: string
  /** Mirrors `profile.revision`, which every calibration bumps. */
  readonly revision: number
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
 * One analysis window, with its embedding quantized for storage.
 *
 * earshot hands back a 1024-float embedding for an accepted window; int8
 * quantization takes it from 4 KB to about 1 KB, which is what keeps a two
 * hour watch session (roughly 15k windows) inside the storage budget of
 * section 7. Window-level rows are pruned after
 * {@link WINDOW_RETENTION_DAYS}; the aggregates in `checks` are kept forever.
 *
 * A **rejected** window stores no embedding at all — `dimensions` is 0 — since
 * the engine's guards run in the worker and it skips the embedder for windows
 * it rejects. Nothing is lost: a rejected window never reaches a profile or a
 * score. But that makes an invariant load-bearing rather than merely tidy:
 * **read an embedding back only from rows whose `rejectedFor` is empty.**
 * `cleanWindows` in `record.ts` is the one place that does, and the one place
 * that should.
 */
export interface StoredWindow {
  readonly id?: number
  readonly sessionId: string
  /** The window minus its embedding, which is stored quantized alongside. */
  readonly window: Omit<WindowResult, 'embedding'>
  /** Empty (`dimensions: 0`) when {@link rejectedFor} is not empty. */
  readonly embedding: QuantizedEmbedding
  /** Guard rejection reasons; empty when the window was accepted. */
  readonly rejectedFor: readonly GuardReason[]
}

/**
 * A finished check.
 *
 * `status` is earshot's verdict; `unusable` is SteadyHum's own, decided from
 * the share of windows the guards rejected. earshot scores what it is given and
 * does not judge whether the recording was worth scoring.
 */
export interface StoredCheck {
  readonly id: string
  readonly applianceId: string
  readonly sessionId: string
  /** The profile revision this check was scored against. */
  readonly profileRevision: number
  readonly status: Status
  /** True when too much of the recording was discarded to trust the verdict. */
  readonly unusable: boolean
  /** Anomaly score in [0, 1]. */
  readonly score: number
  readonly dominantStateId: string
  /** Share of windows at or above the anomalous threshold, in [0, 1]. */
  readonly anomalousFraction: number
  /** Check level minus the profile's learned level, in dB. */
  readonly levelDeltaDb: number
  /** Share of windows the guards rejected, in [0, 1]. */
  readonly discardedRatio: number
  readonly descriptors: readonly Descriptor[]
  readonly verdict: UserVerdict | null
  readonly createdAt: string
}

/**
 * What the user said about a verdict.
 *
 * earshot's {@link Verdict} has two values because only those two teach it
 * anything; "not sure" is recorded for the user's own history and never fed
 * back into the profile.
 */
export type UserVerdict = Verdict | 'not-sure'

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
  readonly verdict: Verdict
  /** Profile revision before and after the calibration, so it can be undone. */
  readonly previousRevision: number
  readonly nextRevision: number
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
