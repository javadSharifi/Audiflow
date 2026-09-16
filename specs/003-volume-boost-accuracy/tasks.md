# Tasks: Volume Boost Accuracy & Seek Clarity

**Input**: Design documents from `/specs/003-volume-boost-accuracy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — constitution Principle V (Test-First, NON-NEGOTIABLE) requires Vitest + `cargo test` coverage for every changed mapping. Write each story's tests FIRST and ensure they FAIL before implementation.

**Organization**: Tasks grouped by user story; each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to ([US1], [US2], [US3])

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline before any change

- [X] T001 Run baseline gates and record results: `pnpm test src/stores/musicPlayer/__tests__/audioEngine.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml sound_booster`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Characterization test proving the double-IPC bug exists (fails after the US1 fix if it asserts single-path, guards the diagnosis)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add failing characterization test in `src/stores/musicPlayer/__tests__/audioEngine.test.ts` that counts mocked `androidPlayerSetBoosterGain` + `androidPlayerSetBoosterGainMb` calls for one `applyGainPercent(200)` on Android and documents the current double-call behavior

**Checkpoint**: Foundation ready — double-call bug is pinned by a test; user story work can begin

---

## Phase 3: User Story 1 — Honest boost loudness (Priority: P1) 🎯 MVP

**Goal**: One honest percent→gain path so 100% < 200% < 400% heard steps match the shown labels and dB badge, on Android first, desktop unchanged; file Manual preset unified to 0–400%

**Independent Test**: Same track at 100%/200%/400% — each step clearly louder, 200% a true middle step; `quickstart.md` §1–2 pass

### Tests for User Story 1 (write FIRST, ensure FAIL)

- [X] T003 [P] [US1] Failing monotonicity test for `boosterDbForPercent` in `src/stores/musicPlayer/__tests__/audioEngine.test.ts` (100→0 dB, 200→+6.0 dB, 400→+12.0 dB, strictly increasing per `contracts/booster-gain-mapping.contract.md` table)
- [X] T004 [P] [US1] Failing single-path test for `applyGainPercent` in `src/stores/musicPlayer/__tests__/audioEngine.test.ts` (exactly one gain IPC per boost change above 100%; disable pair (0,0) kept at ≤100%)
- [X] T005 [P] [US1] Failing cargo test for Manual 400% in `src-tauri/src/processing/sound_booster/presets.rs` (`build_preset_filter_chain(Manual, Some(400.0))` contains `volume=4.000` and ends in `alimiter`)

### Implementation for User Story 1

- [X] T006 [US1] Delete the parallel `androidPlayerSetBoosterGainMb(boosterMbForPercent(p))` call in `src/stores/musicPlayer/audioEngine.ts` so `applyGainPercent` issues exactly one gain IPC (`androidPlayerSetBoosterGain(boosterDbForPercent(p))`); remove now-dead `boosterMbForPercent` or its call site without growing the file (extract if needed, 300-line ceiling per Principle VIII)
- [X] T007 [US1] Extend Manual preset clamp from `0.0..200.0` to `0.0..400.0` in `src-tauri/src/processing/sound_booster/presets.rs` (filter template and `DEFAULT_LIMITER` terminator unchanged, single-pass graph unchanged)
- [ ] T008 [US1] Verify `BoosterView` in `src/components/music-player/BoosterView.tsx` needs no label change (100–400% + dB badge stay) and run `quickstart.md` §2 listening check on Android

**Checkpoint**: US1 independently functional — single honest mapping live + file, tests green

---

## Phase 4: User Story 2 — Clean scrubbing while boosted (Priority: P1)

**Goal**: Fast scrubbing coalesces into clean seeks — playback continues through the drag with no mute/fade, lands on the final position within 2 s, boost preserved

**Independent Test**: ≥20 seeks at 200% + 400% across start/middle/end with no sustained crackle; 3 rapid scrubs land on final position; `quickstart.md` §3 passes

### Tests for User Story 2 (write FIRST, ensure FAIL)

- [X] T009 [P] [US2] Failing trailing-debounce tests for new `src/stores/musicPlayer/seekDebounce.ts` with Vitest fake timers (burst of 10 requests in 500 ms → leading apply + exactly 1 trailing apply of the final target; single isolated request → synchronous apply with zero delay; short-track bypass per `data-model.md`)
- [X] T010 [P] [US2] Failing regression test in `src/stores/musicPlayer/__tests__/audioEngine.test.ts` that boost level is untouched by seeks and no gain IPC fires during the `SEEK_SETTLE_MS` window after `noteUserSeek`

### Implementation for User Story 2

- [X] T011 [US2] Implement trailing ~1000 ms seek coalescing helper in `src/stores/musicPlayer/seekDebounce.ts` per `contracts/seek-debounce.contract.md` (own module — do NOT grow `audioEngine.ts`)
- [X] T012 [US2] Wire the debounce helper into `seekTo` in `src/stores/useMusicPlayerStore.ts` keeping the immediate optimistic `set({ currentTime })` update; callers (`src/components/music-player/NowPlayingView.tsx`, `src/components/music-player/MiniPlayer.tsx`) unchanged
- [ ] T013 [US2] Run `quickstart.md` §3 seek validation on Android at 200% and 400% (≥20 seeks + rapid-scrub coalescing)

**Checkpoint**: US1 + US2 both work — honest loudness AND clean scrubbing

---

## Phase 5: User Story 3 — No painful surprises at high boost (Priority: P2)

**Goal**: Honest scaling kept at maximum with the existing >200% warning as the safety notice, and the mandatory full-scale `alimiter` ceiling proven intact on every chain

**Independent Test**: Loud track at 400% follows the same step as quiet tracks below full scale; every chain ends in `alimiter`; warning modal/banner shown and confirmed

### Tests for User Story 3 (write FIRST, ensure FAIL if not already covered)

- [X] T014 [P] [US3] Extend alimiter-presence cargo test in `src-tauri/src/processing/sound_booster/presets.rs` to assert Manual at 400% ends in `alimiter` (limiter-as-ceiling per Complexity Tracking entry in plan.md)

### Implementation for User Story 3

- [ ] T015 [US3] Verify high-boost confirmation modal + warning banner in `src/components/music-player/BoosterView.tsx` are unchanged and gate every >200% change (no new strings; both locales already present), and confirm `quickstart.md` §4 file-output check shows the single-pass graph ending in `alimiter`

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Gates, validation, shared memory

- [X] T016 [P] Run full gates: `pnpm generate:types && pnpm check:types` (expect untouched), `pnpm test`, `pnpm build`, `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] T017 Run `quickstart.md` §5 desktop no-regression (linear-amplitude progression, clean seeks, click-free slider)
- [X] T018 Add max-2-line row to `BUGFIXES.md` per AGENTS.md (double-IPC overwrite + seek-burst fix) and confirm regression tests exist (T004, T009)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational; then proceed in priority order P1 (US1) → P1 (US2) → P2 (US3), or in parallel if staffed (different files per story)
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no other story dependencies; touches `audioEngine.ts`, `presets.rs`
- **US2 (P1)**: After Foundational — independent of US1 (different files: `seekDebounce.ts`, `useMusicPlayerStore.ts`); safe to parallelize with US1
- **US3 (P2)**: After Foundational — builds on US1's Manual-400% change (T007) for the limiter assertion; otherwise independent

