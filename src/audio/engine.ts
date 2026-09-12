/**
 * SteadyHum's single point of contact with the earshot audio engine.
 *
 * earshot splits the job in two here: a {@link Capture} owns the microphone and
 * emits PCM chunks, and an {@link Engine} runs the models in a worker, emitting
 * one {@link WindowResult} per analysis window with the guards' verdict already
 * attached. This module wires the two together and hands the app a single
 * subscribe-and-stop object.
 */
import { createCapture, createEngine, createGuards } from 'earshot'
import type { AppliedConstraints, GuardVerdict, WindowResult } from 'earshot'

import { workerUrl, workletUrl } from './entrypoints.ts'

/**
 * Where `pnpm models:fetch` puts the self-hosted model files.
 *
 * Built from `BASE_URL` so the app works both at a site root (Vercel) and under
 * a subpath (a GitHub Pages project site).
 */
const base = import.meta.env.BASE_URL

export const MODEL_URLS = {
  wasmBaseUrl: `${base}models/wasm`,
  classifierUrl: `${base}models/yamnet_classifier.tflite`,
  embedderUrl: `${base}models/yamnet_embedder.tflite`,
} as const

/** One analysis window plus the guard's opinion of it. */
export interface GuardedWindow {
  readonly window: WindowResult
  readonly guard: GuardVerdict
}

export interface Listening {
  /** What the browser actually applied; `unhonoured` lists the flags it kept on. */
  readonly appliedConstraints: AppliedConstraints
  /** Stops the microphone and resolves with every window produced. */
  stop: () => Promise<readonly GuardedWindow[]>
}

export type EngineAvailability =
  | { readonly kind: 'ready' }
  | { readonly kind: 'microphone-denied' }
  | { readonly kind: 'unsupported-browser' }
  | { readonly kind: 'model-load-failed' }
  | { readonly kind: 'error'; readonly message: string }

type EngineHandle = Awaited<ReturnType<typeof createEngine>>

let engine: Promise<EngineHandle> | null = null

/**
 * Creates the engine once and reuses it for the lifetime of the tab.
 *
 * `guards: {}` runs the guards inside the worker on earshot's own defaults —
 * the same thresholds `createGuards()` resolves on the main thread, so the
 * verdicts are unchanged. What changes is the cost: the engine skips the
 * embedder for windows the guards reject, and the embedder is over half the
 * per-window work. Those embeddings were being computed and then thrown away,
 * since a rejected window never reaches a profile or a score.
 */
function getEngine(): Promise<EngineHandle> {
  engine ??= createEngine({ workerUrl, models: MODEL_URLS, guards: {} })
  return engine
}

/** Drops the cached engine so the next call retries from scratch. */
export async function closeEngine(): Promise<void> {
  const pending = engine
  engine = null
  if (pending === null) return
  try {
    await (await pending).close()
  } catch {
    // An engine that never started has nothing to close.
  }
}

/**
 * Opens the microphone and streams guarded windows until `stop()` is called.
 *
 * @param onWindow Called once per analysis window, roughly every `HOP_SECONDS`.
 */
export async function listen(onWindow: (result: GuardedWindow) => void): Promise<Listening> {
  const instance = await getEngine()
  /*
   * The engine attaches a verdict to every window, so this is only ever used
   * if one arrives without one. earshot types `guard` as optional because the
   * engine omits it when no guards are configured, and documents this exact
   * fallback for that case.
   *
   * It must not be replaced by assuming acceptance: a window nobody vetted,
   * treated as clean, is a conversation or a television learned as the
   * machine's normal sound.
   */
  const fallback = createGuards()
  const collected: GuardedWindow[] = []

  const offWindow = instance.onWindow((window) => {
    const result: GuardedWindow = { window, guard: window.guard ?? fallback.check(window) }
    collected.push(result)
    onWindow(result)
  })

  const capture = await createCapture({ workletUrl })
  const offChunk = capture.onChunk((samples) => {
    void instance.push(samples)
  })

  return {
    appliedConstraints: capture.appliedConstraints,
    stop: async () => {
      offChunk()
      await capture.stop()
      offWindow()
      return collected
    },
  }
}

function classify(error: unknown): EngineAvailability {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return { kind: 'microphone-denied' }
    }
    if (error.name === 'NotFoundError' || error.name === 'NotSupportedError') {
      return { kind: 'unsupported-browser' }
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  // The engine loads its models on startup; that is the one failure worth
  // naming separately, because the fix is "check your connection once".
  if (/model|wasm|tflite|fetch/i.test(message)) return { kind: 'model-load-failed' }
  return { kind: 'error', message }
}

/** Brings the engine up and reports why it could not, if it could not. */
export async function probeEngine(): Promise<EngineAvailability> {
  if (!detectBrowserSupport().supported) return { kind: 'unsupported-browser' }
  try {
    await getEngine()
    return { kind: 'ready' }
  } catch (error) {
    engine = null
    return classify(error)
  }
}

/** Feature detection for the browser APIs the engine needs (section 7). */
export interface BrowserSupport {
  readonly audioWorklet: boolean
  readonly getUserMedia: boolean
  readonly wakeLock: boolean
  readonly notifications: boolean
  readonly supported: boolean
}

export function detectBrowserSupport(): BrowserSupport {
  const audioWorklet =
    typeof AudioWorkletNode !== 'undefined' && typeof globalThis.AudioContext !== 'undefined'
  const getUserMedia =
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  const wakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const notifications = typeof Notification !== 'undefined'
  return {
    audioWorklet,
    getUserMedia,
    wakeLock,
    notifications,
    supported: audioWorklet && getUserMedia,
  }
}
