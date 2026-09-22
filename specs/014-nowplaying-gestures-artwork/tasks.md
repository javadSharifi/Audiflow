# Tasks: Now Playing Gestures and Artwork Synchronization

**Branch**: `014-nowplaying-gestures-artwork` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validate dependencies, existing test suites, and gesture contract interfaces.

- [x] T001 Setup and verify gesture contract interfaces in `specs/014-nowplaying-gestures-artwork/contracts/gestures-contract.ts`
- [x] T002 [P] Run baseline test suites in `src/components/music-player/__tests__/TrackCover.test.tsx` and `src/components/music-player/__tests__/NowPlayingView.test.tsx` to verify clean initial state

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core helpers and gesture event infrastructure required by all user stories.

**⚠️ CRITICAL**: Must be completed before user story implementation begins.

- [x] T003 Implement canonical track identity helper `trackIdentity(track)` in `src/utils/artwork.ts` using `track.uri || track.path || track.id || ""`
- [x] T004 [P] Implement core gesture physics, 10px directional deadband disambiguation, and velocity math in `src/components/music-player/useNowPlayingGestures.ts`

**Checkpoint**: Foundation ready - track identity and gesture calculation primitives in place.

---

## Phase 3: User Story 1 - Instant & Reliable Artwork Synchronization (Priority: P1) 🎯 MVP

**Goal**: Ensure track changes immediately update the cover artwork without lingering on the previous track's image, reliably displaying placeholders when no art exists.

**Independent Test**: Advance tracks in player (track with art -> track without art -> track with art); verify displayed image updates synchronously without flashing previous art.

### Tests for User Story 1 ⚠️

- [x] T005 [P] [US1] Write unit regression tests in `src/components/music-player/__tests__/TrackCover.test.tsx` verifying that changing `track` prop immediately resets `extractedSrc` and `imgFailed` so previous cover never lingers

### Implementation for User Story 1

- [x] T006 [US1] Refactor `src/components/music-player/TrackCover.tsx` to use `trackIdentity(track)`, resetting `imgFailed` to `false` and `extractedSrc` to `getCachedArtworkSrc(track) ?? null` synchronously on identity changes
- [x] T007 [US1] Bind `key={trackIdentity(currentTrack)}` to hero `<TrackCover />` in `src/components/music-player/NowPlayingView.tsx` to enforce immediate React tree reconciliation on song changes

**Checkpoint**: User Story 1 fully functional. Artwork synchronization bug is resolved and independently testable.

---

## Phase 4: User Story 2 - Interactive Drag-Down to Dismiss Fullscreen Player (Priority: P2)

**Goal**: Allow users to drag down on the Now Playing view to dismiss/minimize the fullscreen sheet with fluid, physics-based transitions to reveal the playlist/library.

**Independent Test**: Drag down on Now Playing past 120px threshold or with downward flick velocity; verify sheet animates smoothly to `translateY(100%)` and minimizes to playlist, while drags < 120px snap back to `translateY(0)`.

### Tests for User Story 2 ⚠️

- [x] T008 [P] [US2] Create unit tests in `src/components/music-player/__tests__/useNowPlayingGestures.test.tsx` verifying vertical drag displacement, snapback under threshold, dismissal over threshold, and flick velocity detection

### Implementation for User Story 2

- [x] T009 [US2] Complete vertical drag-to-dismiss integration in `src/components/music-player/useNowPlayingGestures.ts`, connecting `onDismiss` callback (`setFullscreenOpen(false)`) and smooth CSS transform transitions
- [x] T010 [US2] Integrate `useNowPlayingGestures` into `src/components/music-player/NowPlayingView.tsx`, binding the root container to `containerRef` and inline `translateY` styling while ignoring drags that originate on seekbars or interactive buttons

**Checkpoint**: User Story 2 fully functional. Fullscreen player dismisses seamlessly via interactive drag-down.

---

## Phase 5: User Story 3 - Horizontal Swipe for Track Navigation with Slide Animation (Priority: P3)

