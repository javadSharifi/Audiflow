# Tasks: Converter Modal Z-Index and Trim Editor Playback Fixes

**Feature**: Converter Modal Z-Index and Trim Editor Playback Fixes  
**Branch**: `010-fix-converter-trim-modal`  
**Plan**: [plan.md](./plan.md)  
**Spec**: [spec.md](./spec.md)

---

## Phase 1: Setup & Localization (Shared Infrastructure)

**Purpose**: Define translation keys required across all user stories.

- [x] T001 [P] Add localization keys (`trimCutFirst5`, `trimCutLast5`, `trimCutFirst5Tip`, `trimCutLast5Tip`, `trimWaveformHint`) in `src/i18n/fa.ts`
- [x] T002 [P] Add localization keys (`trimCutFirst5`, `trimCutLast5`, `trimCutFirst5Tip`, `trimCutLast5Tip`, `trimWaveformHint`) in `src/i18n/en.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract modal component to satisfy Single Responsibility and avoid oversized file bloat.

**⚠️ CRITICAL**: Must complete before user story modifications to `FileList.tsx`.

- [x] T003 Extract `MobileEditModal` from `src/components/FileList.tsx` into `src/components/MobileEditModal.tsx` and import back into `src/components/FileList.tsx`

**Checkpoint**: Foundation ready — User story implementation can now proceed.

---

## Phase 3: User Story 1 - Unobstructed Modal Stacking in Converter (Priority: P1) 🎯 MVP

**Goal**: Ensure the mobile edit modal renders with stacking context `z-[80]`, completely above `MusicPlayerNav` (`z-[55]`), preventing UI occlusion and click bleed-through.

**Independent Test**: On a viewport < 768px in the Converter file list, click Trim / Sound Booster and verify modal container has class `z-[80]` and renders above the floating bottom dock.

### Tests for User Story 1

- [x] T004 [US1] Create unit test in `src/components/__tests__/MobileEditModal.test.tsx` verifying `MobileEditModal` renders with `z-[80]` portal stacking context

### Implementation for User Story 1

- [x] T005 [US1] Update `MobileEditModal` container class in `src/components/MobileEditModal.tsx` from `z-50` to `z-[80]`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Reliable Preview Audition (Priority: P1)

**Goal**: Eliminate premature audio pausing when auditioning the end of a track or selection in `TrimEditor.tsx` by handling asynchronous seek states.

**Independent Test**: Tap "Last 5s" in `TrimEditor`; verify playback immediately starts at `end - 5s` and auditions through to `end` without stalling or immediately pausing.

### Tests for User Story 2

- [x] T006 [US2] Add unit test in `src/components/__tests__/TrimEditor.test.tsx` verifying snippet auditioning does not prematurely pause while audio element is in seeking state

### Implementation for User Story 2

- [x] T007 [US2] Introduce `previewStartRef` and guard `onAudioTimeUpdate` in `src/components/TrimEditor.tsx` against premature boundary pause when `a.seeking` is true or `a.currentTime < cleanFrom`
- [x] T008 [US2] Reset `previewStartRef` and `previewEndRef` on `onPause`, `onEnded`, and component cleanup in `src/components/TrimEditor.tsx`

**Checkpoint**: User Stories 1 and 2 are fully functional.

---

## Phase 5: User Story 3 - 5-Second Snippet Auditioning & Timing Update (Priority: P2)

**Goal**: Migrate preview intervals from 10 seconds to 5 seconds and display snippet buttons for all tracks >= 5.05s.

**Independent Test**: For tracks >= 5.05s, buttons display "۵ ثانیه اول" and "۵ ثانیه آخر" (or "First 5s" / "Last 5s") and play exact 5-second snippets.

### Tests for User Story 3

- [x] T009 [US3] Add unit tests in `src/components/__tests__/TrimEditor.test.tsx` verifying 5-second snippet calculation and visibility threshold at 5.05s

### Implementation for User Story 3

- [x] T010 [US3] Update `previewFirst10` to `previewFirst5` (`Math.min(start + 5, end)`) and `previewLast10` to `previewLast5` (`Math.max(end - 5, start)`) in `src/components/TrimEditor.tsx`
- [x] T011 [US3] Update snippet button visibility threshold from `duration >= 10.05` to `duration >= 5.05` in `src/components/TrimEditor.tsx`
- [x] T012 [US3] Connect `trimCutFirst5` and `trimCutLast5` labels, tooltips, and data-testids in `src/components/TrimEditor.tsx`

**Checkpoint**: User Stories 1, 2, and 3 work independently and seamlessly together.

---

## Phase 6: User Story 4 - Clean Trim Layout with Compact Waveform Guide (Priority: P3)

**Goal**: Remove redundant top guide heading and place a compact guide label directly under the waveform canvas.

**Independent Test**: Open Trim Editor; verify top `<p>` heading is absent and `<p>{translate(lang, "trimWaveformHint")}</p>` appears directly beneath the waveform canvas.

### Tests for User Story 4

- [x] T013 [US4] Add assertions in `src/components/__tests__/TrimEditor.test.tsx` verifying absence of top guide text and presence of sub-waveform hint

### Implementation for User Story 4

- [x] T014 [US4] Remove the top `<p className="...">{translate(lang, "trimTitle")}</p>` element from `src/components/TrimEditor.tsx`
- [x] T015 [US4] Add compact guide `<p className="text-center text-[11px] font-medium text-slate-500 dark:text-zinc-400">{translate(lang, "trimWaveformHint")}</p>` directly beneath the waveform container in `src/components/TrimEditor.tsx`

**Checkpoint**: All user stories complete and verified.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Global validation across all modified files.

- [x] T016 [P] Run full frontend test suite via `pnpm test`
- [x] T017 [P] Run typecheck verification via `pnpm check:types`
- [x] T018 Run build verification via `pnpm build`
- [x] T019 Execute manual validation scenarios described in `specs/010-fix-converter-trim-modal/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately (no dependencies)
- **Foundational (Phase 2)**: Depends on Phase 1; blocks User Story 1
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Can run after Phase 1; focuses on `TrimEditor.tsx` playback logic
- **User Story 3 (Phase 5)**: Depends on User Story 2 (builds on `TrimEditor.tsx` playback range methods)
- **User Story 4 (Phase 6)**: Can run in parallel with or after User Story 3 in `TrimEditor.tsx`
- **Polish (Phase 7)**: Depends on all implementation tasks (T001–T015) being complete

