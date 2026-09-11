/**
 * The public surface SteadyHum expects from the `earshot` package.
 *
 * This file is a *contract*, not an implementation. It exists so the app can be
 * written, typechecked and tested before `earshot` ships its first release, and
 * so `earshot`'s M0 has a concrete target to satisfy. When `earshot` is added as
 * a real dependency this whole folder is deleted and the imports keep working
 * unchanged; any drift between the two surfaces shows up as a type error.
 *
 * Every numeric member states its unit. See docs/earshot-integration.md.
 */

/** Sample rate the engine resamples to before any analysis, in Hz. */
export const SAMPLE_RATE_HZ = 16_000

/** Analysis window length, in seconds (YAMNet native framing). */
export const WINDOW_SECONDS = 0.975

/** Hop between consecutive analysis windows, in seconds (50% overlap). */
export const HOP_SECONDS = 0.4875

/** Dimensionality of one YAMNet embedding vector. */
export const EMBEDDING_DIMENSIONS = 1024

/** Band edges for the six interpretable energy bands, in Hz. */
export const BAND_EDGES_HZ = [20, 80, 250, 1_000, 3_000, 6_000, 8_000] as const

/** Number of interpretable energy bands (one fewer than the edge count). */
export const BAND_COUNT = 6

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * The audio constraints the browser actually applied, read back from the track
 * settings. Browsers are free to ignore `noiseSuppression: false`; when they do,
 * the signal we need is destroyed and the user must be warned.
 */
export interface AppliedAudioConstraints {
  readonly echoCancellation: boolean
  readonly noiseSuppression: boolean
  readonly autoGainControl: boolean
  /** Hardware sample rate reported by the track, in Hz. */
  readonly sampleRateHz: number
  /** True when all three processing flags came back off, as requested. */
  readonly honoured: boolean
}

// ---------------------------------------------------------------------------
// Per-window analysis results
// ---------------------------------------------------------------------------

/** One AudioSet class and its score in [0, 1]. */
export interface ClassScore {
  readonly label: string
  readonly score: number
}

/** A prominent spectral peak. */
export interface TonalPeak {
  readonly frequencyHz: number
  readonly prominenceDb: number
}

/** Why a window was rejected by the noise guard. */
export type InterferenceKind = 'speech' | 'music' | 'television' | 'animal' | 'other' | 'silence'

export interface Interference {
  readonly kind: InterferenceKind
  /** The AudioSet class that triggered the guard. */
  readonly label: string
  readonly score: number
}

/** The interpretable descriptors of section 6.5, computed per window. */
export interface WindowFeatures {
  /** Energy per band, in dBFS. Length is {@link BAND_COUNT}. */
  readonly bandEnergyDbfs: readonly number[]
  /** The three most prominent spectral peaks, strongest first. */
  readonly tonalPeaks: readonly TonalPeak[]
  /** Onsets per second from a spectral flux detector, in Hz. */
  readonly onsetRateHz: number
  /** Dominant periodicity of the onset envelope in Hz, or null when aperiodic. */
  readonly onsetPeriodicityHz: number | null
  /** Spectral flatness (Wiener entropy) in [0, 1]; higher is noisier. */
  readonly spectralFlatness: number
  /** Spectral centroid, in Hz. */
  readonly spectralCentroidHz: number
  /** Dominant amplitude modulation rate of the RMS envelope in Hz, or null. */
  readonly modulationRateHz: number | null
  /** Modulation depth in [0, 1]. */
  readonly modulationDepth: number
}

/** Everything the engine derives from a single {@link WINDOW_SECONDS} window. */
export interface AnalysisWindow {
  /** Offset from the start of the capture, in seconds. */
  readonly startSeconds: number
  /** Window RMS level, in dBFS. */
  readonly levelDbfs: number
  /** YAMNet embedding, length {@link EMBEDDING_DIMENSIONS}. */
  readonly embedding: Float32Array
  /** Top AudioSet classes, highest score first. */
  readonly topClasses: readonly ClassScore[]
  readonly features: WindowFeatures
  /** Non-null when the noise guard rejected this window. */
  readonly interference: Interference | null
}

// ---------------------------------------------------------------------------
// Profiles (the learned normal)
// ---------------------------------------------------------------------------

/** Distance percentiles within one enrolled state, in Mahalanobis units. */
export interface DistancePercentiles {
  readonly p50: number
  readonly p90: number
  readonly p95: number
  readonly p99: number
  readonly p995: number
}

/** Mean and spread of one scalar feature across an enrolled state. */
export interface ScalarBaseline {
  readonly mean: number
  readonly stdDev: number
}

/** The descriptor baseline of an enrolled state (section 6.5). */
export interface DescriptorBaseline {
  readonly bandEnergyDbfs: readonly ScalarBaseline[]
  readonly tonalPeaks: readonly TonalPeak[]
  readonly onsetRateHz: ScalarBaseline
  readonly onsetPeriodicityHz: ScalarBaseline | null
  readonly spectralFlatness: ScalarBaseline
  readonly spectralCentroidHz: ScalarBaseline
  readonly modulationRateHz: ScalarBaseline | null
  readonly modulationDepth: ScalarBaseline
}

