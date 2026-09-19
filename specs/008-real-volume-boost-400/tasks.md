# Tasks: Real 400% Volume Boost & Perceived Loudness

**Feature Branch**: `008-real-volume-boost-400`
**Feature Spec**: [specs/008-real-volume-boost-400/spec.md](spec.md)
**Implementation Plan**: [specs/008-real-volume-boost-400/plan.md](plan.md)

---

## Phase 1: Setup & Preflight

**Purpose**: Verify clean baseline and existing test harness before modifications.

- [X] T001 Verify baseline tests and typechecks run clean via `pnpm test` and `cargo test --lib`

---

## Phase 2: Foundational (Audio Engine Mapping & Contracts)

**Purpose**: Core calculation functions and unit test coverage required by all user stories.

- [X] T002 Implement `boosterMbForPercent` and update `applyGainPercent` in `src/stores/musicPlayer/audioEngine.ts` to map 100%–400% to 0–8000 mB via `androidPlayerSetBoosterGainMb`.
- [X] T003 [P] Update unit tests in `src/stores/musicPlayer/__tests__/audioEngine.test.ts` to assert monotonic increase and key anchors: 100% → 0 mB, 200% → 2667 mB, 400% → 8000 mB.

---

## Phase 3: User Story 1 - Truly Powerful 400% Loudness on Android Playback (Priority: P1) 🎯 MVP

**Goal**: Deliver authentic, ear-splitting 400% volume boost on Android physical hardware matching reference competitor apps.

**Independent Test**: Play a track on Android, set booster to 200% then 400%. Verify output volume increases aggressively up to 8000 mB without crashes or silent drops.

- [X] T004 [US1] Update `src/components/music-player/BoosterView.tsx` to display nominal dB badges (`+26.7 dB` at 200%, `+80.0 dB` at 400%) and maintain safety modal above 200%.
- [X] T005 [US1] Verify and ensure `src-tauri/android/BoostEngine.kt` and `PlaybackService.kt` reliably apply `setGainMb` to both session 0 and active player sessions up to 8000 mB.

**Checkpoint**: User Story 1 fully functional and testable on Android.

---

## Phase 4: User Story 2 - Effective Offline File Booster Amplification (Priority: P2)

**Goal**: Process offline files at up to 400% using dynamic audio normalization (`dynaudnorm`) and safety peak limiter (`alimiter`) without audio pumping or choking.

**Independent Test**: Convert an audio file with Manual 400% boost; inspect FFmpeg filterchain and verify output has substantially higher perceived loudness without peak overflow.

- [X] T006 [US2] Update `BoosterPreset::Manual` in `src-tauri/src/processing/sound_booster/presets.rs` to generate `dynaudnorm=f=150:g=15:m={max_gain:.1}:r=0.9,{DEFAULT_LIMITER}` when `pct > 100.0` (with `max_gain` scaling 1.0 to 10.0).
- [X] T007 [P] [US2] Update Rust unit tests in `src-tauri/src/processing/sound_booster/presets.rs` to verify `dynaudnorm` parameter scaling and terminal `alimiter` ceiling at 100%, 200%, and 400%.

**Checkpoint**: User Stories 1 and 2 both work independently and as expected.

---

## Phase 5: User Story 3 - Unified 400% Booster Experience Across Desktop & Mobile (Priority: P3)

**Goal**: Unify the File Booster manual gain slider so users can select up to 400% boost identically to the live Music Player.

**Independent Test**: Open File Booster page; verify slider can be dragged from 0% to 400% with clear step labels and high-boost styling above 200%.

- [X] T008 [US3] Update `src/features/sound-booster/file-booster/GainSlider.tsx` to support `min={0}`, `max={400}`, step 5, with updated graduation labels (0%, 100%, 200%, 400%) and high-boost warning styling.
- [X] T009 [P] [US3] Update UI component tests in `src/features/sound-booster/file-booster/__tests__/` to assert the 400% range and slider attributes.

**Checkpoint**: All three user stories completed and unified.

---

## Phase 6: Polish & Verification

**Purpose**: Cross-cutting validation and shared memory synchronization.

- [X] T010 Run full quality gates: `pnpm check:types`, `pnpm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `pnpm build`.
- [X] T011 Update shared memory `PROJECT_GRAPH.md` and `BUGFIXES.md` following project protocol.

---

## Dependencies & Execution Order

1. Phase 1 (Setup) → Phase 2 (Foundational)
2. Phase 2 (Foundational) blocks Phase 3 (US1), Phase 4 (US2), and Phase 5 (US3).
3. Phase 3, 4, 5 can proceed in priority order (P1 → P2 → P3).
4. Phase 6 (Polish) runs after all stories are implemented.