### Parallel Opportunities

- **T001** and **T002** can run concurrently (different localization files).
- **T004** / **T005** (US1: `MobileEditModal.tsx`) and **T006** / **T007** (US2: `TrimEditor.tsx`) can run concurrently once Phase 1 and Phase 2 are complete.
- **T016** and **T017** can run in parallel during the polish phase.

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Developer A working on User Story 1:
Task T004: "Create unit test in src/components/__tests__/MobileEditModal.test.tsx"
Task T005: "Update MobileEditModal container class in src/components/MobileEditModal.tsx from z-50 to z-[80]"

# Developer B working on User Story 2:
Task T006: "Add unit test in src/components/__tests__/TrimEditor.test.tsx"
Task T007: "Introduce previewStartRef and guard onAudioTimeUpdate in src/components/TrimEditor.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (i18n) and Phase 2 (`MobileEditModal` extraction).
2. Complete Phase 3 (US1: z-index `z-[80]`).
3. Validate User Story 1: Edit modal no longer obscured on mobile viewports.

### Incremental Delivery
1. Add User Story 2: Fix seek race condition in `TrimEditor.tsx`. Verify auditioning end of track works.
2. Add User Story 3: Update preview duration to 5s and adjust threshold to 5.05s.
3. Add User Story 4: Clean up top header and insert compact sub-waveform guide.
4. Execute full verification suite (`pnpm test`, `pnpm check:types`, `pnpm build`).
