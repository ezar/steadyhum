# SteadyHum

Your appliances have a normal. SteadyHum learns it and tells you when it changes.

A web app (PWA) that listens to a washing machine, dishwasher, fridge, boiler, heat pump or air conditioner with the phone microphone, learns what that specific machine sounds like when it is healthy, and later tells you whether it still sounds the same, how it differs, and what people usually check when a machine starts sounding like that. Everything runs in the browser. No audio ever leaves the phone.

Name: SteadyHum. Repository: `steadyhum`. The shared audio engine lives in its own repository, `earshot`, and is consumed from GitHub (see section 7 and `earshot-spec.md`).

This document is the single source of truth for Claude Code (implementation) and Claude Design (visual design). Read it fully before writing any code or designing any screen.

---

## 1. Why this exists

- Nobody knows what "sounds wrong" means for their own appliances. People notice a new noise weeks after it started, when the bearing is already gone.
- Existing "AI sound diagnosis" apps target cars and try to name the fault from a single recording. That is not credible for a random appliance in a random kitchen with a random phone.
- What is credible, and what industry does with expensive sensors, is anomaly detection against a machine's own baseline. SteadyHum brings that to a phone: it does not claim to know what is broken, it knows when something changed, and it describes the change in words a person can act on.
- The maker is a CTO with 20+ years in industrial software. Acoustic condition monitoring is a known industrial pattern (DCASE anomalous sound detection tasks, MIMII and ToyADMOS datasets). SteadyHum is the consumer version of that pattern.

## 2. Product principles

- Honest by construction. SteadyHum never says "your bearing is broken". It says "this sounds different from the normal I learned on March 3rd: there is a new tonal whine near 2.1 kHz. Common causes people check: ...". Confidence is always visible.
- Local first, private by default. Audio is processed on device. Raw audio is not stored unless the user explicitly keeps a clip. Nothing is uploaded, ever. No accounts.
- Works in a real kitchen. The app must cope with the phone being held at a slightly different distance, the TV in the next room, and a dishwasher that has five distinct phases.
- One machine, one baseline. The normal is per appliance, learned by the user, not a generic model of "washing machines".
- Delightful, not clinical. The core loop (hold the phone near the machine, watch a ring fill, get a verdict) should feel like Shazam for machine health.

## 3. Scope

### In scope for v1

- Add an appliance (type, name, placement notes).
- Learn its normal: guided enrollment sessions that capture the machine across its working states.
- Listen now: a 30 second check that returns Normal, Slightly different or Different, with an explanation of how it differs.
- Watch mode: continuous listening for a whole cycle with a score timeline and drift alerts.
- History per appliance, with user verdicts (was it actually fine, was it actually broken) that improve thresholds.
- Export and import of appliance profiles (JSON) so a second phone in the household can reuse the learned normal.
- Spanish and English UI.

### Out of scope for v1

- Naming a specific fault with certainty (see principles).
- Cloud sync, accounts, sharing between households.
- A generic pretrained model of "healthy washing machine" (no data, and it would be wrong for most machines).
- Background listening with the screen off (browsers do not allow it reliably on iOS; Watch mode keeps the screen on with a wake lock and a dimmed UI).
- Native apps.

## 4. Users and stories

Primary user: a home owner or renter who wants an early warning before an appliance dies, and who is willing to spend two minutes teaching the app what normal sounds like.

- As a home owner, I want to teach SteadyHum what my washing machine sounds like when it is fine, so that later I can check whether it still sounds the same.
- As a home owner, I want a 30 second check with a clear verdict, so that I do not have to interpret spectrograms.
- As a home owner, I want SteadyHum to tell me how the sound differs (deeper hum, new whine, knocking), so that I can describe the problem to a technician or search for it.
- As a home owner, I want SteadyHum to tell me when the recording is unusable (TV on, someone talking, too far from the machine), so that I do not get false alarms.
- As a home owner, I want to leave the phone next to the boiler during a full cycle, so that SteadyHum catches a noise that only appears in one phase.
- As a home owner, I want to mark a verdict as wrong or right, so that SteadyHum becomes more accurate for my machine.
- As a household member, I want to import the profile my partner already learned, so that I do not have to enroll the machine again.
- As a Home Assistant user (P2), I want SteadyHum to publish checks to my broker, so that my home dashboard shows appliance health.

## 5. Experience

