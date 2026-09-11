# 0004 — Patch earshot's MediaPipe loader at build time

Status: superseded by earshot v0.4.0, 2026-09-11
Date: 2026-09-11

> earshot v0.4.0 fixed both halves upstream, which was always the right place:
> its default loader now imports `@mediapipe/tasks-audio` statically, and its
> default `createWorker` builds a classic worker. The Vite plugin and the
> `createWorker` override are deleted. What survives is `worker.format: 'iife'`
> — now earshot's own documented requirement rather than this project's
> deviation — and the targeted `assetsInlineLimit` for the capture worklet.

## Context

earshot's `defaultTasksAudioLoader` holds its specifier in a variable behind a
`@vite-ignore` comment:

```ts
const specifier = '@mediapipe/tasks-audio'
const module: unknown = await import(/* @vite-ignore */ specifier)
```

That is deliberate — it keeps earshot free of a hard MediaPipe dependency — and
its README tells Vite apps to pass their own `loadTasksAudio` instead. But the
models are constructed inside the engine Worker, `EngineOptions.models` is typed
`Omit<ModelUrls, 'loadTasksAudio'>`, and a function cannot cross `postMessage`
anyway. There is no supported way to hand the Worker a loader.

Left alone, the built Worker carries `import('@mediapipe/tasks-audio')` into the
browser, which cannot resolve a bare specifier: the engine dies at startup with
`Failed to resolve module specifier '@mediapipe/tasks-audio'`. Import maps do
not help, because they do not apply to workers.

## Decision

A Vite plugin, `steadyhum:earshot-static-mediapipe`, rewrites those two lines to
a static `import('@mediapipe/tasks-audio')` so the bundler can resolve and
include MediaPipe in the worker chunk. It is registered in `worker.plugins` —
worker bundles do not inherit the top-level plugin list, and this is the only
place the code is reachable from.

The plugin **throws** if earshot's loader no longer matches the expected text,
rather than silently doing nothing: a patch that quietly stops applying would
resurface as a runtime failure in a Worker.

Two related settings come with it:

- `worker.format: 'iife'`, against earshot's README suggestion of `'es'`.
  MediaPipe's WASM loader brings itself in with `importScripts`, which does not
  exist in a module worker; there it fetches the loader and then fails with
  `ModuleFactory not set`. earshot's `createWorker` hook exists precisely so the
  host can decide, and `src/audio/engine.ts` constructs a classic `Worker` to
  match.
- `build.assetsInlineLimit` returns `false` for `capture-worklet` only.
  `audioWorklet.addModule` is handed the URL directly and `data:` URL support
  there is uneven; Safari on iOS is exactly the browser this app cannot afford
  to guess about. Everything else keeps Vite's default inlining.

## Consequences

- SteadyHum carries a small, loud patch against a dependency. Delete the plugin
  and revert `worker.format` once earshot can be given a loader, or imports
  MediaPipe itself.
- Worth raising upstream: earshot's own primary consumer cannot use its default
  loader under the bundler earshot documents.

## Alternatives rejected

- **Reimplementing the Worker from earshot's primitives.** earshot exports
  `createClassifier`, `createEmbedder` and `createFeatureExtractor`, all of which
  accept `loadTasksAudio`, so SteadyHum could run its own worker protocol. That
  duplicates the thing earshot exists to own and guarantees drift.
- **Running the models on the main thread.** Supported, and it breaks the
  performance budget in section 7: the UI has to stay at 60 fps while recording.
