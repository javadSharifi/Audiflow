# Tasks: Boost Slider Debounce

**Input**: Design documents from `/specs/004-boost-slider-debounce/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — constitution Principle V (Test-First) requires Vitest coverage for the new timing helper. Tests FIRST, ensure FAIL before implementation.

**Organization**: Grouped by user story; each story independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies)
- **[Story]**: [US1] smooth drag + settle (P1), [US2] live UI number (P2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline before any change

- [X] T001 Run baseline: `pnpm test src/stores/musicPlayer/__tests__/audioEngine.test.ts src/stores/musicPlayer/__tests__/seekDebounce.test.ts` and record green counts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pin the current per-tick apply behavior with a failing test

**⚠️ CRITICAL**: No user story work until this phase is complete

- [X] T002 Add failing test in `src/stores/musicPlayer/__tests__/audioEngine.test.ts` proving one `setVolumeGainPercent` drag burst (10 rapid store calls) currently fans out to 10 engine `applyGainPercent` applications (count via mocked `androidPlayerSetBoosterGain` on Android)

**Checkpoint**: Chop source pinned — story work can begin

---

## Phase 3: User Story 1 — Smooth boost dragging with zero chopping (Priority: P1) 🎯 MVP

**Goal**: Gain glides behind the finger (leading + ~150 ms throttled intermediates + trailing settle), zero chop, settle on shown number ≤1 s

**Independent Test**: 60-request burst in tests → leading + ~6 intermediates + final flush; device drags per `quickstart.md` §2–3

### Tests for User Story 1 (write FIRST, ensure FAIL)

- [X] T003 [P] [US1] Failing glide tests for new `src/stores/musicPlayer/gainGlide.ts` in `src/stores/musicPlayer/__tests__/gainGlide.test.ts` with fake timers (burst of 60 requests in 1000 ms → leading apply + ≤8 intermediate applies + exactly 1 trailing apply of the final value; single isolated request → synchronous apply with zero delay; `cancel()` drops pending)
- [X] T004 [P] [US1] Failing settle test in `src/stores/musicPlayer/__tests__/gainGlide.test.ts` (trailing flush fires ~150 ms after the last request with the exact final value; never an intermediate)

### Implementation for User Story 1

- [X] T005 [US1] Implement `createGainGlider(apply, intervalMs = 150)` in `src/stores/musicPlayer/gainGlide.ts` per `contracts/gain-glide.contract.md` (leading + throttle + trailing + `cancel()`; own module — do NOT grow `audioEngine.ts` or the store file with the timing logic)
- [X] T006 [US1] Rewire `setVolumeGainPercent` in `src/stores/useMusicPlayerStore.ts`: `set({ volumeGainPercent })` stays per-tick (live UI), engine `applyGainPercent` + `persistSavedBoosterGain` move behind the module-scope glider (apply-then-persist ordering kept; toggle-off path cancels pending and applies its target directly)
- [ ] T007 [US1] Run `quickstart.md` §2–3 on Android (≥20 full-range drags slow + fast, settle-on-release check) — device-dependent, report results

**Checkpoint**: US1 functional — smooth glide, exact settle, tests green

---

## Phase 4: User Story 2 — Live UI number while audio follows softly (Priority: P2)

**Goal**: Displayed number/arc/badge track every finger movement with no lag while audio glides behind

**Independent Test**: `quickstart.md` §4 on Android; code assertion that `set()` is outside the glider path

### Tests for User Story 2

- [X] T008 [P] [US2] Test in `src/stores/musicPlayer/__tests__/gainGlide.test.ts` (or store-level test) asserting a burst of store `setVolumeGainPercent` calls updates `volumeGainPercent` state on every call even while engine applies are throttled (state write is NOT routed through the glider)

### Implementation for User Story 2

- [X] T009 [US2] Verify in `src/stores/useMusicPlayerStore.ts` that the `set({ volumeGainPercent: clamped })` line executes synchronously per call with no gating on the glider (refactor only if T008 fails); confirm `src/components/music-player/BoosterView.tsx` needs no change

**Checkpoint**: Number alive every tick, audio smooth behind it

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Gates, gate regression, shared memory

- [X] T010 [P] Run full gates: `pnpm test`, `pnpm build` (tsc), `cargo test` (sanity, untouched), `pnpm check:types` (expect no diff — no IPC change)
- [ ] T011 Run `quickstart.md` §5 (>200% modal gate regression) on Android — device-dependent, report results
- [X] T012 Add max-2-line row to `BUGFIXES.md` (per-tick gain apply → glide helper) and confirm regression tests exist (T003, T008)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** BLOCKS stories → **US1 (Phase 3, P1)** → **US2 (Phase 4, P2)** → **Polish (Phase 5)**
- US2 depends on US1's wiring (T006) for the state-vs-engine split assertion; otherwise independent
- T003 + T004 parallel (same new test file — sequential edits, one run); T005 → T006 strict order; T010 + T011 parallel (terminal vs device); T012 last
- MVP: Phase 3 (US1) only — stop, validate drag smoothness with the reporting user, then US2/Polish

## Parallel Example

```bash
# Tests together (one file, sequential authoring):
pnpm test src/stores/musicPlayer/__tests__/gainGlide.test.ts
# After T005+T006:
pnpm test src/stores/musicPlayer/__tests__/  # all green, no regressions
```

---

## Implementation Strategy

1. Setup + Foundational → per-tick fan-out pinned by T002
2. + US1 (T003–T007) → smooth glide + exact settle (MVP — validate with user)
3. + US2 (T008–T009) → UI-liveness proof
4. + Polish → gates, gate regression, BUGFIXES row
```

**Validation**: all 12 tasks use `- [ ] TNNN [P?] [USn?] description + file path`; story phases carry [US1]/[US2]; setup/foundational/polish carry no story label.