### 5.1 Core flows

Add appliance

- Pick a type from a grid (washing machine, dryer, dishwasher, fridge or freezer, boiler or water heater, heat pump or AC outdoor unit, AC indoor unit, extractor hood, other). The type only affects icons, placement tips and default state count. It does not affect the model.
- Name it. Optional placement note ("phone on the shelf left of the machine, at chest height").

Learn the normal (enrollment)

- The app explains in one screen: "Record the machine three times while it is working well, ideally in different moments of its cycle. Hold the phone in the same spot each time."
- Each session is 60 seconds minimum, 120 recommended. A live level meter and a "keep going" ring show progress. Speech, music and TV are detected live and the ring pauses with a hint ("I hear a voice, wait a moment").
- After each session the app shows what it discovered: "I found 2 distinct sound states in this recording" with a tiny timeline strip colored by state. This is the moment where the product feels intelligent; make it visible.
- The normal is considered learned when at least 3 sessions and at least 180 seconds of clean audio exist. The user can add more sessions any time. More sessions tighten the thresholds.

Listen now (check)

- Big button. A 30 second ring fills while a live score needle drifts. The verdict is shown at the end, never mid-recording (avoid anxiety flicker).
- Verdict screen: status (Normal, Slightly different, Different), a confidence label, a one paragraph plain-language explanation, a list of descriptors (each with a small spectrogram comparison strip: learned normal versus now), and "common things people check" for those descriptors. Two feedback chips: "It is actually fine" and "It was actually broken", plus "Not sure".
- If the recording was unusable (noise guard triggered for more than 40% of windows) the app says so and asks to retry, instead of guessing.

Watch mode

- Starts a long listening session (default 2 hours, or until stopped). Screen dims to a dark UI with a live timeline of the anomaly score, current matched state, and any drift alerts. Wake lock keeps the screen on. Notifications (Notification API, foreground) fire on sustained anomalies (score above threshold for more than 20 seconds).
- At the end, a summary with the timeline and the segments that looked different, each replayable if the user enabled clip keeping.

History

- Per appliance: list of checks and watch sessions with status, date, score, and the user's verdict. A trend chart of check scores over time (a slowly rising score across weeks is the early warning this product exists for).

### 5.2 Screens (for Claude Design)

- Home: appliance cards with status chip (Never checked, Normal, Slightly different, Different, Learning), last check date, and a big "Listen now" per card.
- Add appliance: type grid, name, placement note.
- Learn the normal: intro, session recorder (ring, level meter, noise guard hints), session result (states discovered), enrollment status (sessions, clean seconds, "normal learned" badge).
- Listen now: recorder ring with live needle, then verdict screen.
- Verdict: status header, explanation, descriptors with comparison strips, common checks, feedback chips, keep clip toggle.
- Watch mode: dark live timeline, alerts, stop button, summary.
- Appliance detail: history list, score trend chart, re-learn and export actions.
- Settings: language, model status (downloaded, size), clip retention, export and import, Home Assistant bridge (P2), about and privacy.

## 6. AI design

All inference runs in the browser. No server. Models are small enough to ship with the app.

### 6.1 Models

- MediaPipe Tasks Audio, AudioClassifier with the YAMNet model: 521 AudioSet classes, used as the noise guard (detect Speech, Music, Television, Dog, Baby cry and similar interference) and as a sanity check that the top classes are machine-like (Mechanisms, Engine, Hum, Washing machine, Vacuum cleaner, Air conditioning, and so on). About 4 MB. Self-hosted in `public/models/`.
- MediaPipe Tasks Audio, AudioEmbedder (YAMNet backbone): 1024 dimensional embedding per 0.975 s window. This is the primary representation for the baseline and the anomaly score. Self-hosted.
- Optional (P1): CLAP (`Xenova/clap-htsat-unfused` through `@huggingface/transformers`) for a second embedding space and for zero-shot descriptors ("a rattling sound", "a high pitched whine", "a knocking sound"). Larger download, fetched on demand and cached with the Cache API, only if the user enables "deeper analysis".
- Optional (P2): a tiny autoencoder over log-mel frames trained on device with TensorFlow.js during enrollment (the classic DCASE baseline). Used as a second scorer in an ensemble. Only if the embedding scorer proves insufficient on the evaluation set.
- Optional (P1): a local LLM through WebLLM (a small instruction model such as Qwen2.5 1.5B Instruct, q4f16) to turn the descriptor list into a friendly paragraph. Gated behind a setting because of the download size. The rule-based explanation must be good enough without it.

