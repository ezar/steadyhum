# SteadyHum

Your appliances have a normal. SteadyHum learns it and tells you when it changes.

A PWA that listens to a washing machine, dishwasher, fridge, boiler, heat pump
or air conditioner through the phone microphone, learns what that specific
machine sounds like when it is healthy, and later tells you whether it still
sounds the same, how it differs, and what people usually check when a machine
starts sounding like that.

Everything runs in the browser. **No audio ever leaves the phone.** There are no
accounts, no server and no analytics; the only network requests are the app
itself and the models.

SteadyHum never claims to know what is broken. It knows when something changed,
and it describes the change in words a person can act on. See
[`docs/steadyhum-spec.md`](docs/steadyhum-spec.md) for the full specification —
it is the source of truth, this README is the map.

## The audio engine lives in earshot

SteadyHum has no DSP of its own. Capture, resampling, feature extraction, the
YAMNet wrappers, k-means, profile learning, scoring and the interpretable
descriptors all come from [`earshot`](https://github.com/ezar/earshot), the
framework-agnostic engine shared with Meowlogue.

The dependency is pinned to a release tag, never a branch:
`"earshot": "github:ezar/earshot#v0.5.0"`.

Two constraints come with it, both written up under `docs/decisions/`:
`@mediapipe/tasks-audio` is pinned at exactly 0.10.21 because MediaPipe dropped
`AudioEmbedder` after it, and `worker.format` must be `iife` because MediaPipe
loads its WASM glue with `importScripts`, which module workers do not have.

Read [`docs/earshot-integration.md`](docs/earshot-integration.md) for how the
two projects meet.

## Getting started

```sh
pnpm install
pnpm dev
```

| Command                     | What it does                                              |
| --------------------------- | --------------------------------------------------------- |
| `pnpm dev`                  | Vite dev server                                           |
| `pnpm build`                | Typecheck and build                                       |
| `pnpm vercel-build`         | Fetch the models, then build (used by the deployment)     |
| `pnpm test`                 | Unit tests (Vitest)                                       |
| `pnpm e2e`                  | Smoke test of the main flow (Playwright, fake microphone) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                         |
| `pnpm models:fetch`         | Download the YAMNet task files into `public/models/`      |

Models are not committed: `public/models/manifest.json` pins them by URL and
SHA-256 and `pnpm models:fetch` verifies each download.

## Layout

```
src/
  audio/        the earshot boundary: entry points, engine wrapper, recorder hook
  db/           Dexie schema, repository, recording persistence, profile transfer
  i18n/         Spanish (default) and English dictionaries; no hardcoded UI copy
  screens/      Home, add appliance, enrollment, check, appliance detail, settings
  store/        Zustand settings
  ui/           design system components: ring, level meter, chips, cards
docs/           spec, earshot contract, field test protocol, decision records
scripts/        model fetching and checksum verification
```

## Conventions

- Code, comments, identifiers, commit messages and docs in English. UI copy lives
  only in `src/i18n/*.json`, Spanish first.
- TypeScript strict everywhere, including workers, with `noUncheckedIndexedAccess`.
  No `any`.
- Numeric code names its units: `SAMPLE_RATE_HZ`, `WINDOW_SECONDS`, `HOP_SECONDS`.
- Every algorithm in section 6 of the spec gets a unit test against a synthetic
  fixture before it gets a UI. Those fixtures live in `earshot`.
- Conventional commits, one milestone per branch. When an approach in the spec
  turns out to be impossible or worse in practice, write a decision record in
  `docs/decisions/` — never deviate silently.

## Status

- **M0** (earshot proves the math) — not started, in the `earshot` repository.
- **M1** (core loop) — working end to end: add an appliance, learn its normal
  across sessions, run a 30 second check, read the verdict and its descriptors,
  answer the feedback chips. Verified in Chromium with a fake microphone.
  Not yet field-tested against a real appliance — that is `docs/field-test.md`.
- M2–M4 — not started.

## Deployment

Static, no backend. `pnpm vercel-build` fetches the models and builds for a site
root. A GitHub Pages workflow (`.github/workflows/deploy.yml`) builds the same
output for a subpath: `BASE_PATH` feeds Vite's `base`, model URLs derive from
`import.meta.env.BASE_URL`, and a copy of `index.html` at `404.html` gives the
SPA its deep links back, since Pages has no rewrite rules.

SteadyHum is consumer information, not professional advice. It does not diagnose
faults, and gas appliances must always be checked by a certified technician.