### Within Each User Story

- Tests FIRST (must FAIL before implementation) → implementation → story checkpoint validation
- US1: T003–T005 (tests) → T006–T007 (implementation, parallel-safe: different files) → T008 (validation)
- US2: T009–T010 (tests) → T011 → T012 → T013 (validation)
- US3: T014 (test) → T015 (verification)

### Parallel Opportunities

- T003, T004, T005: parallel (same test files but distinct `describe` blocks — run together, author sequentially to avoid edit conflicts; or split: T003+T004 in `audioEngine.test.ts`, T005 in `presets.rs` fully parallel)
- T006 (`audioEngine.ts`) + T007 (`presets.rs`): fully parallel (different languages/files)
- T009 (`seekDebounce` tests) + T010 (settle-window test): parallel
- US1 (T003–T008) and US2 (T009–T013) tracks: parallel across developers (no shared files except the test file — coordinate appends)
- T016, T017, T018: T016+T017 parallel (device vs terminal); T018 after

---

## Parallel Example: User Story 1

```bash
# Author tests together (T003+T004 same file — sequential edits, one run):
pnpm test src/stores/musicPlayer/__tests__/audioEngine.test.ts
# Meanwhile in parallel:
cargo test --manifest-path src-tauri/Cargo.toml sound_booster   # T005

# Implementation in parallel (different files):
# Dev A: T006 src/stores/musicPlayer/audioEngine.ts
# Dev B: T007 src-tauri/src/processing/sound_booster/presets.rs
```

## Parallel Example: User Stories 1 + 2

```bash
# Dev A (US1): single-path gain in audioEngine.ts + presets.rs Manual 400%
# Dev B (US2): new seekDebounce.ts + useMusicPlayerStore.ts wiring
# Shared file audioEngine.test.ts — coordinate appends or split then merge
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational characterization)
2. Complete Phase 3 (US1 honest loudness)
3. **STOP and VALIDATE**: listening check 100/200/400% with the reporting user (SC-001/SC-004)
4. Demo if ready — trust in the numbers is the core complaint

### Incremental Delivery

1. Setup + Foundational → double-call bug pinned
2. + US1 → honest percentages live + file (MVP)
3. + US2 → clean scrubbing with soft debounce (second P1 — the crackle complaint)
4. + US3 → limiter-ceiling proof + warning verification
5. Each increment independently testable per its checkpoint

### Scope Notes

- No new IPC commands, no new screens, no new user-facing strings, no range beyond 400% (plan.md constraints)
- `audioEngine.ts` (858 lines) must NOT grow — new logic goes in `seekDebounce.ts`
- `.specify/extensions.yml` absent — no before/after_tasks hooks to dispatch
```

**Validation**: all 18 tasks use `- [ ] TNNN [P?] [USn?] description + file path`; story phases carry [US1]/[US2]/[US3]; setup/foundational/polish carry no story label.
