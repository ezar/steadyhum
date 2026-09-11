# Consuming earshot

SteadyHum has no audio code of its own. Capture, resampling, feature extraction,
the YAMNet wrappers, k-means, profile learning, scoring and the interpretable
descriptors all live in [`earshot`](https://github.com/ezar/earshot), the
framework-agnostic engine shared with Meowlogue. SteadyHum contributes the UI,
the persistence and the copy; `earshot` stays free of React and of storage and
returns serializable objects.

## Current state

At the time this scaffold was written `ezar/earshot` contained only a README:
no source, no `package.json`, no release tag. There is therefore nothing to
install and nothing to pin, so the app ships a **stub** that satisfies the
contract and throws `EarshotError('not-implemented')` from every entry point.
The UI detects that one error code and says plainly that listening is not
available yet; nothing pretends to record.

Everything that does not need audio — appliances, enrollment bookkeeping,
history, profile import and export, settings, privacy, i18n, offline install —
works today.

## The seam

Three files, and nothing else, know that the stub exists:

| File                       | Role                                                     |
| -------------------------- | -------------------------------------------------------- |
| `src/audio/earshot-stub/`  | The stub package and the contract it implements          |
| `src/audio/entrypoints.ts` | The `?worker&url` imports for the worker and the worklet |
| `src/audio/engine.ts`      | The only module in the app that imports `earshot`        |

Every other module imports types and functions from `'earshot'` exactly as it
will once the real package is installed.

## Switching to the real package

When `earshot` tags its first release:

1. `pnpm add earshot@github:ezar/earshot#v0.1.0` — always a release tag, never a
   branch. `earshot` ships TypeScript source (its `exports` point at `src/`), so
   there is no build step and no install scripts, which keeps pnpm 10 happy.
2. Delete the `earshot` alias in `vite.config.ts` and in `vitest.config.ts`, and
   the `earshot` entry under `paths` in `tsconfig.app.json`.
3. Point `src/audio/entrypoints.ts` at the real entry points:

   ```ts
   import workerUrl from 'earshot/worker?worker&url'
   import workletUrl from 'earshot/worklet?worker&url'
   ```

4. Delete `src/audio/earshot-stub/`.
5. `pnpm typecheck`. Anything that comes back is real contract drift between
   what SteadyHum expects and what `earshot` shipped — fix it in whichever
   repository is wrong, and record the decision if the spec changes.

`earshot` stays in `optimizeDeps.exclude`: pre-bundling TypeScript source would
break the worker and worklet entry points.

## The contract

`src/audio/earshot-stub/contract.ts` is the authoritative statement of what
SteadyHum needs, with units on every numeric member. In summary:

**Constants** — `SAMPLE_RATE_HZ` (16 000), `WINDOW_SECONDS` (0.975),
`HOP_SECONDS` (0.4875), `EMBEDDING_DIMENSIONS` (1024), `BAND_EDGES_HZ`.

**Capture** — `createEngine({ workerUrl, workletUrl, modelsBaseUrl, wasmBaseUrl })`
resolves to an `Engine`. `engine.startCapture()` resolves to a `Capture` that
exposes `appliedConstraints` (so the app can warn when the browser ignored
`noiseSuppression: false`), `subscribe(listener)` for live windows, and `stop()`
for the full list.

**Per window** — an `AnalysisWindow` carries `startSeconds`, `levelDbfs`, the
1024-dimensional `embedding`, `topClasses`, the interpretable `features` of
section 6.5, and `interference` (non-null when the noise guard rejected it).
Raw audio never reaches the main thread.

**Learning** — `learnProfile(sessions, options)` returns a `Profile`: discovered
states with centroid, diagonal variance, distance percentiles, enrollment level
distribution and descriptor baseline, plus `marginZ`, `cleanSeconds` and a
`version` that every check records.

**Scoring** — `scoreCheck(profile, windows)` returns a `CheckResult` with
`status`, `score` (the 90th percentile of window z-scores), `confidence`,
`matchedStateId`, `unmatchedState`, `discardedRatio`, `levelDeltaDb`, the
`descriptors` that fired, and the per-window scores for the timeline.

**Feedback** — `applyVerdict(profile, check, verdict)` returns the widened or
tightened profile of section 6.7.

All of it is plain data. SteadyHum stores it with Dexie; `earshot` never sees
IndexedDB.
