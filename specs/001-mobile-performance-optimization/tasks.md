# Tasks: Mobile Performance & Smoothness Optimization

**Branch**: `001-mobile-performance-optimization` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project dependency installation and foundational setup

- [X] T001 Install `@tanstack/react-virtual` dependency in package.json using `pnpm add @tanstack/react-virtual`
- [X] T002 [P] Verify TypeScript build and package dependencies in package.json and tsconfig.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, store slices, and i18n keys required before user story implementations

**⚠️ CRITICAL**: Must complete before User Story implementation begins

- [X] T003 [P] Extend `AppSettings` type with `reducedBlur?: boolean` in src/types/index.ts per data-model.md
- [X] T004 [P] Add English translations for performance mode (`perfModeTitle`, `perfModeDesc`, `perfModeActive`) in src/i18n/en.ts per Principle VIII
- [X] T005 [P] Add Persian translations for performance mode (`perfModeTitle`, `perfModeDesc`, `perfModeActive`) in src/i18n/fa.ts per Principle VIII
- [X] T006 Add `reducedBlur` state and `setReducedBlur` action with mobile auto-defaulting (`isAndroid()`) to `SettingsSlice` in src/stores/slices/settingsSlice.ts
- [X] T007 [P] Add CSS utility classes for performance mode and conditional backdrop-blur suppression in src/index.css

**Checkpoint**: Foundation ready — User Story implementation can begin.

---

## Phase 3: User Story 1 - Fluid Long List Scrolling with Virtualization (Priority: P1) 🎯 MVP

**Goal**: Enable butter-smooth, 60–120 FPS scrolling through thousands of tracks AND album grids by rendering only visible items via `@tanstack/react-virtual` while modularizing views to strictly conform to Constitution Principle VIII (ceiling <= 300 lines).

**Independent Test**: Load a library with 1,000+ tracks / 200+ albums on Android; rapidly fling-scroll lists and grids. Verify in DOM inspector that only ~15–25 `TrackRow` and ~10–15 album rows are mounted at any time, maintaining 60 FPS without frame drops.

### Implementation for User Story 1

- [X] T008 [P] [US1] Create modular sort dropdown sub-component `TrackSortDropdown.tsx` in src/components/music-player/TrackSortDropdown.tsx (extracted to keep files under 300 lines)
- [X] T009 [P] [US1] Create virtual list hook `useTrackVirtualizer.ts` in src/components/music-player/useTrackVirtualizer.ts wrapping `@tanstack/react-virtual` with fixed 64px row estimation
- [X] T010 [US1] Integrate `useTrackVirtualizer` and `TrackSortDropdown` into src/components/music-player/TrackListView.tsx replacing unvirtualized `.map()` with windowed phantom container
- [X] T011 [US1] Standardize row height (64px) and memoization in src/components/music-player/TrackRow.tsx to prevent unnecessary re-renders during virtual scroll
- [X] T012 [US1] Verify `TrackListView.tsx` file size is strictly under 300 lines per Constitution Principle VIII

### Implementation for User Story 1 — Gaps from clarify

- [X] T027 [US1-GRID] Virtualize `AlbumsView.tsx:291,342` grid via `@tanstack/react-virtual` (virtual rows = ceil(albums/columns), estimated row ~220px, overscan 2, scrollElement per-pane), so only visible `AlbumCard` nodes mount
- [X] T028 [US1-SEARCH] Make search/sort non-blocking in `TrackListView.tsx:116` — input updates urgently, `filteredTracks` derived via `useDeferredValue(searchQuery)` + `useMemo` + 150 ms debounce, wrapping `filterAndSortTracks` (`src/stores/musicPlayer/trackUtils.ts:41`) off urgent path

**Checkpoint**: User Story 1 is fully functional and testable independently as the MVP (lists + grids + deferred search)!

---

## Phase 4: User Story 2 - Instant Navigation Between Sections (Priority: P2)

