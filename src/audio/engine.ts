/**
 * SteadyHum's single point of contact with the earshot audio engine.
 *
 * Nothing else in the app imports `earshot` directly, so the day the real
 * package replaces the stub there is one file to look at.
 */
import { EarshotError, createEngine } from 'earshot'
import type { Engine } from 'earshot'

import { workerUrl, workletUrl } from './entrypoints.ts'

/** Where `pnpm models:fetch` puts the self-hosted YAMNet task files. */
export const MODELS_BASE_URL = '/models/'

/** Where the MediaPipe WASM runtime is served from. Never a third-party CDN. */
export const WASM_BASE_URL = '/models/wasm/'

export type EngineAvailability =
  | { readonly kind: 'ready' }
  /** earshot is not installed yet; the stub answered. */
  | { readonly kind: 'not-installed' }
  | { readonly kind: 'microphone-denied' }
  | { readonly kind: 'unsupported-browser' }
  | { readonly kind: 'model-load-failed' }
  | { readonly kind: 'error'; readonly message: string }

let engine: Promise<Engine> | null = null

/** Creates the engine once and reuses it for the lifetime of the tab. */
export function getEngine(): Promise<Engine> {
  engine ??= createEngine({
    workerUrl,
    workletUrl,
    modelsBaseUrl: MODELS_BASE_URL,
    wasmBaseUrl: WASM_BASE_URL,
  })
  return engine
}

/** Drops the cached engine so the next call retries from scratch. */
export async function closeEngine(): Promise<void> {
  const pending = engine
  engine = null
  if (pending === null) return
  try {
    const instance = await pending
    await instance.close()
  } catch {
    // An engine that never started has nothing to close.
  }
}

function classify(error: unknown): EngineAvailability {
  if (error instanceof EarshotError) {
    switch (error.code) {
      case 'not-implemented':
        return { kind: 'not-installed' }
      case 'microphone-denied':
        return { kind: 'microphone-denied' }
      case 'unsupported-browser':
        return { kind: 'unsupported-browser' }
      case 'model-load-failed':
        return { kind: 'model-load-failed' }
      case 'not-enough-audio':
        return { kind: 'error', message: error.message }
    }
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { kind: 'microphone-denied' }
  }
  return { kind: 'error', message: error instanceof Error ? error.message : String(error) }
}

/** Tries to bring the engine up and reports why it could not, if it could not. */
export async function probeEngine(): Promise<EngineAvailability> {
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
