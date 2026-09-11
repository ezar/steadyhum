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

**`earshot` has no release yet**, so the app currently ships a typed stub in
`src/audio/earshot-stub/` that states the contract and refuses to pretend: the
enrollment and check screens say plainly that listening is unavailable and leave
the record buttons disabled. Everything that does not need audio works.

Read [`docs/earshot-integration.md`](docs/earshot-integration.md) for the
contract and the mechanical switch to the real package, and
[`docs/decisions/0001-earshot-seam.md`](docs/decisions/0001-earshot-seam.md) for
why it was done this way.

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
  audio/        the earshot seam: contract, stub, entry points, engine wrapper
  db/           Dexie schema, repository, embedding quantization, profile transfer
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
- **M1** (core loop) — scaffold in place: appliances, enrollment bookkeeping,
  history, trend, profile import and export, settings, privacy, i18n, PWA.
  Recording and scoring wait on M0.
- M2–M4 — not started.

SteadyHum is consumer information, not professional advice. It does not diagnose
faults, and gas appliances must always be checked by a certified technician.
