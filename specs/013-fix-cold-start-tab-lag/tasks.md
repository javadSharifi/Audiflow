# Tasks: Eliminate Cold-Start Tab Lag (Albums & Liked)

**Feature**: Eliminate Cold-Start Tab Lag (Albums & Liked)  
**Branch**: `013-fix-cold-start-tab-lag`  
**Plan**: [plan.md](./plan.md)  
**Spec**: [spec.md](./spec.md)

---

## Phase 1: Setup & Baseline

**Purpose**: Confirm clean test baseline for music player components before making lifecycle changes.

- [x] T001 Run baseline music player test suite `pnpm test src/components/music-player` to ensure all existing tests pass

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Upgrade `KeepAlivePane` lifecycle container with synchronous first-mount and idle pre-warming capabilities.

**⚠️ CRITICAL**: Must complete before connecting pre-warming in user stories.

- [x] T002 Update `src/components/music-player/KeepAlivePane.tsx` props to accept `prewarm?: boolean` and synchronize mounting state immediately during render when `active` is true (eliminating the 1-frame asynchronous `useEffect` return-null blank stutter) per `contracts/tab-keepalive-contract.md`
- [x] T003 Create unit tests in `src/components/music-player/__tests__/KeepAlivePane.test.tsx` verifying synchronous mount when `active={true}`, background mount with `display: none` when `prewarm={true}`, and permanent DOM retention across active toggles

**Checkpoint**: Foundation ready — User story implementation can now proceed.

---

## Phase 3: User Story 1 - Instant First-Time Switch to Albums Tab (Priority: P1) 🎯 MVP

**Goal**: Eliminate the delay, frame drops, and blank flash when the user taps the Albums tab for the first time after cold start.

**Independent Test**: Launch the app, tap Albums; verify transition completes in <50ms without frozen frames or intermediate white flash.

### Tests for User Story 1

- [x] T004 [US1] Add unit test in `src/components/music-player/__tests__/AlbumsView.test.tsx` verifying `AlbumsView` mounts and computes albums cleanly without runtime errors when rendered inside a pre-warmed background container

### Implementation for User Story 1

- [x] T005 [US1] Connect `prewarm` support to the Albums `KeepAlivePane` in `src/components/music-player/MusicPlayerView.tsx`

**Checkpoint**: User Story 1 is functional and testable independently.

---

## Phase 4: User Story 2 - Instant First-Time Switch to Liked Songs Tab (Priority: P1)

**Goal**: Eliminate the initialization hitch when entering the Liked tab for the first time by ensuring its view is warm and filtered.

**Independent Test**: Launch the app with liked songs, tap Liked tab; verify list of favorite tracks appears immediately.

### Tests for User Story 2

- [x] T006 [US2] Add unit test in `src/components/music-player/__tests__/TrackListView.test.tsx` verifying `LikedView` / `TrackListView` maintains filtered liked list and renders correctly when pre-warmed

### Implementation for User Story 2

- [x] T007 [US2] Connect `prewarm` support to the Liked `KeepAlivePane` in `src/components/music-player/MusicPlayerView.tsx`

**Checkpoint**: User Stories 1 and 2 work independently and smoothly.

---

## Phase 5: User Story 3 - Non-Blocking Idle Pre-Warming (Priority: P2)

**Goal**: Schedule background mounting of inactive tabs (`AlbumsView` and `LikedView`) during system idle time after boot, with zero impact on initial boot time or Songs tab scrolling.

**Independent Test**: Verify idle task registers via `requestIdleCallback` (or timer fallback) after boot settles, pre-warming inactive tabs while keeping active tab frame rate at 60fps.

### Tests for User Story 3

- [x] T008 [US3] Add unit test in `src/components/music-player/__tests__/MusicPlayerView.test.tsx` verifying that idle pre-warming schedules asynchronously after mount and triggers `prewarm={true}` on secondary tabs

### Implementation for User Story 3

- [x] T009 [US3] Implement cooperative idle pre-warm scheduler in `src/components/music-player/MusicPlayerView.tsx` using `requestIdleCallback` (with 200ms fallback timeout) to trigger `idlePrewarm` state for Albums and Liked panes

**Checkpoint**: User Stories 1, 2, and 3 are fully integrated with non-blocking idle scheduling.

---

## Phase 6: User Story 4 - Layout Stability and Zero Column Shift on Mount (Priority: P3)

**Goal**: Initialize responsive columns in `AlbumGridVirtualized` synchronously on the first render pass matching current viewport width, preventing layout shifts (CLS = 0) and redundant virtualizer recalculations.

**Independent Test**: Render `AlbumGridVirtualized` on desktop viewport (>= 1024px); confirm initial render calculates 6 columns immediately on frame 1 without starting at 3.

### Tests for User Story 4

- [x] T010 [US4] Add unit tests in `src/components/music-player/__tests__/AlbumGridVirtualized.test.tsx` verifying `cols` initializes synchronously based on viewport width (3, 4, 5, 6) on the first render pass

### Implementation for User Story 4

- [x] T011 [US4] Export `getResponsiveAlbumCols` helper and update `useAlbumColumns` in `src/components/music-player/AlbumGridVirtualized.tsx` to initialize `cols` state synchronously using `getResponsiveAlbumCols(window.innerWidth)`

**Checkpoint**: All user stories complete with visual stability and instantaneous responsiveness.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification across the full test matrix and compliance with project constitution.

- [x] T012 [P] Run TypeScript strict typecheck `pnpm build` to verify zero type regressions
- [x] T013 [P] Run full Vitest suite `pnpm test src/components/music-player` to confirm all tests pass
- [x] T014 Execute validation scenarios from `specs/013-fix-cold-start-tab-lag/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — executes immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Stories (Phase 3-6)**: Depend on Phase 2 completion.
  - Phase 3 (US1) & Phase 4 (US2) can run in parallel.
  - Phase 5 (US3) orchestrates the idle trigger for US1 and US2.
  - Phase 6 (US4) optimizes grid rendering for US1.
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2 (T002, T003). No dependency on other stories.
- **User Story 2 (P1)**: Starts after Phase 2 (T002, T003). No dependency on other stories.
- **User Story 3 (P2)**: Integrates idle trigger with US1 and US2.
- **User Story 4 (P3)**: Directly refines AlbumGridVirtualized for US1.

### Parallel Opportunities

- T004 [US1], T006 [US2], and T010 [US4] tests can be drafted concurrently.
- T012 [P] and T013 [P] in Polish phase can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 & Foundational)
1. Complete Phase 1 & 2: Update `KeepAlivePane` with synchronous first-mount and `prewarm` support.
2. Complete Phase 3: Connect prewarm to Albums tab.
3. Validate: Tapping Albums tab no longer experiences the 1-frame blank delay.

### Incremental Delivery
1. Add Phase 4 (US2): Connect Liked tab.
2. Add Phase 5 (US3): Enable cooperative idle scheduling so tabs are pre-warmed before user touch.
3. Add Phase 6 (US4): Synchronous responsive column calculation for zero layout shift.
4. Complete Phase 7: Full suite verification and quickstart sign-off.
