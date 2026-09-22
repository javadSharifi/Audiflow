# Tasks: Bottom Navigation Layout & Mini Player Spacing Fixes

**Branch**: `015-fix-bottom-nav-layout` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared layout geometry tokens and baseline test coverage.

- [x] T001 Define and export shared layout constants (`NAVIGATION_DOCK_BOTTOM`, `MINI_PLAYER_BOTTOM`, `LIST_SCROLL_BOTTOM_PADDING`) in `src/components/music-player/navLayoutConstants.ts`
- [x] T002 [P] Run baseline tests in `src/components/music-player/__tests__/MusicPlayerNav.test.tsx` to verify clean initial state

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish coordinate formula consistency across player floating components.

**⚠️ CRITICAL**: Must be completed before user story implementation begins.

- [x] T003 [P] Import layout constants into `src/components/music-player/MusicPlayerNav.tsx` and `src/components/music-player/MiniPlayer.tsx`
- [x] T004 Verify `specs/015-fix-bottom-nav-layout/contracts/navigation-layout-contract.ts` adheres to all platform safe-area requirements

**Checkpoint**: Foundation ready - layout tokens and contracts unified.

---

## Phase 3: User Story 1 - Consistent Vertical Spacing Between Mini Player and Bottom Navigation (Priority: P1) 🎯 MVP

**Goal**: Eliminate the 50-80px empty gap between the mini player and bottom navigation dock on devices with system navigation bars by synchronizing `env(safe-area-inset-bottom)` offsets to guarantee an exact, constant 8px vertical gap.

**Independent Test**: Mount `MusicPlayerNav` and `MiniPlayer` with simulated safe-area insets (0px, 48px, 72px); verify that the vertical distance between the top of the dock and the bottom of the mini player card is strictly uniform (~8px) across all inset values.

### Tests for User Story 1 ⚠️

- [x] T005 [P] [US1] Write unit tests in `src/components/music-player/__tests__/MusicPlayerNav.test.tsx` asserting bottom safe-area elevation styling on `MusicPlayerNav` and elevation synchronization with `MiniPlayer`

### Implementation for User Story 1

- [x] T006 [US1] Apply `bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` to `<nav>` container in `src/components/music-player/MusicPlayerNav.tsx`
- [x] T007 [US1] Update root container positioning in `src/components/music-player/MiniPlayer.tsx` to `bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]` to lock the vertical gap at exactly 8px above the navigation dock

**Checkpoint**: User Story 1 fully functional. Mini player sits closely and neatly above the navigation dock on all device types regardless of system bars.

---

## Phase 4: User Story 2 - Overflow-Free Bottom Navigation Dock on Compact Mobile Screens (Priority: P2)

**Goal**: Enable fluid, proportional sizing and label clamping in `MusicPlayerNav` so all 5 navigation tabs remain fully visible, comfortable to tap, and contained within the screen boundaries on compact viewports (down to 320px width) in both RTL and LTR locales.

**Independent Test**: Render the navigation dock in a 360px-wide viewport (and down to 320px); click through all 5 tabs (especially "علاقه‌مندی‌ها" and "افزایش صدا"); verify zero horizontal overflow, no clipped icons, and dock width `<= calc(100vw - 1.5rem)`.

### Tests for User Story 2 ⚠️

- [x] T008 [P] [US2] Write unit tests in `src/components/music-player/__tests__/MusicPlayerNav.test.tsx` asserting dock width constraints, absence of horizontal overflow at 320px/360px viewports, and truncation behavior for long localized labels

### Implementation for User Story 2

- [x] T009 [US2] Re-architect navigation dock container in `src/components/music-player/MusicPlayerNav.tsx` with mobile-compact padding (`p-1.5 sm:p-2`), responsive gaps (`gap-1 sm:gap-1.5`), and bounded width (`max-w-[calc(100vw-1.5rem)]`)
- [x] T010 [US2] Update inactive tab button styling in `src/components/music-player/MusicPlayerNav.tsx` to use flexible bounds (`flex-1 min-w-[38px] max-w-[46px] sm:w-[48px] sm:max-w-none`) with accessible touch target height (`h-[46px] sm:h-[50px]`)
- [x] T011 [US2] Update active tab button styling in `src/components/music-player/MusicPlayerNav.tsx` with compact mobile padding (`px-3 sm:px-5`), responsive icon sizing, and label truncation (`truncate max-w-[85px] sm:max-w-[130px]`) to guarantee zero horizontal overflow

