# Feature Specification: Eliminate Cold-Start Tab Lag (Albums & Liked)

**Feature Branch**: `013-fix-cold-start-tab-lag`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "من ی مشکلی دارم این که وقتی برای بار اول یا وقیت کامل برنامه بسته شده میرم تو برنامه و میخوام برم تو قسمت البوم ها یا لایک ها این قسمت با دیلی باز میشه انگار برنامه لک چه ترفند یا کاری باید بکنم که این لگ حذف بشه ؟"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant First-Time Switch to Albums Tab (Priority: P1)

When a user opens the application (cold start after completely closing the app) and immediately taps on the "Albums" tab, the view opens immediately without any visible delay, dropped animation frames, or frozen UI state. The album cards and headers appear instantly with responsive tap feedback.

**Why this priority**: Albums is one of the primary navigation destinations. A delay or stutter on first interaction creates a strong impression that the application is slow or freezing, directly diminishing user perceived performance.

**Independent Test**: Launch the app from cold start, immediately tap the Albums tab on the bottom dock, and verify using frame-timing metrics that the transition happens in under 50ms without UI freezing or blank frames.

**Acceptance Scenarios**:

1. **Given** the app has just completed cold start and the Songs tab is active, **When** the user taps the Albums tab for the very first time, **Then** the Albums tab renders immediately with smooth touch feedback and no perceptible delay (>50ms).
2. **Given** the user navigates to the Albums tab on cold start, **When** album cards render, **Then** the grid layout is stable without layout jumps or sudden column-count recalculations.
3. **Given** the user navigates between Songs and Albums multiple times, **When** returning to Albums, **Then** the instant switching (<10ms) and scroll positions remain preserved.

---

### User Story 2 - Instant First-Time Switch to Liked Songs Tab (Priority: P1)

When a user opens the application from a cold start and taps the "Liked" (Favorites) tab for the first time, the favorite tracks list appears instantly, matching the immediate responsiveness of the already-mounted Songs tab.

**Why this priority**: Users frequently open music apps specifically to play their liked songs. Any delay entering their favorites disrupts the primary user journey.

**Independent Test**: Launch the app from cold start with liked songs present, immediately tap the Liked tab, and verify that the list of liked tracks displays without perceptible hitching or duplicate initialization delays.

**Acceptance Scenarios**:

1. **Given** the app has just booted from cold start, **When** the user taps the Liked tab for the first time, **Then** the filtered list of liked tracks is displayed immediately with zero perceptible lag.
2. **Given** a library with hundreds of liked songs, **When** the Liked tab opens for the first time, **Then** the list is already populated and virtualized without freezing the UI thread.

---

### User Story 3 - Non-Blocking Idle Pre-Warming (Priority: P2)

The application warms up inactive tab components, album data structures, and visible artwork during browser/system idle time immediately following cold-start boot, without delaying initial app responsiveness or increasing cold-start time-to-interactive.

**Why this priority**: Preparing views during idle time ensures that when the user does tap Albums or Liked, the components are already initialized and ready, transforming what was previously a synchronous first-mount hit into a zero-cost tab toggle.

**Independent Test**: Monitor CPU and main-thread activity during cold boot; verify that initial boot remains fast and unblocked, and tab pre-warming executes only during scheduled idle slices.

**Acceptance Scenarios**:

1. **Given** the app is starting up, **When** the splash screen is dismissed and Songs tab becomes interactive, **Then** background idle scheduling warms the Albums and Liked views without degrading scrolling performance of the active Songs tab.
2. **Given** low-end hardware with constrained resources, **When** background pre-warming runs, **Then** tasks yield cooperatively to user gestures and touches with highest priority.

---

### User Story 4 - Layout Stability and Zero Column Shift on Mount (Priority: P3)

When the Albums grid view is initialized on any device (phone, tablet, desktop), it immediately determines the appropriate responsive column count based on current viewport dimensions on its first render pass, preventing secondary layout shifts or re-renders.

**Why this priority**: Flashing an incorrect column count (such as 3 columns on a 6-column desktop screen) and then snapping to the correct count a frame later causes visual jitter and layout thrashing.