### 6.2 Audio pipeline

- Capture with `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. All three processing flags must be off; browser noise suppression destroys exactly the signal we need. Verify the applied constraints and warn if the browser ignored them.
- An AudioWorklet delivers mono PCM frames to a Web Worker. Resample to 16 kHz in the worker. Windows of 0.975 s with hop 0.4875 s (YAMNet native framing).
- For every window compute: YAMNet embedding, YAMNet top classes, RMS level in dBFS, and a feature vector of interpretable descriptors (see 6.5).
- The main thread only receives compact results (embedding, classes, features, level). Never send raw audio to the UI thread.

### 6.3 Learning the normal

- Discard windows flagged by the noise guard (any interference class in the top 5 with score above 0.25) and windows with RMS below a silence floor.
- Collect the remaining embeddings from all enrollment sessions.
- Cluster them into K states with k-means (K from 1 to 6, chosen by silhouette score, with a minimum of 15 windows per state). Machines have phases: a dishwasher filling, washing, draining and drying are different normals. A single centroid would flag the drying phase as anomalous. States are the fix.
- For each state store: centroid, per-dimension variance with shrinkage (diagonal covariance; the full covariance is unstable with a few hundred samples in 1024 dimensions), and the distribution of within-state distances (percentiles 50, 90, 95, 99, 99.5).
- Store the enrollment RMS distribution per state to detect distance or placement changes later.
- Store the descriptor baseline per state (mean and spread of each interpretable feature).
- Profile versioning: every enrollment change bumps `profile.version`; checks reference the version they were scored against.

### 6.4 Scoring a check

- For each clean window, find the nearest state by diagonal Mahalanobis distance and express the distance as a z-score against that state's enrolled distance distribution.
- Window score: the z-score, clipped to [0, 8].
- Check score: the 90th percentile of window scores over the check (robust to a door closing once).
- Status thresholds, per profile, derived from enrollment data rather than fixed numbers: Normal when the check score is below the enrolled p95 equivalent, Slightly different between p95 and p99.5 plus a margin, Different above. The margin starts at 1.0 z and is tuned by user verdicts (see 6.7).
- Level guard: if the check RMS differs from the matched state's enrollment RMS by more than 6 dB, show "the phone seems closer or farther than during learning" and downweight the verdict to Slightly different at most.
- Noise guard: if more than 40% of windows were discarded, the check is Unusable. No verdict.
- State coverage: report which enrolled state the check matched. If the check matched no state well (all distances beyond p99.5 for every state) and the descriptors show the machine is running, also say "this may be a phase I never heard during learning; if the machine was doing something new, add a learning session".

### 6.5 Interpretable descriptors (how it differs)

Computed per window from the 16 kHz signal in the worker, averaged over the check, and compared with the matched state's baseline. Each descriptor produces a sentence only when the change exceeds its own tolerance.

- Band energy in six bands (20 to 80 Hz, 80 to 250 Hz, 250 to 1 kHz, 1 to 3 kHz, 3 to 6 kHz, 6 to 8 kHz). Sentences like "more energy in the low range (a deeper or louder hum)" or "more energy between 3 and 6 kHz (a hiss or whine)".
- Tonal peaks: the three most prominent spectral peaks (frequency, prominence in dB). A new peak above 6 dB prominence not present in the baseline gives "a new steady tone near 2.1 kHz (whine)".
- Onset rate and periodicity: onsets per second from a spectral flux detector and autocorrelation of the onset envelope. Periodic onsets between 1 and 20 per second give "regular knocks about 3 times per second (rattle or imbalance)".
- Spectral flatness and centroid: "the sound is rougher or noisier than before".
- Amplitude modulation: dominant modulation rate from the RMS envelope (0.5 to 30 Hz). "the hum pulses about twice per second".

Common checks: a static, editable JSON map from descriptor patterns and appliance types to short lists of things people commonly check (for example, washing machine plus periodic knocks: load balance, transport bolts, drum bearing, foreign objects in the drum; fridge plus new tonal whine: fan blades, ice buildup, compressor). Every list ends with "if in doubt, ask a technician". This map is content, not intelligence, and must be reviewed by the maker before release.

### 6.6 Watch mode specifics

- Same scoring, streamed. Emit a score every hop and a smoothed score (exponential moving average with a 10 second horizon).
- Drift alert: smoothed score above the Different threshold for 20 seconds, or a monotonic climb of the 5 minute median for 20 minutes.
- Segment log: contiguous windows above threshold become segments with start, end, matched state, peak score and descriptors.
- Clip keeping: when enabled, keep the 10 seconds around each segment start as an Opus blob (MediaRecorder) with a hard cap of 20 clips per session and 50 MB total.

### 6.7 Learning from verdicts

- "It is actually fine" on a Slightly different or Different check: add that check's windows to the matched state's distance distribution (widens thresholds) and, if the descriptors show a coherent new state, propose adding it as a new state.
- "It was actually broken" on a Normal check: lower the margin for that appliance by 0.25 z (floor at 0.25) and record the check as a positive example for future evaluation.
- Keep a per-appliance "calibration log" so the user can undo a verdict.

### 6.8 Evaluation plan (part of the deliverable)

- The evaluation lives in the `earshot` repository (`scripts/eval/`) and runs in headless Chromium through Playwright, so it uses the exact same MediaPipe WASM runtime and scorer as production, over the MIMII and ToyADMOS public datasets (DCASE 2020 Task 2) to compute AUC and pAUC per machine type. Target: AUC above 0.80 on fan, pump and valve with the embedding scorer alone. This validates the math before any UI exists.
- `earshot` also holds `fixtures/synthetic/` with generated signals (pure tone plus pink noise, with injected whine, knocks and level shifts) used by unit tests to assert that each descriptor fires on its pattern and stays silent otherwise.
- A manual protocol in `docs/field-test.md` for the maker's own appliances: learn, check daily for two weeks, inject a fake anomaly (a coin in the drum, a towel blocking a fan intake, a phone at double distance) and record verdicts.

## 7. Architecture and stack

- Package manager pnpm. Vite, React 18 or newer, TypeScript strict (`noUncheckedIndexedAccess` on). Zustand for state, Tailwind CSS for styling, Framer Motion for motion. `vite-plugin-pwa` for installability and offline model caching. Dexie for IndexedDB. Vitest for unit tests, Playwright for a smoke test of the main flow with a fake microphone stream. ESLint and Prettier.
- Static deployment on Vercel (fallback GitHub Pages). No backend, no serverless functions in v1.
- Repositories:
  - `earshot` (separate repository, see `earshot-spec.md`): the framework-agnostic audio engine (capture worklet, resampling, feature extraction, YAMNet wrappers, k-means, profile learning, scoring, descriptors), plus the dataset evaluation and the synthetic fixtures. Shared with the companion project Meowlogue (cat vocalizations).
  - `steadyhum` (this repository): a single Vite PWA at the repository root (`src/`, `public/`, `docs/`).
  - `public/models/`: YAMNet classifier and embedder task files, fetched at build time by `pnpm models:fetch` (files are not committed; a checksum manifest is).
- Consuming earshot from GitHub, not npm: declare `"earshot": "github:ezar/earshot#vX.Y.Z"` in `package.json`, always pinned to a release tag, never a branch. earshot ships TypeScript source (its `exports` point to `src/`), so there is no build step and no install scripts, which also keeps pnpm 10 happy (it blocks dependency lifecycle scripts by default). Add `earshot` to `optimizeDeps.exclude` in `vite.config.ts`, and load earshot's worker and worklet entry points with Vite `?worker&url` imports, passing the URLs to earshot's factories. To work against an unreleased earshot change, use `pnpm link ../earshot` locally and never commit the link; then tag a release in earshot and bump the tag here.
- Workers: one Worker for inference and features, one AudioWorklet for capture. Use `Comlink` or a thin typed message protocol.
- Data model (Dexie tables): `appliances`, `profiles` (one active per appliance, versioned), `sessions` (enrollment, check, watch), `windows` (compact per-window results: embedding as Float16 or Int8 quantized, features, level, classes, sessionId), `checks` (score, status, descriptors, verdict, profileVersion), `clips` (Blob, sessionId, timestamp), `calibrationLog`.
- Storage budget: windows are about 1 KB each quantized; a 2 hour watch session is about 15k windows, 15 MB. Prune window-level data older than 90 days by default, keep aggregates forever.
- Performance budget: inference for one window under 30 ms on a 2022 mid-range Android phone; UI at 60 fps during recording; first interactive under 3 s on 4G after install; models cached after first load.
- Browser support: Chrome and Edge on Android and desktop, Safari on iOS 17 or newer, Firefox best effort. Feature-detect AudioWorklet, WebAssembly SIMD and wake lock; degrade with clear messages.
- i18n: JSON dictionaries in `src/i18n/{es,en}.json`. Spanish is the default locale. All UI copy goes through the dictionary from day one; no hardcoded strings.

## 8. Requirements

### P0 (must have)

- Add, rename and delete appliances with local persistence.
  - Given a new appliance, when saved, then it appears on Home with status Learning and zero sessions.
- Enrollment with live noise guard and state discovery.
  - Given a 60 s clean recording, when finished, then the app stores its windows and shows the number of states discovered.
  - Given speech in the room, when recording, then the ring pauses and a hint appears within 1 s, and those windows are excluded.
  - Given 3 sessions and 180 clean seconds, when the last one ends, then the appliance shows "normal learned".
- 30 second check with verdict and descriptors.
  - Given a learned appliance, when a check completes, then a status, a confidence label and at least one explanatory sentence are shown.
  - Given a check with over 40% discarded windows, then the status is Unusable and a retry is offered, with no verdict.
  - Given the phone at roughly double distance, then the level guard message appears.
- User verdict feedback that changes thresholds as in 6.7, with an undo.
- History and score trend per appliance.
- Export and import of a profile as JSON (embeddings, states, thresholds, descriptor baselines, no audio).
- Spanish and English.
- Works offline after first load, installable as a PWA.
- Privacy screen stating what is stored and that nothing leaves the device.

### P1 (should have)

- Watch mode with timeline, drift alerts, notifications and optional clip keeping.
- Deeper analysis with CLAP embeddings and zero-shot descriptor labels, behind a setting.
- Local LLM paragraph generation through WebLLM, behind a setting, with the rule-based paragraph as the default.
- Comparison strips (mini spectrograms of normal versus now) rendered with WebGL or canvas.
- Shareable verdict card as an image (canvas), for sending to a technician or a family chat.

### P2 (future, design for it)

- Home Assistant bridge: publish check results and watch alerts over MQTT over WebSocket to a user-configured broker. Fits the maker's home automation setup.
- On-device autoencoder scorer and ensemble.
- Household sharing of profiles through a link (no accounts), possibly reusing the Vercel plus Upstash room pattern from the maker's multiplayer games, carrying only profiles, never audio.
- Multi-microphone: a second phone as a permanent listener for Watch mode with results shown on the first phone.

## 9. Milestones

M0, earshot proves the math (no UI, in the `earshot` repository)

- Capture, resampling, YAMNet embedding and classification in a worker.
- Profile learning with states, scoring, descriptors.
- Eval script on MIMII and ToyADMOS with a report in `docs/eval-results.md`.
- Definition of done: AUC target met on at least three machine types; unit tests for descriptors pass on synthetic fixtures.

M1, the core loop

- Home, add appliance, enrollment, check, verdict, history, persistence, i18n, PWA.
- Definition of done: the maker enrolls two real appliances and gets Normal on daily checks for a week with no Unusable results in a quiet room.

M2, honesty and feedback

- Noise and level guards polished, verdict feedback and calibration log, export and import, privacy screen, shareable card.
- Definition of done: an injected anomaly (coin in the drum, blocked fan intake) yields Slightly different or Different in at least 4 of 5 checks; "actually fine" widens thresholds visibly on the next check.

M3, Watch mode

- Streaming scorer, timeline, alerts, clips, summary, wake lock, dark UI.
- Definition of done: a full dishwasher cycle runs with under 2 false alerts and the phase changes are visible on the timeline as state switches, not anomalies.

M4, depth

- CLAP, WebLLM paragraphs, comparison strips, then P2 items as separate branches.

## 10. Design brief for Claude Design

Use Claude Design to produce the design system and the screens before implementing the UI in M1. The output of Claude Design (tokens, components, screen mockups) is the reference for Claude Code.

- Personality: calm, precise, a little playful. A trustworthy instrument, not a medical device and not a gadget. Think of a well-made stethoscope with a friendly voice.
- Audience: adults at home, often standing in a laundry room holding a phone at arm's length. Big targets, high contrast, readable at a glance.
- Mood words: quiet, steady, attentive, honest.
- Color direction: a warm neutral base (paper, bone) with one confident accent for the primary action and a strict semantic trio for verdicts: a soft green for Normal, an amber for Slightly different, a deep coral for Different. Unusable is grey. Never use red as decoration; red-ish tones are reserved for Different.
- Typography: a humanist sans for UI and a monospaced or tabular numeral style for levels, scores and frequencies, so numbers line up in the descriptor list.
- Signature element: the listening ring. It fills over 30 seconds, breathes subtly with the input level, and its stroke color stays neutral until the verdict. Design the ring, the level meter and the state timeline strip as reusable components.
- Verdict screen: status first, explanation second, descriptors third, common checks last. The user's feedback chips must be reachable with the thumb.
- Watch mode: true dark background (the phone will sit on a shelf for two hours), large live score, minimal chrome, a clear stop control.
- Motion: purposeful and short (150 to 300 ms). The ring fill and the state strip coloring are the only continuous animations.
- Accessibility: WCAG AA contrast, all states also conveyed by icon and text, reduced motion respected, dynamic type up to 130%.
- Deliverables: design tokens (color, type, spacing, radius, elevation), component sheet (buttons, chips, cards, ring, level meter, timeline strip, comparison strip, descriptor row, verdict header, empty states), and mockups for every screen in section 5.2 in Spanish copy at 390 px wide, plus a desktop layout for Home and Appliance detail. Include empty, loading, error and Unusable states.

## 11. Conventions for Claude Code

- Code, comments, identifiers, commit messages, README and docs in English. UI copy lives only in the i18n dictionaries (Spanish default, English second).
- TypeScript strict everywhere, including workers and the worklet. No `any`. Public functions in `earshot` have JSDoc with units (Hz, dBFS, seconds) in every numeric parameter.
- Numeric code must state its units and framing constants in named constants (`WINDOW_SECONDS`, `HOP_SECONDS`, `SAMPLE_RATE_HZ`).
- No runtime dependency on third party CDNs for the P0 models. `pnpm models:fetch` downloads into `public/models/` and verifies checksums; the Vercel build runs it. Larger optional models (CLAP, WebLLM) are fetched on demand from their hubs and cached locally; document the sizes in Settings.
- Every algorithm in section 6 gets a unit test with a synthetic fixture before it gets a UI.
- Keep `earshot` free of React and of persistence: it returns serializable objects and SteadyHum stores them with Dexie.
- Conventional commits. One milestone per branch, merged with a short `docs/decisions/NNNN-title.md` decision record when an approach in this spec changes.
- Do not add analytics or any network call. The only network requests are model downloads and the app itself.
- When something in this spec is impossible or clearly worse in practice, write the alternative in a decision record and continue; do not silently deviate.

## 12. Risks and open questions

- Browser audio processing flags: some browsers ignore `noiseSuppression: false`. Blocking check in M0: log the applied constraints on Chrome Android, Chrome desktop and Safari iOS. If Safari forces processing, evaluate whether embeddings still separate injected anomalies; if not, iOS gets a warning banner.
- Placement variance: users will not hold the phone in the same spot. The level guard mitigates distance; angle and surface differences remain. Mitigation: enrollment tips, and a P1 experiment that augments enrollment windows with small gain and EQ perturbations.
- Machine phases the user never enrolled: handled with the "new phase" message, but it will feel like a false alarm the first time. The copy must make adding a session a one-tap action from the verdict.
- YAMNet embeddings were trained for event classification, not machine health. The eval script exists precisely to confirm they separate anomalies well enough; if AUC is poor, promote the autoencoder scorer from P2 to M2.
- Descriptor to "common checks" content: needs the maker's review for correctness and for not overpromising.
- Legal: consumer information, not professional advice. The About screen states that SteadyHum does not diagnose faults and that gas appliances must be checked by certified technicians. Not a medical or safety device.

## 13. Success signals

- The maker's own appliances: two weeks of daily checks with under 1 false Different per appliance per week, and injected anomalies caught 4 of 5 times.
- Enrollment completion: a new user reaches "normal learned" in under 8 minutes of wall time.
- Verdict usefulness: at least half of Different verdicts in field tests come with a descriptor that a technician recognizes as meaningful.
- Reuse: `earshot` is consumed unchanged by Meowlogue.
