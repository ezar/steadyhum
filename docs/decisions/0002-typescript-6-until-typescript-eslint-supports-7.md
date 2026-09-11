# 0002 — Hold TypeScript at 6 until typescript-eslint supports 7

Status: accepted
Date: 2026-09-11

## Context

The project tracks the latest version of every dependency. TypeScript 7.0.2 is
the current release — the native port — and `pnpm outdated` reports it.

It cannot be adopted yet. `typescript-eslint` declares:

```
"peerDependencies": { "typescript": ">=4.8.4 <6.1.0" }
```

That is its latest published range, so TypeScript 7 is out of bounds for the
whole lint setup, including the 70 type-aware rules the project relies on. The
newest TypeScript inside the range is 6.0.3.

## Decision

Pin `typescript` at `^6.0.3` and leave everything else at its latest release.
`pnpm outdated` will keep reporting TypeScript as behind; that is expected and
this record is the answer.

Two forward-looking changes came with the move to 6:

- `baseUrl` is removed from `tsconfig.app.json`. TypeScript 6 deprecates it with
  an error and 7 drops it. The `paths` entries are now written relative to the
  config file, which is what 7 expects anyway.
- Nothing in `src/` needed changing. The strict flags, including
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, behave the same.

## Consequences

- Lint keeps its type-aware rules, which is the point of the setup.
- When `typescript-eslint` widens its peer range, the upgrade should be a
  one-line version bump plus a typecheck. Re-check it whenever the lint stack
  is touched.
- Do not silence the situation with `ignoreDeprecations` or by loosening the
  peer range with an override: both would hide a real incompatibility rather
  than record it.

## Alternatives rejected

- **TypeScript 7 with a peer-dependency override.** typescript-eslint parses
  TypeScript's AST through its compiler API; running it against a major it does
  not claim to support risks wrong lint results, which is worse than no lint.
- **TypeScript 7 and dropping type-aware lint.** That trades a working safety
  net for a version number.
