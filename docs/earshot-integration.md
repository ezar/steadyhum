# Consuming earshot

SteadyHum has no audio code of its own. Capture, resampling, feature extraction,
the YAMNet wrappers, k-means, profile learning, scoring and the interpretable
descriptors all come from [`earshot`](https://github.com/ezar/earshot), the
framework-agnostic engine shared with Meowlogue. SteadyHum contributes the UI,
the persistence and the copy; earshot stays free of React and of storage and
returns plain serializable objects.

The dependency is pinned to a release tag, never a branch:

```jsonc
{ "dependencies": { "earshot": "github:ezar/earshot#v0.3.0" } }
```

earshot ships TypeScript source — its `exports` point at `src/` — so there is no
build step and no install scripts. This project typechecks those sources under
`strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, and they
compile clean.

## Where the two projects meet

| SteadyHum                  | What it does                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/audio/entrypoints.ts` | The `?worker&url` and `?url` imports of earshot's worker and capture worklet                                               |
| `src/audio/engine.ts`      | The only module that imports `earshot` for the engine; wires capture, engine and guards into one subscribe-and-stop object |
| `src/audio/useRecorder.ts` | Drives one recording session and exposes the live meters                                                                   |
| `src/db/record.ts`         | Turns finished recordings into stored rows, and calls `learnProfile`, `scoreCheck`, `describeDifference` and `calibrate`   |

Everything else in the app touches earshot only through its types.

## The shape of the API, as used here

- **Capture and engine are separate.** `createCapture({ workletUrl })` owns the
  microphone and emits PCM chunks; `createEngine({ workerUrl, models })` runs
  the models in a Worker and emits one `WindowResult` per analysis window.
  `src/audio/engine.ts` joins them.
- **Guards are a third thing.** `createGuards()` judges each window
  (`silence`, `too-loud`, `interference`, `clipping`). earshot scores whatever it
  is given; deciding a recording was too spoiled to show a verdict is
  SteadyHum's call, and lives in `StoredCheck.unusable`.
- **Status has three values**: `normal`, `watch`, `anomalous`. The UI's
  "Unusable" is SteadyHum's own fourth state, not earshot's.
- **Scores are in `[0, 1]`**, not z units. Everything the profile heard while
  learning maps into `[0, 0.5]`; the top half is reserved for distances it never
  saw.
- **Descriptors carry structure, not just prose.** Each has `feature`,
  `direction`, `zScore`, `value`, `reference` and `unit` as well as an English
  `text`. `src/ui/DescriptorList.tsx` rebuilds the sentence from the structured
  fields so UI copy stays in the dictionaries; `text` is only the fallback for a
  feature this app has no phrasing for yet.
- **Everything is JSON.** Embeddings are `readonly number[]`, and earshot's own
  `quantize`/`dequantize` take them to and from int8 for storage.
- **Profiles version themselves.** `schemaVersion` is checked on import;
  `revision` is bumped by every `calibrate` and recorded on each check.

## Models

earshot never hardcodes a model or WASM location, and nothing is fetched from a
CDN at runtime. `pnpm models:fetch` puts everything under `public/models/`:

```
public/models/
  wasm/                      copied from the installed @mediapipe/tasks-audio
  yamnet_classifier.tflite   downloaded, SHA-256 pinned in manifest.json
  yamnet_embedder.tflite     downloaded, SHA-256 pinned in manifest.json
```

Only `manifest.json` is committed; the ~36 MB of binaries are not. They are
cached by the service worker on first use rather than precached on install.

## Two things that will bite

Both are written up in full under `docs/decisions/`:

1. **MediaPipe is pinned at 0.10.21**, exactly, because `AudioEmbedder` is gone
   from 0.10.34 onwards and the whole profile design depends on it
   (`0003-mediapipe-is-pinned-for-the-audio-embedder.md`).
2. **earshot's MediaPipe loader is patched at build time**, because its Worker
   cannot be handed a `loadTasksAudio` and the bare specifier does not resolve in
   a browser. The Vite plugin throws if earshot's source stops matching, and the
   worker is built as a classic script so MediaPipe's `importScripts` works
   (`0004-earshot-mediapipe-loader-is-patched-at-build-time.md`).

## Working against an unreleased earshot

`pnpm link ../earshot` locally, and never commit the link. Then tag a release in
earshot and bump the tag here.
