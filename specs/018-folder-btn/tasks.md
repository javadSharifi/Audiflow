--—

description: "Task list for feature implementation"
---

# Tasks: macOS Add-Folder Button

**Input**: Design documents from `/specs/018-folder-btn/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅ (no `contracts/` — frontend-only, no IPC surface change)

**Tests**: Tests are explicitly required — the constitution (Principle V, NON-NEGOTIABLE) mandates test-first coverage, and spec.md declares Vitest as the verification layer. Every story below includes its tests, written FIRST and confirmed FAILING before implementation.

**Organization**: Tasks grouped by user story (US1 = P1 core flow, US2 = P2 platform gating, US3 = P3 persistence). US2 is realized inside `AddFolderButton.tsx` (render gate) and therefore shares files with US1 — the two stories are ordered, not parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature branch and shared plumbing only — no product logic

- [ ] T001 Create and switch to feature branch `018-folder-btn` (currently on `main`; branch name proposed by create-new-feature.sh)
- [ ] T002 [P] Verify baseline is green before any change: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:types`

**Checkpoint**: Clean baseline recorded; feature work can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pieces every user story depends on

- [ ] T003 [P] Add i18n keys to `src/i18n/en.ts`: `addFolderTitle`, `addFolderAddedOne`, `addFolderAddedMany` (with `{count}`), `addFolderNoMusic` — exact values per data-model.md
- [ ] T004 [P] Add the same four keys to `src/i18n/fa.ts` (Persian values per data-model.md; RTL preserved)
- [ ] T005 Implement batched store action `addCustomFolders(paths: string[]): Promise<number>` in `src/stores/useMusicPlayerStore.ts` beside the existing `addCustomFolder` (dedupe via existing `customFolders`, one `persistCustomFolders` call, one `scanLibrary(next)`, return count of newly accepted paths — contract per data-model.md)

**Checkpoint**: Foundation ready — store can batch-accept picks with a single scan; strings available in both locales.

---

## Phase 3: User Story 1 — Add a music folder from next to search on macOS (Priority: P1) 🎯 MVP

**Goal**: macOS user taps a button next to search, picks a folder in the native picker, and its tracks appear after one scan; all pick outcomes surfaced per clarification lock (toasts; cancel silent; re-pick silent; no per-duplicate toasts).

**Independent Test**: On a macOS host (`pnpm tauri dev`): tap the button, pick a folder with audio files, confirm tracks appear + info toast; re-pick = silent; empty folder = warning toast; cancel = nothing.

### Tests for User Story 1 ⚠️ Write FIRST, confirm FAIL before implementation

- [ ] T006 [P] [US1] Component tests in `src/components/music-player/__tests__/AddFolderButton.test.tsx` (mock `@tauri-apps/plugin-dialog` + store actions per `FirstRunFoldersGate.test.tsx` mock pattern):
  - macOS (mocked `isMacOS` true): button renders next to search with `addFolderTitle` label; click calls `pickDirectories` and the batched store action with picked paths
  - pixel: pick returns `[]` (cancel) → store action NOT called, no toast
  - pixel: all picked paths already tracked → store action not called (or returns 0), no toast
  - pixel: accept + track delta 0 → warning toast `addFolderNoMusic`
  - pixel: accept + delta > 0 → info toast singular/plural key chosen by count
  - `loading` true → button disabled and click is a no-op
  - re-entrancy: click while a pick is in flight does not open a second dialog

### Implementation for User Story 1

- [ ] T007 [US1] Create `src/components/music-player/useAddFolderPick.ts` — the pick flow hook per data-model.md: re-entrancy ref → `pickDirectories()` → outcome classification (cancelled / skipped / added / empty via pre-scan `tracks.length` snapshot) → one `pushToast` max via `useAppStore.getState().pushToast`; calls `addCustomFolders`
- [ ] T008 [US1] Create `src/components/music-player/AddFolderButton.tsx` — `FolderPlus` icon button, `title`/`aria-label` = `translate(lang, "addFolderTitle")`, `disabled={loading}` (parity with rescan button), `onClick` → hook; temporarily renders unconditionally (US2 adds the mac gate) so US1 is independently testable
- [ ] T009 [US1] Wire into `src/components/music-player/TrackListView.tsx` search/sort/rescan row (between `TrackSortDropdown` and the rescan button, lines ~181–192): render `<AddFolderButton />` — keep growth ≤3 lines (297/300 ceiling)
- [ ] T010 [US1] Confirm T006 tests now PASS; run `pnpm test src/components/music-player/__tests__/AddFolderButton.test.tsx`

**Checkpoint**: US1 functional on macOS — full P1 flow (tap → picker → scan → tracks + outcome toast), all edge outcomes classified. Stop and validate per quickstart.md scenarios 1–5.

---

## Phase 4: User Story 2 — Button appears only on macOS (Priority: P2)

**Goal**: Android, Windows, Linux never see the button; macOS always does. Non-macOS builds structurally unchanged.

**Independent Test**: Render `AddFolderButton` with mocked platform signals: mac → present; android/win/linux → renders `null`; plus quickstart.md scenario 7 on real hosts later.

### Tests for User Story 2 ⚠️ Write FIRST, confirm FAIL before implementation

- [ ] T011 [P] [US2] Add platform-visibility cases to `src/components/music-player/__tests__/AddFolderButton.test.tsx` (mock `isMacOS` from `src/utils/platform`):
  - macOS → button present
  - Android / Windows / Linux user-agent mocks → renders `null` (row untouched)
  - non-macOS + `loading` → still `null`

