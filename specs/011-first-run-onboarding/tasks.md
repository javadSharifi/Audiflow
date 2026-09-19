# Tasks: First-Run Onboarding

**Input**: Design documents from `specs/011-first-run-onboarding/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per Constitution Principle V (test-first, NON-NEGOTIABLE). Write each story's tests FIRST and ensure they FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline before touching code

- [x] T001 Run baseline Vitest suites for `src/components/music-player/__tests__/` and `src/utils/bootPrefs.test.ts` and record the green baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Copy keys every story's UI depends on — MUST complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Add onboarding copy keys (titles, descriptions, actions per `specs/011-first-run-onboarding/contracts/onboarding-ui.md`) to `src/i18n/en.ts`
- [x] T003 [P] Add the identical onboarding key set with Persian wording to `src/i18n/fa.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Complete one-time start page on fresh install (Priority: P1) 🎯 MVP

**Goal**: Fresh install sees a single start page before the main screen; confirm/skip enters the app forever; upgrades never see it.

**Independent Test**: `specs/011-first-run-onboarding/quickstart.md` Scenarios 1–3 and 5 with stub section content — page shows once, confirm/skip persists, kill-midway re-shows with values, upgrade evidence skips the page.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Gate visibility, confirm, and global-skip tests in `src/components/onboarding/__tests__/OnboardingGate.test.tsx`
- [x] T005 [P] [US1] Prior-use-evidence grandfathering tests in `src/utils/bootPrefs.test.ts`

### Implementation for User Story 1

- [x] T006 [US1] Prior-use-evidence helper with silent grandfathering in `src/utils/bootPrefs.ts` (flag unset + `ac:ui-prefs`/`ac:reduced-blur`/cached-tracks check quoting constraint: "written only via confirm or global skip; never written by section-level interaction or permission grant/deny" and "absent → complete (confirm/skip, or silent grandfathering on upgrade with prior-use evidence)")
- [x] T007 [US1] Single-page gate shell with four section slots, one confirm action, and one global skip quoting constraint: "Safe defaults on skip: Persian, system-follow theme, performance mode on for constrained/mobile devices and off otherwise" in `src/components/onboarding/OnboardingGate.tsx` (lazy-loadable, file stays under 300 lines)
- [x] T008 [US1] Wire the gate into the boot flow in `src/App.tsx` (show condition, confirm/skip handlers marking `ac:first-run-done`, retired legacy gates detached from boot path, library scan deferred while gate is up)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Grant or skip access permissions during onboarding (Priority: P1)

**Goal**: Permission group explains access, offers grant / OS-settings / skip, and never blocks confirm.

**Independent Test**: `specs/011-first-run-onboarding/quickstart.md` Scenario 4 — deny/skip leads to a usable main screen within seconds; permanently-denied routes to OS settings.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US2] Permission section tests (grant, deny, skip, permanently-denied paths) in `src/components/onboarding/__tests__/PermissionSection.test.tsx`

### Implementation for User Story 2

- [x] T010 [US2] Permission section quoting constraints: "granted | denied | permanentlyDenied | skipped | notRequired" and "no permission state blocks onboarding completion or later app use; permanentlyDenied routes the user to OS settings instead of a dead-end retry" in `src/components/onboarding/PermissionSection.tsx`
- [x] T011 [US2] Mount the permission section into the gate shell in `src/components/onboarding/OnboardingGate.tsx` (depends on T010)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Pick theme, language, and performance mode with live preview (Priority: P2)

**Goal**: Three preference groups with immediate live preview (brightness, RTL/LTR labels, reduced effects), persisted on change.

**Independent Test**: Change each option on the start page, observe immediate preview, confirm, restart — all choices applied (`specs/011-first-run-onboarding/spec.md` SC-004).

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] [US3] Theme section tests (light/dark/system immediate preview) in `src/components/onboarding/__tests__/ThemeSection.test.tsx`
- [x] T013 [P] [US3] Language section tests (fa/en labels + RTL/LTR flip) in `src/components/onboarding/__tests__/LanguageSection.test.tsx`
- [x] T014 [P] [US3] Performance section tests (on/off immediate effect + persistence) in `src/components/onboarding/__tests__/PerformanceSection.test.tsx`

### Implementation for User Story 3

