# Tasks: Wizard UI Fixes

**Input**: Design documents from `/specs/006-wizard-ui-fixes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per constitution Principle V (test-first; Vitest + Testing Library).

**Organization**: Grouped by user story; each story independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: i18n keys every story depends on

- [X] T001 Add `resultDoneMessage`, `resultFolderGuidance`, `resultFailedLabel`, `trimBoostHint` (+ reuse audit) to `src/i18n/en.ts` and `src/i18n/fa.ts`
- [X] T002 [P] Verify `TranslationKey` union picks up new keys (`pnpm build` typecheck covers it)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared result-row derivation used by US1

- [X] T003 Create `src/components/converter-wizard/WizardResultList.tsx` shell rendering `wizard-result-list` from `jobs` store (empty-state via `converterResultEmpty`), no rows yet
- [X] T004 [P] Write failing test `src/components/converter-wizard/__tests__/WizardResultList.test.tsx` (empty state + folder banner absent)

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: US1 — All-outputs result list (P1) 🎯 MVP

**Goal**: Result step lists every output (name/format/size) + error rows + folder banner; no action buttons/preview; inputs auto-clear.

**Independent Test**: Convert 2 files (1 success, 1 failure) → result shows 1 success row, 1 error row, 1 folder banner, zero buttons/audio; file list empty.

### Tests for US1 (write FIRST, fail before impl)

- [X] T005 [P] [US1] Extend `WizardResultList.test.tsx`: success rows with name/format/size, unreadable-size row without size, error rows with name+error, no `audio`/`button` selectors present
- [X] T006 [P] [US1] Extend `ConverterWizard.test.tsx`: jobs retained + `files === []` when step 4 appears

### Implementation for US1

- [X] T007 [P] [US1] Implement success/error rows + per-folder banners in `WizardResultList.tsx` (single batched `statMediaPaths`, per contracts C1)
- [X] T008 [US1] Wire `WizardResultList` into `WizardResultStep.tsx`, delete `ConverterResultSection` usage (decide delete vs repurpose per research D5; rewrite its test or remove)
- [X] T009 [US1] Call `clearFiles()` on entering step 4 in `ConverterWizard.tsx` (jobs retained; research D4)
- [X] T010 [US1] Run `pnpm test` (wizard suites) + `pnpm build` green

**Checkpoint**: US1 independently functional — full convert → result flow verified

---

## Phase 4: US2 — Buttons never behind nav (P1)

**Goal**: All wizard CTAs fully visible above bottom nav at 360px+; no floating overlap bars.

**Independent Test**: Walk 4 steps at 360px width; every CTA fully visible/tappable above nav.

### Tests for US2

- [X] T011 [P] [US2] Add assertion in `ConverterWizard.test.tsx`: wizard container bottom clearance class present; no `start-conversion` fixed-bar element in `App` converter pane

### Implementation for US2

- [X] T012 [US2] Verify/set wizard scroll container bottom padding in `ConverterWizard.tsx`; confirm no fixed-position elements remain in converter flow (`App.tsx` already removed StartBar — verify, delete leftovers)

**Checkpoint**: US1 + US2 both work; CTA reachability proven

---

## Phase 5: US3 — Discoverable trim/boost (P2)

**Goal**: Labeled ≥40px trim/boost controls in both FileList layouts + helper line under list.

**Independent Test**: Add 1 file (desktop + mobile widths) → labeled controls tappable; helper line with emphasized terms visible.

### Tests for US3

- [X] T013 [P] [US3] Extend `src/components/__tests__/FileList.test.tsx`: labels present on `trim-toggle-*`/`boost-toggle-*` (+mobile variants), `trim-boost-hint` rendered with key-term emphasis

### Implementation for US3

- [X] T014 [US3] Convert icon-only `h-6 w-6` buttons to labeled pills (≥40px) in both layouts in `src/components/FileList.tsx`
- [X] T015 [US3] Add `trim-boost-hint` helper line under list in `src/components/FileList.tsx` (contract C3)

**Checkpoint**: US3 independently functional

---

## Phase 6: US4 — Compact buttons, no capability cards (P3)

**Goal**: Wizard CTAs at nav scale; capability cards gone from upload step.

**Independent Test**: Upload step shows no cards; Next/Back/Convert/Restart are `h-[52px]`.

### Tests for US4

- [X] T016 [P] [US4] Extend `ConverterWizard.test.tsx`: `wizard-next`/`wizard-convert`/`wizard-restart`/`wizard-back` have nav-scale height class; upload step contains no capability list

### Implementation for US4

- [X] T017 [US4] Remove `CAPS` grid from `WizardUploadStep.tsx`
- [X] T018 [US4] Set CTAs to `h-[52px]` in `WizardUploadStep.tsx`, `WizardConfigsStep.tsx`, `WizardResultStep.tsx` (contract C2)

**Checkpoint**: All stories independently functional

---

## Phase 7: Polish & Cross-Cutting

- [X] T019 [P] Persian RTL pass on changed screens (fa locale, banner/hint/rows/CTA alignment)
- [X] T020 [P] Remove dead `ConverterResultSection` files/tests if fully replaced; update `PROJECT_GRAPH.md` + `.agents/references/frontend-features.md`
- [X] T021 Full `pnpm test` (43+ files) + `pnpm build` green; run `quickstart.md` validation end-to-end
- [X] T022 `pnpm tauri build`, install to `/Applications/Audiflow.app`, verify wizard strings in fresh bundle

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phases 3–6 (US1..US4 sequential in priority order; US2/US3/US4 may parallelize after Phase 2 if staffed — different files except shared `ConverterWizard.test.tsx` appends)
- Phase 7 after all desired stories
- Tests within each story FAIL before implementation (constitution V)
- Within a story: tests → implementation → `pnpm test` + `pnpm build`

## Parallel Opportunities

- T002, T004, T005, T006, T011, T013, T016, T019, T020 marked [P] (different files)
- T007 (new component) parallel with T009 (wizard shell) — different files
