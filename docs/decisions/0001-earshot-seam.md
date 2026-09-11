# 0001 — Ship an earshot stub until earshot has a release

Status: superseded by the real dependency, 2026-09-11
Date: 2026-09-11

> earshot shipped v0.3.0 the same day. The stub was deleted and the app now
> depends on `github:ezar/earshot#v0.3.0`. The record is kept because the drift
> it predicted is exactly what happened: the real API splits capture from the
> engine, keeps the guards separate, names its statuses `normal`/`watch`/
> `anomalous` and scores in `[0, 1]`. See `docs/earshot-integration.md`.

## Context

The spec (section 7) says SteadyHum consumes the audio engine from GitHub:
`"earshot": "github:ezar/earshot#vX.Y.Z"`, always pinned to a release tag, never
a branch. Milestone M0 — the engine proving the math on MIMII and ToyADMOS —
happens in that repository, before M1 builds this one.

When this scaffold was created `ezar/earshot` held a single README. There is no
`package.json`, no source and no tag, so the dependency cannot be declared:
`pnpm install` would fail on an unresolvable specifier, and pinning a branch is
what the spec forbids.

## Decision

Declare no `earshot` dependency yet. Instead ship `src/audio/earshot-stub/`: a
statement of the public surface SteadyHum needs, in TypeScript, whose every
entry point throws `EarshotError('not-implemented')`. Alias the module specifier
`earshot` to it in `vite.config.ts`, `vitest.config.ts` and `tsconfig.app.json`,
so every import site is written exactly as it will be in production.

The app treats that single error code as "the engine is not wired up yet" and
says so in plain language on the enrollment and check screens, with the record
buttons disabled. It does not fake a recording, a score or a verdict.

## Consequences

- Everything that does not need audio is buildable, testable and shippable now:
  appliances, enrollment bookkeeping, history, profile import and export,
  settings, privacy, i18n, PWA install.
- The contract is a concrete target for earshot's M0 rather than prose. When the
  real package arrives, `pnpm typecheck` reports any drift instead of the app
  failing at runtime.
- The switch is mechanical and documented in `docs/earshot-integration.md`:
  add the pinned dependency, delete three alias entries, repoint two imports,
  delete the stub folder.
- Risk: the contract is a guess until earshot exists, so some drift is likely.
  It is a typed guess in one folder, which is the cheapest place for it to be
  wrong.

## Alternatives rejected

- **Pinning a branch** (`#main`): forbidden by the spec, and there is no source
  on that branch anyway.
- **`pnpm link ../earshot`**: the spec's answer for working against unreleased
  changes, and still the right tool for that. It does not help here — the linked
  repository has nothing to link to — and a link must never be committed.
- **Implementing the DSP in SteadyHum for now**: it would duplicate earshot's
  entire reason to exist and guarantee two divergent scorers.
