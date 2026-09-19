# Tasks: Track Booster UI/UX Redesign & Safe Speaker Protection

**Feature**: `009-nowplaying-booster-ux`
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

---

## Phase 1: Setup (Shared Infrastructure & Localization)

**Purpose**: Localization keys and native Kotlin safety decoupling.

- [X] T001 [P] Add booster localization keys (`boosterProtectSpeaker`, `boosterNormalLevel`, `boosterSheetTitle`, `boosterAuditionHint`) to `src/i18n/fa.ts` and `src/i18n/en.ts`
- [X] T002 [P] Update `AudioStreamManager.applyReduceHurt` in `src-tauri/android/AudioStreamManager.kt` to reset `BoostEngine.setGainMb(0)` without modifying hardware stream volume (`setStreamVolume`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create test scaffold for the new `TrackBoosterSheet` component before implementation.

- [X] T003 Create unit test suite scaffold in `src/components/music-player/__tests__/TrackBoosterSheet.test.tsx` covering sheet visibility, safe reset, preset selection, and safety modal

**Checkpoint**: Foundation ready - user story implementation can proceed.

---

## Phase 3: User Story 1 - Safe Speaker Protection Without Hardware Volume Muting (Priority: P1) 🎯 MVP

**Goal**: Ensure tapping "Speaker Protection" resets sound boost gain to 100% while strictly leaving device hardware media volume (`STREAM_MUSIC`) completely untouched.

**Independent Test**: Mount `TrackBoosterSheet` with gain at 250%. Tap "Speaker Protection" button. Verify `volumeGainPercent` resets to 100%, no native volume downscale is dispatched, and the theme switches to emerald.

### Implementation for User Story 1

- [X] T004 [US1] Implement safe speaker protection reset action in `src/components/music-player/TrackBoosterSheet.tsx` that sets `volumeGainPercent` to 100 without invoking `androidApplyReduceHurt`
- [X] T005 [US1] Add unit test in `src/components/music-player/__tests__/TrackBoosterSheet.test.tsx` verifying that speaker protection button resets gain to 100% and does not alter system stream volume

**Checkpoint**: User Story 1 functional and independently verified.

---

## Phase 4: User Story 2 - Modern, Tactile Bottom Sheet UI/UX for Track Booster (Priority: P1)

**Goal**: Deliver a polished, mobile-first bottom sheet with dynamic color tiers, tactile preset pills, smooth slider, and non-dismissive real-time auditioning.

**Independent Test**: Open NowPlayingView and tap the booster flame icon. Verify bottom sheet opens with backdrop blur, drag handle, dynamic theme tokens, 5 preset pills (100%, 150%, 200%, 300%, 400%), and smooth range slider. Tap 150% and verify gain updates immediately while sheet stays open.

### Implementation for User Story 2

- [X] T006 [US2] Create bottom sheet container with backdrop blur, rounded-t-3xl card, drag handle, and header in `src/components/music-player/TrackBoosterSheet.tsx`
- [X] T007 [US2] Implement dynamic color tier styling (emerald 100%, amber 101-175%, orange 176-250%, rose 251-400%) in `src/components/music-player/TrackBoosterSheet.tsx`
- [X] T008 [US2] Implement 5 tactile preset pills (100%, 150%, 200%, 300%, 400%) with non-dismissive auditioning in `src/components/music-player/TrackBoosterSheet.tsx`
- [X] T009 [US2] Implement custom styled LTR range slider with graduation markers and value readout in `src/components/music-player/TrackBoosterSheet.tsx`
- [X] T010 [US2] Refactor `src/components/music-player/NowPlayingView.tsx` to replace the inline popup with `<TrackBoosterSheet isOpen={boosterOpen} onClose={() => setBoosterOpen(false)} />` and remove unused `androidApplyReduceHurt` import

**Checkpoint**: User Story 2 functional, sheet looks beautiful and stays open during auditioning.

---

## Phase 5: User Story 3 - High-Boost Safety Confirmation & Feedback (Priority: P2)

**Goal**: Prevent accidental speaker overload by prompting users with a safety confirmation dialog when selecting boost levels above 200%.

**Independent Test**: In `TrackBoosterSheet`, tap the 300% or 400% preset pill. Verify safety modal appears; confirming unlocks extreme boost, canceling retains 200%.

### Implementation for User Story 3

- [X] T011 [US3] Add high-boost safety gating and confirmation modal dialog in `src/components/music-player/TrackBoosterSheet.tsx`
- [X] T012 [US3] Add high-boost advisory warning banner in `src/components/music-player/TrackBoosterSheet.tsx` when gain exceeds 200%

**Checkpoint**: High-boost safety flow fully verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regression testing, file size verification, and full build validation.

- [X] T013 [P] Update `src/components/music-player/__tests__/NowPlayingView.test.tsx` to verify clean integration with `TrackBoosterSheet`
- [X] T014 Run full frontend test suite (`pnpm test`) and production build (`pnpm build`)
- [X] T015 Run full Rust backend test suite (`cargo test --manifest-path src-tauri/Cargo.toml`)
- [X] T016 Verify file size limits in `src/components/music-player/TrackBoosterSheet.tsx` (≤ 250 lines) and confirm `NowPlayingView.tsx` line reduction

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion; blocks all user stories.
- **Phase 3 (User Story 1 - P1)**: Depends on Phase 2; provides MVP safe speaker protection.
- **Phase 4 (User Story 2 - P1)**: Depends on Phase 3; delivers full sheet UI/UX.
- **Phase 5 (User Story 3 - P2)**: Depends on Phase 4; adds extreme boost safety modal.
- **Phase 6 (Polish)**: Depends on all user stories completed.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete T001, T002, T003.
2. Complete T004, T005 to ensure speaker protection never cuts hardware volume.
3. Validate User Story 1 independently.

### Incremental Delivery
1. Add User Story 2 (T006–T010) → Polished bottom sheet + real-time auditioning.
2. Add User Story 3 (T011–T012) → Safety modal for > 200%.
3. Polish & Verification (T013–T016) → Full suite verification.
