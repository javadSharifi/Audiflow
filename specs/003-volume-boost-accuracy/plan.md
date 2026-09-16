# Implementation Plan: Volume Boost Accuracy & Seek Clarity

**Branch**: `003-volume-boost-accuracy` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-volume-boost-accuracy/spec.md`

## Summary

Fix the live Music Player booster so the 100%–400% labels tell the truth and scrubbing stays clean: (1) replace the current double-IPC gain path (dB call immediately overwritten by mB call, or vice versa) with one honest percent→gain mapping applied identically on Android and desktop; (2) soft-debounce rapid seeks (~1s trailing) in the player store so fast scrubbing settles on the final position instead of firing a noisy re-seek per movement; (3) extend the offline file-booster Manual preset to the same 0–400% scale so converted files match the live progression. The mandatory `alimiter` ceiling stays (constitution Principle II, non-negotiable) and is documented as a full-scale-only safety net, not a loudness cap — per clarification, honesty wins over hidden capping.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) + React 19 frontend; Kotlin (Jetpack Media3 / ExoPlayer, `LoudnessEnhancer`) Android native; Rust edition 2021 (MSRV 1.77) backend with FFmpeg/FFprobe 8.1.2

**Primary Dependencies**: ExoPlayer Media3 `player.volume` (0–1) + `LoudnessEnhancer` (0–8000 mB) on Android; WebAudio `GainNode` (linear amplitude) on desktop; FFmpeg `volume` + `alimiter` filters for file output; Zustand 5 (`useMusicPlayerStore`)

**Storage**: N/A for new data — boost level already persisted (Android `SharedPreferences` via `BoostEngine`, frontend store); no new persisted value. If a debounce interval constant is added it is code, not stored state.

**Testing**: Vitest + Testing Library (mapping + debounce unit tests, existing `src/stores/musicPlayer/__tests__/audioEngine.test.ts` extended); `cargo test` (Manual 400% filter-chain math + alimiter presence); manual Android listening checks per `quickstart.md` (SC-001…SC-004). No live-FFmpeg e2e change (filter assembly only, existing `e2e.rs` untouched).

**Target Platform**: Android first (reported device); desktop must not regress and keeps the same relative progression

**Project Type**: Tauri 2 desktop + Android mobile app (shared React frontend, per-platform audio engines)

**Performance Goals**: Seek resumes at new position with boost intact within 2 s (SC-002); rapid-scrub seeks coalesce to ~1 applied seek per second of scrubbing; boost slider/dial changes stay click-free (existing `setTargetAtTime` ramp kept)

**Constraints**: No `RECORD_AUDIO` permission (Principle VI); single active audio stream; no new IPC commands if avoidable (reuse `androidPlayerSetBoosterGainMb` / `androidPlayerSetVolume` through `src/utils/tauri.ts`); every user-facing string via `translate()` (en/fa); no source file over 300 lines (split along responsibility lines if the debounce helper grows); offline-first, no cloud

**Scale/Scope**: 3 areas — (a) frontend gain path + seek debounce (`src/stores/musicPlayer/`), (b) Android gain application single-path (`BoostEngine` call sites only, no architecture change), (c) Rust file-booster Manual preset range 0–400% (`sound_booster/presets.rs` + test). No UI redesign, no new screens, no range beyond 400%.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] I. Local-first — no network, account, or telemetry added. PASS.
- [x] II. Single-pass DSP + terminal `alimiter` — file chain stays single-pass; every chain still ends in `alimiter`. Honesty-vs-capping tension resolved as: gain mapping stays monotonic/linear-amplitude and the limiter acts only as a full-scale (>0 dBFS) ceiling, documented in research. No multi-pass re-encode. PASS with note (see Complexity Tracking).
- [x] III. Type-safe IPC — no new commands planned; the fix _removes_ one of the two existing gain calls at the `audioEngine.ts` call site. If any signature changes, `pnpm generate:types` + `check:types` run. PASS.
- [x] IV. Atomic non-destructive writes — file-booster output path untouched. PASS.
- [x] V. Test-first & CI — Vitest + `cargo test` coverage planned for every changed mapping; full CI matrix unchanged. PASS.
- [x] VI. Platform boundary — no permission, storage, or session-handling change; single-stream rule kept. PASS.
- [x] VII. Secrets — no credentials touched. PASS.
- [x] VIII. i18n / SRP / 300-line ceiling — no new user-facing strings expected (mapping + debounce are behavior-only); debounce helper goes in its own module/slice if it would bloat `audioEngine.ts` (858 lines already — must NOT grow it; extract). PASS with extraction obligation.

Post-Phase-1 re-check: confirmed — design adds no new IPC, no new strings, no new persisted values; `audioEngine.ts` must shrink or stay, never grow (debounce lives in `useMusicPlayerStore` or a new `seekDebounce` helper).

## Project Structure

### Documentation (this feature)

```text
specs/003-volume-boost-accuracy/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── booster-gain-mapping.contract.md
│   └── seek-debounce.contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── stores/
│   ├── useMusicPlayerStore.ts      # seekTo() gains trailing debounce (~1s)
│   └── musicPlayer/
│       ├── audioEngine.ts          # single-path gain (READ + small edit only; do NOT grow)
│       └── __tests__/audioEngine.test.ts  # mapping + debounce tests
├── components/music-player/
│   ├── BoosterView.tsx             # unchanged (labels stay 100-400%)
│   ├── NowPlayingView.tsx / MiniPlayer.tsx  # unchanged callers of seekTo()
│   └── SeekBar*                   # unchanged; debounce sits in store
src-tauri/
├── src/processing/sound_booster/
│   └── presets.rs                  # Manual preset range 0..400
└── android/
    └── BoostEngine.kt / PlaybackService.kt  # call-site behavior only (no arch change)
```

**Structure Decision**: In-place fix inside the existing layered architecture (components → `useMusicPlayerStore` → `audioEngine.ts` → `utils/tauri.ts` → `BoostEngine.kt` / FFmpeg chain). No new projects, no new layers, no new IPC surface.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Keep `alimiter` while user chose "no safety capping" (FR-006) | Constitution Principle II is NON-NEGOTIABLE: every booster chain must end in `alimiter` at −0.5 dBFS | Removing the limiter would violate the constitution and risk digital clipping/speaker damage; instead the limiter is documented and tested as a full-scale-only ceiling while the gain mapping itself stays honest and uncapped below it |

## Phase 0 — Research summary

See [research.md](research.md). Decisions: (D1) single IPC path = dB-honest mapping (`boosterDbForPercent` → `setGainMb`) and drop the parallel linear-mB call; (D2) trailing seek debounce ~1000 ms in `useMusicPlayerStore.seekTo` with optimistic UI kept; (D3) enhancer gain never re-asserted during the seek-settle window; (D4) Manual file preset unified to 0–400% linear amplitude + unchanged `alimiter`; (D5) dB hint (`boosterDbForPercent`) kept as the truthful label — no new strings.

## Phase 1 — Design outputs

- [data-model.md](data-model.md) — behavioral entities (no new storage)
- [contracts/booster-gain-mapping.contract.md](contracts/booster-gain-mapping.contract.md) — single-path percent→gain table + call order
- [contracts/seek-debounce.contract.md](contracts/seek-debounce.contract.md) — debounce behavior contract
- [quickstart.md](quickstart.md) — listening + unit validation guide for SC-001…SC-004