**Goal**: Enable horizontal swipe on the artwork card to switch between previous and next songs with slide transitions, respecting LTR and RTL directions.

**Independent Test**: Swipe left on artwork card; verify card slides out, next song begins playing, and new card slides in. Swipe right; verify previous song begins playing with reverse slide. At playlist boundary, verify elastic rubber-band resistance.

### Tests for User Story 3 ⚠️

- [x] T011 [P] [US3] Add unit tests in `src/components/music-player/__tests__/NowPlayingArtworkCarousel.test.tsx` verifying horizontal swipe handling, threshold crossing (60px), next/previous triggering, and playlist boundary bounce

### Implementation for User Story 3

- [x] T012 [US3] Implement `src/components/music-player/NowPlayingArtworkCarousel.tsx` managing swipeable artwork container, card rotation/tilt during swipe, slide-out and slide-in CSS transitions, and boundary elasticity
- [x] T013 [US3] Connect `NowPlayingArtworkCarousel` in `src/components/music-player/NowPlayingView.tsx` to replace the static hero card with `onNextTrack` (`playNextTrack()`) and `onPreviousTrack` (`playPreviousTrack()`)

**Checkpoint**: User Story 3 fully functional. Album artwork supports animated horizontal track skipping with slide transitions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Maintain codebase hygiene, enforce line count limits, and complete end-to-end verification.

- [x] T014 Verify file size ceiling on `src/components/music-player/NowPlayingView.tsx`, `useNowPlayingGestures.ts`, and `NowPlayingArtworkCarousel.tsx` (each strictly <= 300 lines per Constitution Principle VIII)
- [x] T015 [P] Audit all user-facing strings and aria-labels in new/modified components to ensure 100% compliance with `translate(lang, ...)` in `src/i18n/index.ts`
- [x] T016 Run full test suite (`pnpm test`) and type check (`pnpm check:types`) in `package.json` to guarantee zero regressions
- [x] T017 Execute manual validation scenarios outlined in `specs/014-nowplaying-gestures-artwork/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - executes immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 - Can be delivered as standalone MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and hooks into NowPlayingView container.
- **User Story 3 (Phase 5)**: Depends on Phase 2 & Phase 3 (carousel mounts TrackCover).
- **Polish (Phase 6)**: Depends on completion of all user stories.

### User Story Dependencies

- **US1 (Artwork Sync)**: Independent. Delivers immediate bugfix value.
- **US2 (Drag-to-Dismiss)**: Independent from US3. Modifies the outer container gesture handling.
- **US3 (Swipe-to-Skip)**: Independent from US2. Modifies the inner artwork hero area.

### Parallel Opportunities

- `T001` and `T002` can execute in parallel.
- `T003` and `T004` can execute in parallel.
- `T005` (test) and `T008` (test) and `T011` (test) can be developed in parallel once foundational types are ready.
- `T014` and `T015` can execute in parallel during the polish phase.

---

## Parallel Example: User Story 1 & 2

```bash
# Launch test creation for US1 and US2 in parallel:
Task: "Write unit regression tests in src/components/music-player/__tests__/TrackCover.test.tsx"
Task: "Create unit tests in src/components/music-player/__tests__/useNowPlayingGestures.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational: `trackIdentity`).
2. Complete Phase 3 (User Story 1: `TrackCover` sync and keying).
3. **STOP and VALIDATE**: Run `pnpm test src/components/music-player/__tests__/TrackCover.test.tsx`. The reported user bug (cover art not updating) is resolved!

### Incremental Delivery of Gestures
1. Add User Story 2 (Drag-down to dismiss fullscreen player) -> verify independently with `useNowPlayingGestures.test.tsx`.
2. Add User Story 3 (Swipe left/right to change tracks with slide animation) -> verify independently with `NowPlayingArtworkCarousel.test.tsx`.
3. Complete Phase 6 (Polish, 300-line ceiling verification, typecheck, quickstart verification).