**Independent Test**: Open Albums tab on desktop viewport (>= 1024px); confirm initial render uses 6 columns without intermediate 3-column render.

**Acceptance Scenarios**:

1. **Given** a desktop window width of 1200px, **When** the Albums tab renders for the first time, **Then** it immediately renders with 6 columns on frame 1 without an intermediate 3-column state.
2. **Given** a mobile phone width of 380px, **When** the Albums tab renders, **Then** it renders with 3 columns with consistent row height estimation.

---

### Edge Cases

- **Cold start with very large library (5,000+ tracks)**: Heavy grouping and sorting must not freeze the application when Albums or Liked is tapped immediately after boot.
- **Empty library (0 tracks)**: Opening Albums or Liked tabs on a clean install with no tracks must transition instantly to their respective empty states without throwing errors or hanging.
- **Immediate tap during background library scan**: If the user taps Albums or Liked while the cold-start background library scanner is still running, the view must show cached data smoothly and update gracefully when the scan finishes without tearing or locking the UI.
- **Rapid tab switching**: If the user rapidly taps back and forth between Songs, Albums, and Liked tabs immediately upon launching the app, the interface must remain stable, queue no unhandled asynchronous state collisions, and maintain consistent active tab state.
- **Device orientation change during cold start**: If the device rotates immediately as the user taps Albums, the layout must adapt to the new aspect ratio cleanly without measurement collapse.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Navigation to Albums and Liked tabs MUST respond within 50ms of user input on first tap after cold start.
- **FR-002**: Tab view containers MUST support proactive idle mounting so that secondary tabs (Albums, Liked) are initialized before the user taps them, while never competing with critical boot rendering.
- **FR-003**: The tab lifecycle container MUST NOT introduce intermediate empty/blank render frames when transitioning an inactive tab to active for the first time.
- **FR-004**: Album collection computation and track filtering MUST be prepared efficiently (e.g. cached, deferred to idle periods, or memoized) so that first access does not execute synchronous bulk processing on the main interaction thread.
- **FR-005**: Responsive grid components MUST initialize with the correct column count matching the current viewport on their first render pass, avoiding layout shifts and duplicate renders.
- **FR-006**: The system MUST preserve existing instant (<10ms) switching speed and preserve exact scroll positions on all subsequent tab switches.
- **FR-007**: Idle pre-warming MUST yield immediately to any user interaction (touches, clicks, scrolls, playback commands) to preserve 60fps input responsiveness.

### Key Entities

- **Library Navigation Tab**: One of the primary navigational destinations (`songs`, `album`, `like`, `boost`, `converter`) selectable from the floating dock.
- **Keep-Alive Tab Pane**: A persistent container that keeps tab DOM nodes intact in memory (using `display: none` when inactive) to eliminate unmount/remount costs.
- **Album Collection**: Computed groupings of the user's music tracks, divided into custom user playlists and auto-grouped artist collections.
- **Pre-Warm Scheduler**: An idle-time task coordinator that prepares background views, computed structures, and artwork caches without interrupting the main user experience.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First-time tab switch delay to Albums and Liked tabs reduced from >250ms/stutter to under 50ms on cold start.
- **SC-002**: Zero dropped frames (>16.6ms frame budget violation) during the dock tap and tab activation animation.
- **SC-003**: Zero visual layout shift (CLS = 0) and zero blank-screen frames during first-time tab navigation.
- **SC-004**: Cold-start time to interactive (TTI) on the initial Songs tab does not increase by more than 0%.
- **SC-005**: Subsequent tab switches continue to complete in <10ms with preserved scroll position.

## Assumptions

- Users expect native-app smoothness with instantaneous tab switching regardless of library size.
- Memory overhead of keeping pre-warmed DOM nodes in inactive tabs is negligible (<15MB DOM footprint) and well within modern mobile device budgets.
- Existing cached tracks from local storage are available immediately at boot time, enabling early pre-computation before network/disk rescan completes.
- Web browser and WebKit/WebView standard APIs such as `requestIdleCallback` (with `setTimeout` fallback) and `ResizeObserver` are supported on all target platforms.
