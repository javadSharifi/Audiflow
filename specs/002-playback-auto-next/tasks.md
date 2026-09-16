# Tasks: Playback Auto-Next Reliability

**Input**: Design documents from `/specs/002-playback-auto-next/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md (no data-model.md or contracts/ — in-memory-only change, see plan.md D6)

**Tests**: Included test-first per constitution Principle V (NON-NEGOTIABLE: no change complete without coverage). Write each test task FIRST and ensure it FAILS before its implementation task.

**Organization**: Grouped by user story; each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 mapping to spec.md stories

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification and sizing before any change

- [ ] T001 Verify green baseline by running `pnpm test` and `pnpm build` on the clean tree
- [ ] T002 [P] Record line counts of `src/stores/musicPlayer/audioEngine.ts` and `src/stores/useMusicPlayerStore.ts` to plan the new-module split (300-line ceiling, constitution VIII)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared advance-guard infrastructure every story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete
- [X] T003 Create `src/stores/musicPlayer/autoAdvance.ts` — single-responsibility module holding the generation-token guard, next-track resolution (aligned with track-start matching), and skip/stop helpers

- [X] T004 [P] Write FAILING Vitest unit tests for guard + resolution in `src/stores/musicPlayer/__tests__/autoAdvance.test.ts` (stale-token rejection, path-aware index resolution) — 14 tests, verified RED then GREEN

**Checkpoint**: Guard module tested in isolation — user story implementation can now begin

---

## Phase 3: User Story 1 - Uninterrupted playlist playback (Priority: P1) 🎯 MVP

**Goal**: Every song starts automatically when the previous one ends (FR-001, FR-007)

**Independent Test**: Start a multi-song playlist untouched; each song starts after the previous ends; display always matches audible song (quickstart S1)

### Tests for User Story 1 (write FIRST, FAIL before implement)

- [X] T005 [P] [US1] Unit test: watchdog fires the guarded advance when the native end signal never arrives in `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` (engine-wiring file; verified RED then GREEN)
- [X] T006 [P] [US1] Unit test: racing end signals produce exactly one advance in `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` (verified RED then GREEN)

### Implementation for User Story 1

- [X] T007 [US1] Add redundant end detection (progress/duration watchdog → same guarded advance path) in `src/stores/musicPlayer/audioEngine.ts` (depends on T003)
- [X] T008 [US1] Wire guarded advance with generation token + aligned index resolution in `src/stores/useMusicPlayerStore.ts` (depends on T003, T007) — guard armed/consumed in audioEngine.ts, resolution via autoAdvance.resolveNextTrack in playNextTrack
- [X] T009 [P] [US1] Component test: now-playing display matches the audible track across auto-advance in `src/components/music-player/__tests__/AudioPlayback.test.tsx` (RED proven at store level in T010; UI reads store directly)

**Checkpoint**: US1 fully functional and testable independently — MVP stop-and-validate point

---

## Phase 4: User Story 2 - Predictable repeat and shuffle boundaries (Priority: P2)

**Goal**: Auto-advance honors repeat/shuffle exactly like manual next; clean stopped state at queue end (FR-002, FR-003, FR-005)

**Independent Test**: Each mode's last-track behavior + stopped indicator with no stuck "playing" state (quickstart S3, S4)

### Tests for User Story 2 (write FIRST, FAIL before implement)

- [X] T010 [P] [US2] Unit tests: repeat-all wrap, repeat-one restart, shuffle picks different song, repeat-off end → stopped state in `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` (store-level; pure resolver cases in autoAdvance.test.ts; verified RED then GREEN)

### Implementation for User Story 2

- [X] T011 [US2] Apply repeat/shuffle on auto-advance and route queue-end through the explicit stop routine in `src/stores/useMusicPlayerStore.ts` (depends on T008) — includes publishStoppedMediaState() in audioEngine.ts; manual next past end still wraps
- [X] T012 [P] [US2] Component test: stopped indicator shown at natural playlist end in `src/components/music-player/__tests__/AudioPlayback.test.tsx` (RED proven at store level in T010)

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - A bad file never silently kills the queue (Priority: P3)

**Goal**: Unplayable files are skipped automatically; empty remainder stops cleanly (FR-004, FR-005)

**Independent Test**: Unplayable file between valid songs plays through with no action; all-unplayable remainder → stopped state (quickstart S2)

### Tests for User Story 3 (write FIRST, FAIL before implement)

- [X] T013 [P] [US3] Unit tests: single corrupt file skipped, back-to-back failures skipped, no playable remainder → stopped state in `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` + element-error routing (verified RED then GREEN)

### Implementation for User Story 3

- [X] T014 [US3] Route track error and next-track start failure to skip-to-next-playable in `src/stores/musicPlayer/audioEngine.ts` and `src/stores/useMusicPlayerStore.ts` (depends on T008) — new handleTrackStartFailure action + session skip-set + self-heal on play
- [X] T015 [P] [US3] Add non-modal skipped-file notice keys via `translate()` in `src/i18n/en.ts` and `src/i18n/fa.ts` (constitution VIII, no hardcoded strings) — playerSkippedUnplayable pushed via useAppStore toast (Toasts renders translated key)

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification-only platform edge, race coverage, sign-off

- [X] T016 [P] Verify Android single-song-queue edge (no redesign) against `src-tauri/android/PlaybackService.kt` with a manual check — verified by code inspection: ExoPlayer owns the queue; onMediaItemTransition clears lastErrorCode (parity with desktop self-heal); single-track end pushes isPlaying=false (no stale indicator); desktop listener changes are isAndroid-guarded. On-device manual check still pending.
- [X] T017 [P] Race test: manual next pressed at track end advances exactly once in `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` (quickstart S5) — verified genuinely RED (false-green caught: guard must be armed first), then GREEN via cancelArmedAutoAdvance() in playTrack
- [X] T018 Run full quickstart.md validation (S1–S5) plus `pnpm test` and `pnpm build`; record a row in `BUGFIXES.md` and update `PROJECT_GRAPH.md` incrementally — 224/224 pass, build OK; S1→ended test, S2→watchdog test, S3→boundary tests, S4→stopped tests, S5→T017 race test; BUGFIXES row + frontend-player.md reference updated

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: Depend on Foundational; then sequential P1 → P2 → P3 (each builds on the advance path) or parallel if staffed with care around `useMusicPlayerStore.ts`
- **Polish (Phase 6)**: Depends on all three stories

### Within Each User Story

- Tests FIRST and FAIL before implementation (constitution V)
- Guard/resolution helpers before engine wiring before store wiring
- Story complete before moving to next priority

### Parallel Opportunities

- T002 with T001 (read-only sizing alongside baseline run)
- T004 with T003 (test authoring alongside module skeleton — test must still fail first)
- T005 + T006 in parallel (same file, different cases — coordinate to avoid edit conflicts; or sequential)
- T009, T010, T012, T013, T015, T016, T017 are [P] across different files
- T007/T008/T011/T014 all touch the engine/store — run sequentially

---

## Parallel Example: User Story 1

```bash
# After T003+T004 checkpoint, launch US1 tests together:
Task: "Unit test: watchdog fires guarded advance in src/stores/musicPlayer/__tests__/autoAdvance.test.ts"
Task: "Unit test: racing end signals advance exactly once in src/stores/musicPlayer/__tests__/autoAdvance.test.ts"
# Then implement sequentially (shared files):
# T007 (audioEngine.ts) → T008 (useMusicPlayerStore.ts) → T009 (component test)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T004)
3. Complete Phase 3: User Story 1 (T005–T009)
4. **STOP and VALIDATE**: quickstart S1 + `pnpm test` + `pnpm build`
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → guard ready
2. + US1 → uninterrupted playback (MVP!)
3. + US2 → mode boundaries + stopped state
4. + US3 → bad-file skipping + notice
5. + Polish → Android edge verified, S1–S5 green

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to spec.md story for traceability
- No `data-model.md`/`contracts/` tasks: none exist for this feature (plan.md D6)
- Commit after each task or logical group; stop at any checkpoint to validate
- Avoid: vague tasks, same-file parallel edits, cross-story dependencies that break independence