### Implementation for User Story 2

- [ ] T012 [US2] In `src/components/music-player/AddFolderButton.tsx`: gate render on `isMacOS()` — `if (!isMacOS()) return null;` before the JSX return (evaluated at render, zero footprint on other platforms)
- [ ] T013 [US2] Confirm T011 cases PASS; verify no regression in T006 suite

**Checkpoint**: US1 + US2 both independently verified — mac-only visibility locked.

---

## Phase 5: User Story 3 — Added folders persist across restarts (Priority: P3)

**Goal**: Picked folders re-scan on startup; unavailable folders degrade gracefully.

**Independent Test**: Add a folder, restart the app, tracks still listed without re-picking; on-disk rename before relaunch degrades gracefully. Automated coverage at unit level; live restart per quickstart.md scenario 6.

### Tests for User Story 3 ⚠️ Write FIRST, confirm FAIL before implementation

- [ ] T014 [P] [US3] Store-level test for the batched action in `src/stores/musicPlayer/__tests__/` (file: `addCustomFolders.test.ts`; mock `persistence.ts` + `scanAudioFiles`):
  - mixed pick (1 new + 1 already tracked) persists exactly `[...customFolders, fresh]` once via `persistCustomFolders` and triggers exactly one `scanLibrary` call (N+1 regression guard)
  - all-duplicate pick persists nothing and scans nothing (returns 0)
  - resolution: scan-applied `customFolders` seed re-used by a later default `scanLibrary()` call (persistence contract)
- [ ] T015 [P] [US3] Add a persistence case to `src/components/music-player/__tests__/AddFolderButton.test.tsx`: after an accepted pick, `persistCustomFolders` received the folder path (assert via mocked persistence shim) — restart behavior itself stays a manual live-restart check per quickstart.md.

### Implementation for User Story 3

- [ ] T016 [US3] Confirm T014/T015 PASS — no new implementation expected (P3 is satisfied by reusing `persistCustomFolders` + startup `scanLibrary` customFolders seed from T005); if a gap surfaces, patch `addCustomFolders` and re-run
- [ ] T017 [US3] Confirm startup path unchanged for users who never used the button: existing default-scan test in `src/stores/musicPlayer/__tests__/` still green (FR-008)

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Verify 300-line ceiling constitution rule: `wc -l` on `TrackListView.tsx` (~297), `AddFolderButton.tsx`, `useAddFolderPick.ts`, `useMusicPlayerStore.ts` growth — all new files well under 300; record `useMusicPlayerStore` pre-existing overage in PR description (per plan.md Complexity Tracking)
- [ ] T019 [P] Run full gates: `pnpm lint` + `pnpm test` + `pnpm build` + `pnpm check:types` + `pnpm test:rust` (rust expected unaffected/green)
- [ ] T020 Run quickstart.md manual validation on macOS host (scenarios 1–8: core flow, duplicates, empty folder, cancel, mid-scan, live restart, platform hosts, RTL/fa)
- [ ] T021 [P] Update shared memory (AGENTS.md protocol): `PROJECT_GRAPH.md` rows for `AddFolderButton.tsx` / `useAddFolderPick.ts` + `BUGFIXES.md` only if a regression was fixed during the work

**Checkpoint**: Feature complete — ready for PR per plan.md CI gates.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T002)**: immediate; T002 baseline before any edit
- **Foundational (T003–T005)**: T003/T004 parallel; T005 independent → all block every story
- **US1 (T006–T010)**: depends on Foundational; T006 (test) before T007/T008 (impl) before T009 (wiring) before T010
- **US2 (T011–T013)**: depends on US1 (shares `AddFolderButton.tsx`); T011 before T012
- **US3 (T014–T017)**: T014/T015 parallel, depend on T005 only — US3 does NOT wait for US1/US2; T016–T017 after T014/T015
- **Polish (T018–T021)**: after all stories

### Parallel Opportunities

- T003 ∥ T004 ∥ T005 (Foundational)
- T006 ∥ T014 ∥ T015 (test files, different targets) — though T006 blocks T007+
- US3 store-level work can proceed while US1/US2 component work is in flight (different files)
- T018 ∥ T019 ∥ T021

## Implementation Strategy

1. **MVP first**: Setup → Foundational → US1 → validate on macOS (quickstart 1–5). The user's core request ("دکمه بغل سرچ، انتخاب کن، دسترسی بده، به لیست اضافه بشه") is complete at this point.
2. **US2 gate** (tiny, rides on T008): mac-only visibility — validate scenario 7 structurally.
3. **US3 durability**: batched-action persistence tests + live restart check.
4. Unit-level test-first is enforced per story (T006, T011, T014–T015 written first and confirmed failing); live verification remains quickstart.md.

## Notes

- `contracts/` intentionally absent — no Rust/IPC/schema change; `pnpm check:types` must stay green as a negative gate (T002, T019)
- All strings via `translate()` in BOTH `en.ts`/`fa.ts` (T003–T004) — required for merge (Principle VIII NON-NEGOTIABLE)
- Toast integration via `useAppStore.getState().pushToast` — locked in /speckit.clarify (option "A", toast system, no per-duplicate toasts, silent skip for re-picks)
- Never call `invoke()` from components — the flow ends at the typed `api.scanAudioFiles` helper (Principle III)
