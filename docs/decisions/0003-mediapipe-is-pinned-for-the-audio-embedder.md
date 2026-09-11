# 0003 — Pin @mediapipe/tasks-audio at 0.10.21 for the audio embedder

Status: accepted
Date: 2026-09-11

## Context

Section 6.1 makes the YAMNet embedder the primary representation: profiles are
learned and scored in a 1024-dimensional embedding space. earshot gets that
embedder from `@mediapipe/tasks-audio`.

Installing the current release (0.10.35) produced, deep inside the engine
Worker, `Cannot read properties of undefined (reading 'createFromOptions')`.
`AudioEmbedder` is absent from that build — it is in neither `audio_bundle.mjs`
nor `audio.d.ts`. Walking the published versions: it is present up to and
including **0.10.21**, 0.10.22–0.10.33 were never published, and it is gone from
0.10.34, 0.10.35 and 1.0.1. `AudioClassifier` and `FilesetResolver` stayed.

earshot v0.3.0 reached the same conclusion independently and now exports
`EMBEDDER_MAX_VERSION = '0.10.21'`, throwing a readable error instead of the
undefined-property crash.

## Decision

Pin `"@mediapipe/tasks-audio": "0.10.21"` — an exact version, not a range. A
caret would resolve to 0.10.35 and break profile learning at runtime, on a code
path no typecheck reaches.

`pnpm models:fetch` copies the MediaPipe WASM runtime out of the installed
package rather than downloading it, so the runtime can never drift from the
version the app was built against.

## Consequences

- `pnpm outdated` will keep reporting MediaPipe as behind. It is pinned on
  purpose; this record is the answer.
- Before changing the pin, check that the target version still exports
  `AudioEmbedder`, and compare against earshot's `EMBEDDER_MAX_VERSION`.
- Newer MediaPipe fixes and any new classifier features are forgone until either
  MediaPipe restores the embedder or the embedding space is replaced.

## Alternatives rejected

- **Latest MediaPipe, learning in the feature space.** earshot supports it, but
  it trades the representation the whole design rests on for a version number,
  and the evaluation in section 6.8 was not run against it.
- **A caret range with a runtime check.** The failure would reappear on any
  fresh install, in a Worker, only once a user tried to learn a profile.
