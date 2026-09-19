# Implementation Plan: Real 400% Volume Boost & Perceived Loudness

**Branch**: `008-real-volume-boost-400` | **Date**: 2026-09-19 | **Spec**: [specs/008-real-volume-boost-400/spec.md](spec.md)

**Input**: Feature specification from `/specs/008-real-volume-boost-400/spec.md`

## Summary

Recalibrate the sound booster system across mobile playback and offline file conversion to deliver a true, powerful 400% loudness increase that matches leading competitor apps:
1. **Android Live Playback**: Map the 100%–400% boost scale up to `8000 mB` (+80 dB nominal) via `BoostEngine` to drive the native `LoudnessEnhancer` to its full hardware potential.
2. **Offline File Booster**: Re-engineer the Manual preset filter chain in Rust (`presets.rs`) to combine dynamic normalization (`dynaudnorm`) with the constitutional safety limiter (`alimiter`), preventing peak choke and allowing authentic 400% loudness.
3. **UI Synchronization**: Unify `file-booster/GainSlider.tsx` to support 0%–400% with high-boost warning styling matching the Music Player rotary dial.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (React 19), Rust 1.77+ (2021 edition), Kotlin (Android Media3 / JNI).

**Primary Dependencies**: Tauri v2, Zustand 5, FFmpeg 8.1.2 (`dynaudnorm`, `alimiter`), Android `LoudnessEnhancer`.

**Storage**: `SharedPreferences` for Android booster gain persistence (`BoostEngine`), Zustand in-memory state.

**Testing**: Vitest (`audioEngine.test.ts`, `GainSlider.test.tsx`), `cargo test` (`presets.rs`), physical Android verification.

**Target Platform**: Android (primary target for live boost) + Desktop (macOS/Linux/Windows for offline conversion and player).

**Project Type**: Tauri hybrid desktop/mobile app.

**Performance Goals**: Instant gain adjustments (< 20ms) with zero playback interruptions, clicks, or crashes.

**Constraints**: Local-first offline-only, zero digital clipping above −0.5 dBFS (`alimiter` ceiling), file size ceiling ≤ 300 lines per file.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evaluation & Compliance |
|---|---|---|
| **I. Local-First & Privacy** | PASS | Operates 100% locally on device hardware; zero network or telemetry. |
| **II. Single-Pass DSP Integrity** | PASS | All offline booster filters remain in a single unified `-filter_complex` terminating in `alimiter=limit=0.95:...:asc=1`. No multi-pass re-encodes. |
| **III. Type-Safe IPC Contract** | PASS | Uses existing typed commands (`androidPlayerSetBoosterGainMb`). No new un-typed IPC. |
| **IV. Atomic File Operations** | PASS | Uses existing `.tmp` / `.part` pipeline in `QueueManager`. |
| **V. Test-First & CI Gate** | PASS | Unit tests updated for `audioEngine.ts` and `presets.rs`. Full test suite passes. |
| **VI. Platform Boundary & Permission** | PASS | Operates via `LoudnessEnhancer` and `AudioPlaybackCapture`; no `RECORD_AUDIO` requested. |
| **VII. Secrets** | PASS | No credentials involved. |
| **VIII. Code Hygiene & File Size** | PASS | Preserves i18n keys and keeps all modified files below 300 lines. |

---

## Project Structure

### Documentation (this feature)

```text
specs/008-real-volume-boost-400/
├── spec.md              # Feature specification & requirements
├── plan.md              # This implementation plan
├── research.md          # Technical research & design decisions
├── data-model.md        # Runtime state & filterstring models
├── quickstart.md        # End-to-end validation guide
├── contracts/           # Mapping contract specifications
│   └── booster-loudness-mapping.contract.md
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code Paths

```text
src/
├── features/sound-booster/file-booster/
│   ├── GainSlider.tsx                     # Extend slider from 200% to 400%
│   └── __tests__/ConfigsSection.test.tsx  # Update slider range tests
├── stores/musicPlayer/
│   ├── audioEngine.ts                     # Map 100-400% to 0-8000 mB via boosterMbForPercent
│   └── __tests__/audioEngine.test.ts      # Unit tests for new 8000 mB curve
src-tauri/src/processing/sound_booster/
└── presets.rs                             # Update Manual preset to dynaudnorm + alimiter
```

---

## Complexity Tracking

*No violations. All principles and constraints fully satisfied.*