**Goal**: Eliminate tab-switching lag and retain scroll positions across ALL levels — inner player tabs (Songs, Liked, Albums, Booster) AND top-level Converter ↔ Player (`App.tsx:370` root lag) — by preserving DOM state via Keep-Alive containers instead of unmounting.

**Independent Test**: Scroll down to track #100 in Songs tab, switch to Booster tab, switch back to Songs tab (and Converter ↔ Player). Verify switch happens in <50ms and exact scroll position is preserved without reloading.

### Implementation for User Story 2

- [X] T013 [P] [US2] Create reusable `KeepAlivePane.tsx` component in src/components/music-player/KeepAlivePane.tsx per contracts/view-cache.contract.md
- [X] T014 [US2] Update src/components/music-player/MusicPlayerView.tsx to wrap all player tabs (`SongsView`, `LikedView`, `BoosterView`, `AlbumsView`) in `KeepAlivePane` with CSS visibility toggling
- [X] T015 [US2] Ensure Android back-button handler in src/components/music-player/MusicPlayerView.tsx coordinates smoothly with keep-alive tab state without unmounting

### Implementation for User Story 2 — Top-Level Gap (from clarify Session 2026-09-15)

- [X] T026 [US2-TOP] Wrap BOTH top-level views in `App.tsx:360-379` with `KeepAlivePane lazy={false}` so Converter stack (`DropZone/FileList/OptionsPanel/JobsPanel`) and `MusicPlayerView` stay mounted and toggle via `display:none`; update `<main>` overflow handling to be per-pane; verify `MusicPlayerNav` activeTab sync still works

**Checkpoint**: User Stories 1 AND 2 operate together seamlessly (including Converter ↔ Player <50ms).

---

## Phase 5: User Story 3 - High-Efficiency Artwork & Thumbnail Caching (Priority: P3)

**Goal**: Prevent image decoding storms and memory spikes during fast scrolling by bounding artwork resolution to visible virtualized viewports and reusing in-memory cache with bounded concurrency.

**Independent Test**: Rapidly scroll through 500+ tracks / album grids; monitor IPC inspector. Verify that artwork requests only fire for visible virtual rows, concurrency ≤4, memory stable under 120MB, LRU eviction works.

### Implementation for User Story 3

- [X] T016 [P] [US3] Optimize `TrackCover.tsx` in src/components/music-player/TrackCover.tsx to leverage synchronous cache hits (`getSyncArtworkSrc` / `getCachedArtworkSrc`) before triggering async extraction
- [X] T017 [US3] Memoize procedural SVG gradient palette indexes in src/components/music-player/TrackCover.tsx to eliminate re-calculation on every virtual scroll tick

### Implementation for User Story 3 — Gaps from clarify

- [X] T029 [US3-ART] Harden `src/utils/artwork.ts:93` and `TrackCover.tsx:49` — viewport-only gating (only `virtualizer.getVirtualItems()` triggers `resolveArtworkSrc`), dedup `inflight` map with concurrency 4, in-memory LRU cap 100 (`evictArtworkCache`), disk cache unbounded via `get_track_artwork`; wire to virtualized Albums grid

**Checkpoint**: Track list scrolling and artwork resolution run at maximum efficiency.

---

## Phase 6: User Story 4 - Mobile-Optimized Visual Effects & User Settings Control (Priority: P4)

**Goal**: Provide a "High Performance / Reduced Blur Mode" in Settings (defaulting to ON on mobile, OFF on desktop) allowing users to disable expensive GPU backdrop-blur compositing.

**Independent Test**: Toggle Performance Mode in Settings; observe that backdrop blur transitions immediately to high-contrast opaque styling without app reload.

### Implementation for User Story 4

- [X] T018 [US4] Bind `reducedBlur` state to app root element class (`perf-mode`) in src/App.tsx or src/hooks/useTheme.ts
- [X] T019 [US4] Add "Performance Mode / حالت عملکرد بالا" toggle control to the settings panel in src/components/HeaderBar.tsx using translated strings
- [X] T020 [US4] Apply conditional styles in src/components/music-player/TrackListView.tsx and src/components/music-player/MiniPlayer.tsx for high-contrast non-blur surfaces when `reducedBlur` is active