- [x] T015 [P] [US3] Theme section quoting constraints: "light | dark | system", "single writer: useTheme", and "anything else falls back to safe defaults" in `src/components/onboarding/ThemeSection.tsx`
- [x] T016 [P] [US3] Language section quoting constraints: "fa | en" and "anything else falls back to safe defaults (Persian)" in `src/components/onboarding/LanguageSection.tsx`
- [x] T017 [P] [US3] Performance section quoting constraints: "on | off (ac:reduced-blur (\"1\"/\"0\"))" and "safe defaults on skip: performance mode on for constrained/mobile devices and off otherwise" in `src/components/onboarding/PerformanceSection.tsx`
- [x] T018 [US3] Mount the three preference sections into the gate shell in `src/components/onboarding/OnboardingGate.tsx` (depends on T015, T016, T017)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Simplified settings without theme and auto-open-folder (Priority: P2)

**Goal**: Settings dialog contains no theme and no auto-open-folder controls; stored auto-open values migrate to off; quick theme toggle keeps working.

**Independent Test**: `specs/011-first-run-onboarding/quickstart.md` Scenario 6 — both languages show no removed rows, retained rows persist, previously-on auto-open behaves as off, manual per-result open still works.

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T019 [P] [US4] Settings-dialog tests (theme/auto-open rows absent, language + performance rows persist) in `src/components/__tests__/HeaderBar.test.tsx`
- [x] T020 [P] [US4] Auto-open coercion tests quoting constraint: "auto-open-output-folder coerced to false on settings load, with the correction persisted when a stored true is found (one-time self-healing migration)" in `src/stores/slices/settingsSlice.test.ts`

### Implementation for User Story 4

- [x] T021 [US4] Delete the theme row and auto-open-output-folder row from the settings dialog in `src/components/HeaderBar.tsx`
- [x] T022 [US4] Coerce `autoOpenOutputFolder` to `false` on load with one-time persist of the correction in `src/stores/slices/settingsSlice.ts` quoting constraint: "auto-open-output-folder coerced to false on settings load, with the correction persisted when a stored true is found (one-time self-healing migration)"
- [x] T023 [US4] Remove the now-dead `queue-idle` auto-open branch in `src/App.tsx`

**Checkpoint**: At this point, all four user stories should work and the settings surface matches the contract

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and shared-memory upkeep

- [x] T024 Run all six `specs/011-first-run-onboarding/quickstart.md` validation scenarios end-to-end (fresh, skip, kill-midway, denied permissions, upgrade, settings)
- [x] T025 [P] Run the full quality gates: `pnpm test`, typecheck, lint, and build from repo root
- [x] T026 [P] Update the navigation index in `PROJECT_GRAPH.md` for the new `src/components/onboarding/` domain per `AGENTS.md`

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
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with the US1 shell via T011
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Integrates with the US1 shell via T018
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent of US1–US3 (touches `src/components/HeaderBar.tsx`, `src/stores/slices/settingsSlice.ts`, and `src/App.tsx` only)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Section components before shell mounting tasks (T010 before T011; T015–T017 before T018)
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup/Foundational tasks marked [P] can run in parallel: T002 + T003 (separate locale files)
- All tests for each user story marked [P] can run in parallel:
  - US1: T004 + T005
  - US3: T012 + T013 + T014
  - US4: T019 + T020
- Model/Component creation tasks marked [P] can run in parallel:
  - US3: T015 + T016 + T017 (independent section components)
- Across user stories: US4 can proceed in parallel with US1–US3 once Phase 2 is complete
- Polish tasks: T025 + T026 in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Gate visibility, confirm, and global-skip tests in src/components/onboarding/__tests__/OnboardingGate.test.tsx"
Task: "Prior-use-evidence grandfathering tests in src/utils/bootPrefs.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch test for User Story 2:
Task: "Permission section tests in src/components/onboarding/__tests__/PermissionSection.test.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task: "Theme section tests in src/components/onboarding/__tests__/ThemeSection.test.tsx"
Task: "Language section tests in src/components/onboarding/__tests__/LanguageSection.test.tsx"
Task: "Performance section tests in src/components/onboarding/__tests__/PerformanceSection.test.tsx"

# Launch all sections for User Story 3 together:
Task: "ThemeSection in src/components/onboarding/ThemeSection.tsx"
Task: "LanguageSection in src/components/onboarding/LanguageSection.tsx"
Task: "PerformanceSection in src/components/onboarding/PerformanceSection.tsx"
```

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: "Settings-dialog tests in src/components/__tests__/HeaderBar.test.tsx"
Task: "Auto-open coercion tests in src/stores/slices/settingsSlice.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (Scenarios 1–3, 5)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Shell) → User Story 2 (Permissions)
   - Developer B: User Story 3 (Theme, Language, Performance)
   - Developer C: User Story 4 (Simplified Settings)
3. Stories complete and integrate independently into the shell

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Data-model constraints quoted verbatim where they bind implementation: theme `light | dark | system`, language `fa | en`, auto-open forced `false`, completion written only via confirm/skip