/**
 * One discovered operating state of a machine (fill, wash, drain, dry...).
 * A single centroid would flag a dishwasher's drying phase as anomalous.
 */
export interface StateModel {
  readonly id: string
  /** Cluster centroid, length {@link EMBEDDING_DIMENSIONS}. */
  readonly centroid: readonly number[]
  /** Diagonal covariance with shrinkage, length {@link EMBEDDING_DIMENSIONS}. */
  readonly variance: readonly number[]
  readonly distances: DistancePercentiles
  /** Enrollment RMS distribution, in dBFS, used by the level guard. */
  readonly level: ScalarBaseline
  readonly descriptors: DescriptorBaseline
  readonly windowCount: number
}

/** A learned normal for one appliance. Serializable; SteadyHum persists it. */
export interface Profile {
  /** Bumped on every enrollment change. Checks record the version they used. */
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly states: readonly StateModel[]
  /** Threshold margin in z units, tuned by user verdicts (section 6.7). */
  readonly marginZ: number
  /** Total clean audio behind this profile, in seconds. */
  readonly cleanSeconds: number
  readonly sessionCount: number
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type CheckStatus = 'normal' | 'slightly-different' | 'different' | 'unusable'

export type DescriptorKind =
  | 'band-energy'
  | 'tonal-peak'
  | 'onset-periodicity'
  | 'spectral-flatness'
  | 'spectral-centroid'
  | 'amplitude-modulation'

export type DescriptorDirection = 'more' | 'less' | 'new' | 'gone'

/** One way in which the check differs from the matched state's baseline. */
export interface Descriptor {
  readonly kind: DescriptorKind
  readonly direction: DescriptorDirection
  /** How far past its own tolerance the change went, in tolerance units. */
  readonly magnitude: number
  /**
   * Kind-specific numbers for the UI copy: `bandIndex`, `frequencyHz`,
   * `prominenceDb`, `rateHz`, `deltaDb`. Units are in the key names.
   */
  readonly detail: Readonly<Record<string, number>>
}

export type Confidence = 'low' | 'medium' | 'high'

export interface CheckResult {
  readonly status: CheckStatus
  /** 90th percentile of window z-scores, clipped to [0, 8]. */
  readonly score: number
  readonly confidence: Confidence
  /** The enrolled state the check matched, or null when nothing matched. */
  readonly matchedStateId: string | null
  /** True when every state was beyond p99.5: possibly an unenrolled phase. */
  readonly unmatchedState: boolean
  /** Fraction of windows dropped by the noise guard, in [0, 1]. */
  readonly discardedRatio: number
  /** Check RMS minus the matched state's enrollment RMS, in dB. */
  readonly levelDeltaDb: number
  readonly descriptors: readonly Descriptor[]
  readonly profileVersion: number
  /** Per-window z-scores, for the timeline and the trend chart. */
  readonly windowScores: readonly number[]
}

/** What the user said about a verdict (section 6.7). */
export type UserVerdict = 'actually-fine' | 'actually-broken' | 'not-sure'

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface EngineOptions {
  /** URL of earshot's inference worker, from a `?worker&url` import. */
  readonly workerUrl: string
  /** URL of earshot's capture worklet, from a `?worker&url` import. */
  readonly workletUrl: string
  /** Base URL of the self-hosted YAMNet task files, e.g. `/models/`. */
  readonly modelsBaseUrl: string
  /** Base URL of the MediaPipe WASM runtime. */
  readonly wasmBaseUrl: string
}

export interface CaptureOptions {
  /** Stop automatically after this many seconds. Omit to run until stopped. */
  readonly maxSeconds?: number
  /** Preferred input device. */
  readonly deviceId?: string
}

export interface Capture {
  readonly appliedConstraints: AppliedAudioConstraints
  /** Returns an unsubscribe function. Windows arrive every {@link HOP_SECONDS}. */
  subscribe(listener: (window: AnalysisWindow) => void): () => void
  /** Stops capture and resolves with every window produced. */
  stop(): Promise<readonly AnalysisWindow[]>
}

export interface Engine {
  startCapture(options?: CaptureOptions): Promise<Capture>
  close(): Promise<void>
}

export interface LearnOptions {
  /** Minimum windows a k-means cluster needs to become a state. Default 15. */
  readonly minWindowsPerState?: number
  /** Upper bound on discovered states. Default 6. */
  readonly maxStates?: number
}

export interface ScoreOptions {
  /** Overrides the profile's tuned margin, in z units. */
  readonly marginZ?: number
}

/** Error codes earshot raises. `not-implemented` is only ever thrown by the stub. */
export type EarshotErrorCode =
  | 'not-implemented'
  | 'microphone-denied'
  | 'unsupported-browser'
  | 'model-load-failed'
  | 'not-enough-audio'

export class EarshotError extends Error {
  readonly code: EarshotErrorCode

  constructor(code: EarshotErrorCode, message: string) {
    super(message)
    this.name = 'EarshotError'
    this.code = code
  }
}