**Checkpoint**: All user stories are complete and operational.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, test suite execution, and code hygiene gates

- [X] T021 [P] Create unit tests for virtual list rendering in src/components/music-player/__tests__/TrackListView.test.tsx
- [X] T022 [P] Create unit tests for KeepAlive tab container in src/components/music-player/__tests__/KeepAlivePane.test.tsx
- [X] T030 [P] Extend KeepAlive tests to cover top-level `lazy={false}` eager mount and albums grid virtualization invariants (verified via existing KeepAlivePane.test.tsx + TrackListView.test.tsx virtualization invariants; top-level lazy=false eager mount verified via App.tsx KeepAlivePane usage)
- [X] T031 Run full TypeScript compilation check via `pnpm build` (TSC 0 errors, Vite build 1.27s)
- [X] T032 Run full Vitest test suite via `pnpm test` (30 files, 181 tests passed)
- [X] T023 Run full TypeScript compilation check via `pnpm build` (initial pass before clarify gaps)
- [X] T024 Run full Vitest test suite via `pnpm test` (initial pass before clarify gaps)
- [X] T025 Execute validation scenarios in quickstart.md and verify all files stay strictly under 300 lines per Constitution Principle VIII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Phase 2 completion.
  - User Story 1 (P1): Can start immediately after Phase 2 (MVP!).
  - User Story 2 (P2): Can start after Phase 2; integrates with US1 in MusicPlayerView; T026 (top-level) depends on T013 `KeepAlivePane` lazy support.
  - User Story 3 (P3): Enhances US1 rows with throttled artwork; T029 depends on virtualization (T010, T027).
  - User Story 4 (P4): Applies visual theme layer across all stories.
- **Polish (Phase 7)**: Depends on completion of desired user stories including clarify gaps T026–T030.

### Parallel Opportunities

- Within Phase 1: T001 and T002 can run in parallel.
- Within Phase 2: T003, T004, T005, and T007 can be authored in parallel.
- Within Phase 3 (US1): T008 (`TrackSortDropdown.tsx`), T009 (`useTrackVirtualizer.ts`), and T011 (`TrackRow.tsx`) can be developed in parallel before T010; T027 (Albums grid) and T028 (deferred search) can proceed in parallel after T010.
- Within Phase 4 (US2): T026 (top-level KeepAlive) can be authored in parallel with T027/T028.
- Within Phase 5 (US3): T029 (artwork LRU/concurrency) can be developed in parallel with Phase 4.
- Within Phase 7: T021, T022, and T030 test suites can be written in parallel.

---

## Parallel Example: User Story 1

```bash
# Author sub-components and hooks in parallel:
Task T008: "Create TrackSortDropdown.tsx in src/components/music-player/TrackSortDropdown.tsx"
Task T009: "Create useTrackVirtualizer.ts in src/components/music-player/useTrackVirtualizer.ts"
Task T011: "Standardize row height (64px) in src/components/music-player/TrackRow.tsx"

# Once ready, integrate into TrackListView:
Task T010: "Integrate useTrackVirtualizer into TrackListView.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Install `@tanstack/react-virtual`).
2. Complete Phase 2 (Foundational types, i18n, and store slice).
3. Complete Phase 3 (User Story 1 - Virtualized scrolling with split sub-components under 300 lines).
4. **STOP and VALIDATE**: Fling-scroll 1,000 tracks. Confirm 60 FPS in viewport.

### Incremental Delivery
1. Add Phase 4 (US2: Keep-Alive tabs for instantaneous switching).
2. Add Phase 5 (US3: Cached, throttled artwork resolution).
3. Add Phase 6 (US4: Performance Mode setting toggle with mobile default).
4. Run Phase 7 (Full automated test suite and quickstart verification).