**Checkpoint**: User Story 2 fully functional. Dock adapts seamlessly to all mobile screens without spilling outside the viewport.

---

## Phase 5: User Story 3 - Visual Alignment and Clear Separation Above System Bars (Priority: P3)

**Goal**: Ensure scrollable track lists provide adequate bottom clearance so that the last track in any list is never obscured behind the elevated mini player and navigation dock on high-inset devices.

**Independent Test**: Scroll to the end of `TrackListView` on a simulated positive-inset device; verify the final track row is 100% visible and clickable above the mini player.

### Tests for User Story 3 ⚠️

- [x] T012 [P] [US3] Add unit test in `src/components/music-player/__tests__/TrackListView.test.tsx` verifying scroll container bottom padding incorporates `env(safe-area-inset-bottom)`

### Implementation for User Story 3

- [x] T013 [US3] Update scroll container bottom padding in `src/components/music-player/TrackListView.tsx` to include `env(safe-area-inset-bottom, 0px)` (`pb-[calc(11.5rem+env(safe-area-inset-bottom,0px))]`)
- [x] T014 [US3] Ensure `TrackListView.tsx` line count remains strictly `<= 300` lines per Constitution Principle VIII

**Checkpoint**: User Story 3 fully functional. Content is never hidden behind floating navigation elements.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Enforce codebase hygiene, line count ceilings, and comprehensive test suite verification.

- [x] T015 Verify file size limits on `MusicPlayerNav.tsx`, `MiniPlayer.tsx`, and `TrackListView.tsx` (each strictly `<= 300` lines per Constitution Principle VIII)
- [x] T016 [P] Audit all aria-labels, tooltips, and localized text in `MusicPlayerNav.tsx` for 100% compliance with `translate(lang, ...)`
- [x] T017 Run full test suite (`pnpm test`) and typecheck (`pnpm check:types`) to guarantee zero regressions
- [x] T018 Execute manual responsive QA scenarios defined in `specs/015-fix-bottom-nav-layout/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - executes immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 - Can be delivered as standalone MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 2 & US1.
- **User Story 3 (Phase 5)**: Depends on Phase 2 & US1 (synchronizes list scroll padding with mini player position).
- **Polish (Phase 6)**: Depends on completion of all user stories.

### User Story Dependencies

- **US1 (Safe-Area Spacing)**: Foundational positioning fix. Independent of dock internal button layout.
- **US2 (Dock Overflow)**: Modifies internal dock flexbox and button styling.
- **US3 (Scroll Padding)**: Connects list container bottom padding to the unified elevations from US1.

### Parallel Opportunities

- `T001` and `T002` can run in parallel.
- `T005` (test) and `T008` (test) and `T012` (test) can be created in parallel.
- `T015` and `T016` can run in parallel during the polish phase.

---

## Parallel Example: User Story 1 & 2

```bash
# Launch test creation for US1 and US2 in parallel:
Task: "Write unit tests in src/components/music-player/__tests__/MusicPlayerNav.test.tsx for safe-area elevation"
Task: "Write unit tests in src/components/music-player/__tests__/MusicPlayerNav.test.tsx for 360px viewport overflow"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1: Synchronized Safe-Area Bottom Offsets).
3. **STOP and VALIDATE**: Test vertical gap consistency across inset values (0px, 48px, 72px). The reported spacing bug is resolved!

### Incremental Delivery of Responsive Dock
1. Add User Story 2 (Responsive Flex Dock & Label Clamping) -> verify independently at 320px and 360px viewports.
2. Add User Story 3 (List Scroll Padding Alignment) -> verify bottom track visibility.
3. Complete Phase 6 (Line count audit, full test suite pass, quickstart verification).
