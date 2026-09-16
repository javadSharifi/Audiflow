# Tasks: Booster Page Four Sections

**Input**: Design documents from `/specs/005-booster-page-sections/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sections-contract.md, quickstart.md

**Tests**: Included per story — required by Constitution V (test-first, Vitest) for all frontend changes.

**Organization**: Tasks grouped by user story; each story independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths in every task description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline before touching code

- [X] T001 Verify green baseline by running existing booster suites (`pnpm test src/features/sound-booster`) per specs/005-booster-page-sections/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared shell + copy that all four section stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add section titles, upload explainer, hints, progress/result/action strings to src/i18n/en.ts and src/i18n/fa.ts (no hardcoded literals allowed downstream)
- [X] T003 [P] Create SectionShell wrapper (number badge + translated title + data-testid passthrough) in src/features/sound-booster/file-booster/sections/SectionShell.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Upload a file and understand what the booster can do (Priority: P1) 🎯 MVP

**Goal**: Section 1 — upload card with capability explainer below it, file summary + change/remove (FR-002, FR-003)

**Independent Test**: Open page with no file → section 1 shows upload + explainer; select file → name/size/duration + change/remove appear; EN + FA layouts correct

- [X] T004 [P] [US1] Write failing component test for UploadSection empty/file states in src/features/sound-booster/file-booster/__tests__/UploadSection.test.tsx
- [X] T005 [US1] Implement UploadSection in src/features/sound-booster/file-booster/sections/UploadSection.tsx (props: file, isExporting, onPick, onClear; explainer below upload card)
- [X] T006 [US1] Wire UploadSection into src/features/sound-booster/file-booster/FileBoosterPage.tsx replacing the hero/file-card block, keeping existing pickFile/clearFile wiring

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Configure output before exporting (Priority: P2)

**Goal**: Section 2 — preset/gain + format + A/B preview + export trigger, disabled until file exists, locked during export (FR-004, FR-005)

**Independent Test**: No file → section 2 disabled with upload-first hint; file selected → preset/gain/format/preview/export all work; export running → section locked

- [X] T007 [P] [US2] Write failing component test for ConfigsSection disabled/enabled/locked states in src/features/sound-booster/file-booster/__tests__/ConfigsSection.test.tsx
- [X] T008 [US2] Implement ConfigsSection in src/features/sound-booster/file-booster/sections/ConfigsSection.tsx by moving PresetSelector/GainSlider/format-picker/ABPreview/export-trigger JSX verbatim (reuse components unchanged; stays mounted, disabled attrs only)
- [X] T009 [US2] Wire ConfigsSection into src/features/sound-booster/file-booster/FileBoosterPage.tsx replacing the preset/slider/preview/format blocks

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (functional parity with current page)

---

## Phase 5: User Story 3 - Follow export progress in its own section (Priority: P2)

**Goal**: Section 3 — idle hint → live percent/speed bar → plain-language error (FR-006)

**Independent Test**: No export → idle hint; export running → live Progress bar with percent; failure → plain-language error, sections 1–2 usable, no partial file shown

- [X] T010 [P] [US3] Write failing component test for ProgressSection idle/running/error states in src/features/sound-booster/file-booster/__tests__/ProgressSection.test.tsx
- [X] T011 [US3] Implement ProgressSection in src/features/sound-booster/file-booster/sections/ProgressSection.tsx (props: isExporting, progress clamped 0–100, speed, error)
- [X] T012 [US3] Wire ProgressSection into src/features/sound-booster/file-booster/FileBoosterPage.tsx moving progress/error display out of the export card

**Checkpoint**: At this point, User Stories 1, 2 AND 3 should all work independently

---

## Phase 6: User Story 4 - See output results and share them (Priority: P3)

**Goal**: Section 4 — save location, size + smaller/larger delta, open/play/share/copy-path, latest result only, empty state before first export (FR-007, FR-008, FR-009)

**Independent Test**: Completed export → file name, location, size, delta shown; all four actions work (open-folder hidden on Android); second export replaces result; file change clears section

- [X] T013 [P] [US4] Write failing component test for ResultSection empty/done/action states in src/features/sound-booster/file-booster/__tests__/ResultSection.test.tsx
- [X] T014 [US4] Implement ResultSection in src/features/sound-booster/file-booster/sections/ResultSection.tsx (props per contracts/sections-contract.md; share via shareAudioTrack, open via openPath guarded by isAndroid(), copy via clipboard + translated confirmation)
- [X] T015 [US4] Wire ResultSection into src/features/sound-booster/file-booster/FileBoosterPage.tsx with one statMediaPaths lookup per completed export for outputSizeBytes (delta = outputSizeBytes - file.sizeBytes via formatBytes)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Composition cleanup and full validation

- [X] T016 Slim src/features/sound-booster/file-booster/FileBoosterPage.tsx to a thin 4-section composition shell
- [X] T017 [P] Verify no touched file exceeds 300 lines and no hardcoded user-facing strings remain in src/features/sound-booster/file-booster/sections/ (grep check)
- [X] T018 [P] Run full validation per specs/005-booster-page-sections/quickstart.md (pnpm test src/features/sound-booster, pnpm build, EN/FA walkthrough of SC-001–SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Reuses US1's file state but testable with fixture props
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Reuses store progress fields; testable with fixture props
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Reuses store outputs; testable with fixture props

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution V)
- Test ([P], new file) before component implementation
- Component implementation before page-shell wiring
- Story complete before moving to next priority

### Parallel Opportunities

- T003 (SectionShell) is independent of T002 (i18n keys) - different files
- Test tasks T004/T007/T010/T013 can all run in parallel once Foundational completes (different test files)
- Section implementations T005/T008/T011/T014 target different files but share the page shell for wiring - implement in parallel, wire sequentially to avoid FileBoosterPage.tsx conflicts
- Polish checks T017/T018 run in parallel (read-only verification)

---

## Parallel Example: User Story 1

```bash
# Test first (independent file):
Task: "Write failing component test for UploadSection in src/features/sound-booster/file-booster/__tests__/UploadSection.test.tsx"
# Then implement (independent file):
Task: "Implement UploadSection in src/features/sound-booster/file-booster/sections/UploadSection.tsx"
```

## Parallel Example: Cross-story tests (after Foundational)

```bash
Task: "T004 UploadSection test in src/features/sound-booster/file-booster/__tests__/UploadSection.test.tsx"
Task: "T007 ConfigsSection test in src/features/sound-booster/file-booster/__tests__/ConfigsSection.test.tsx"
Task: "T010 ProgressSection test in src/features/sound-booster/file-booster/__tests__/ProgressSection.test.tsx"
Task: "T013 ResultSection test in src/features/sound-booster/file-booster/__tests__/ResultSection.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001 baseline)
2. Complete Phase 2: Foundational (T002–T003; i18n + SectionShell)
3. Complete Phase 3: User Story 1 (T004–T006; upload + explainer)
4. Complete Phase 4: User Story 2 (T007–T009; configs)
5. **STOP and VALIDATE**: Page has functional parity with clearer 2-section grouping; test US1+US2 independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 → Test independently → MVP start (upload with explainer)
3. Add US2 → Test independently → Full parity (MVP complete)
4. Add US3 → Test independently → Dedicated Progress bar section live
5. Add US4 → Test independently → Result + sharing closes the loop
6. Polish (Phase 7) → quickstart validation → done

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (T004–T006) + US2 (T007–T009)
   - Developer B: US3 (T010–T012)
   - Developer C: US4 (T013–T015)
3. Coordinate FileBoosterPage.tsx wiring edits (T006/T009/T012/T015) sequentially to avoid merge conflicts
4. Team converges on Polish (T016–T018)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Sections receive data via props only — never store/hook/IPC calls inside section components (contract)
- `ConfigsSection` stays mounted; gating is visual + `disabled` (protects preview Audio element)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
