# Feature Specification: Mobile Performance & Smoothness Optimization

**Feature Branch**: `001-mobile-performance-optimization`

**Created**: 2026-09-15

**Status**: Ready for Planning

**Input**: User description: "من ی مشکلی دارم این که در برنمامه موبایل خیلی برنامه لگ اونم فکر کنم به خاطر این که از react js استفاده شده و موقع سویچ بین قسمت های برنامه یا اسکرول زیاد برنامه لگ میزنه اگر من مبیام قسمت اندروید با کاتلین بزنم یا کشی چیزی انجام بدم که انقدر در حالت اندروید لگ نباش ؟"

## Clarifications

### Session 2026-09-15

- Q: Should performance optimization be implemented entirely within the existing React/Tauri web layer or should native Kotlin UI be introduced? → A: Option A: Complete web-layer optimization (virtual list, DOM preservation, thumbnail caching) preserving 100% unified cross-platform codebase.
- Q: How should backdrop-blur glassmorphism effects and graphical shadows be handled on mobile? → A: Option B+: User toggle in Settings ("High Performance / Reduced Blur Mode") defaulted to OFF on mobile (blur disabled / performance mode active by default on Android) and defaulted to ON on desktop platforms.
- Q: What virtualization and navigation approach should be used for long lists? → A: Implement `@tanstack/react-virtual` for high-performance list virtualization, windowing DOM nodes with constant element count and smooth touch scrolling.

### Session 2026-09-15 — Navigation Lag Clarify (speckit-clarify)

- Q: Should KeepAlive caching cover only inner player tabs or also top-level Converter ↔ Player navigation (current root cause at `src/App.tsx:370`)? → A: A — Both levels. Wrap both Converter and Player in `KeepAlivePane` with `lazy={false}` so top-level switching is <10ms and scroll state is preserved; cost ~5 MB extra retained DOM.
- Q: Should Albums grid be virtualized (currently renders all DOM nodes at `src/components/music-player/AlbumsView.tsx:291,342`)? → A: A — Virtualize grid via `@tanstack/react-virtual` (or virtual grid) rendering only visible album cards; threshold always-on.
- Q: Where and how should the blur toggle live (FR-005)? → A: A — Add Settings toggle "حالت پرسرعت / Reduced Blur" with auto platform default via `isAndroid()` (mobile: reduced blur ON / blur OFF by default; desktop: blur ON), persisted in `AppSettings`/`settingsSlice`, applied instantly without restart.
- Q: What debounce strategy for search/sort on large libraries (FR-008)? → A: A — Input updates immediately, filtering/sorting debounced at 150 ms combined with `useDeferredValue` so heavy `filterAndSortTracks` in `src/stores/musicPlayer/trackUtils.ts:41` runs off the urgent render path.
- Q: What artwork cache policy for viewport thrash (`src/utils/artwork.ts:93`, `src/components/music-player/TrackCover.tsx:49`)? → A: A — Viewport-only extraction (only `virtualizer.getVirtualItems()` triggers `resolveArtworkSrc`), in-memory LRU cap 100 entries, concurrency limit 4, persistent disk cache unbounded via native `get_track_artwork`; eviction via `evictArtworkCache` on delete.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fluid Long List Scrolling with Virtualization (Priority: P1)

A mobile user with a large music library (hundreds or thousands of songs and albums) opens the app and scrolls rapidly through the tracks. The list utilizes windowed virtual rendering via `@tanstack/react-virtual` and glides smoothly at full screen refresh rate (60–120 FPS) without stuttering, frame drops, or freezing, regardless of library size or cover art presence.

**Why this priority**: Fast, stutter-free scrolling is the core tactile interaction of any music player and library app. A laggy list immediately gives the impression of a broken or low-quality app.

**Independent Test**: Can be tested by loading a library containing 1,000+ tracks on an Android device and vigorously scrolling up and down. Verified by measuring sustained frame rates (60 FPS) and ensuring only visible DOM nodes (~15–20 items) exist in the inspector.

**Acceptance Scenarios**:

1. **Given** a library containing 2,000 audio tracks, **When** the user performs rapid fling scrolling down and up, **Then** the interface scrolls continuously without freezing, maintaining a smooth 60 FPS visual experience.
2. **Given** a user is scrolling through tracks, **When** new track items enter the viewport, **Then** artwork and metadata render seamlessly without visual pop-in hitching or layout shifting.
3. **Given** the user stops scrolling, **When** tapping on any visible track, **Then** the track immediately registers the tap and starts playback without delay.

---

### User Story 2 - Instant Navigation Between Sections (Priority: P2)

A user frequently switches between different application tabs (Songs, Albums, Sound Booster, Liked Songs, and Converter) during a playback session. Switching occurs instantaneously without loading spinners, blank flashes, or rebuilding delay, and the user's scroll position in each section is remembered.

**Why this priority**: Tab switching is a primary navigation flow. Destroying and reconstructing views on every tab switch creates severe interaction lag and frustrating loss of scroll context.

**Independent Test**: Can be tested by navigating between "Songs", "Albums", and "Sound Booster" tabs repeatedly while playing audio. Verified by measuring the latency between touch-up on a tab icon and the complete visual presentation of the destination view.

**Acceptance Scenarios**:

1. **Given** the user is scrolled halfway down a 500-song list, **When** switching to the "Booster" tab and then switching back to "Songs", **Then** the Songs view appears immediately in under 50ms at the exact previous scroll position without reloading.
2. **Given** active audio playback is running, **When** the user switches between any tabs or opens/closes the fullscreen player, **Then** the audio stream continues uninterrupted with zero stutter or buffer underrun.

---

### User Story 3 - High-Efficiency Artwork & Thumbnail Caching (Priority: P3)

When scrolling through song lists and album grids, album artwork and generated cover previews load instantly from an efficient cache without causing memory spikes, redundant disk reads, or UI thread congestion.

**Why this priority**: Media artwork extraction and decoding are among the heaviest operations on mobile. Without aggressive caching and viewport-bounded resolution, image decoding overwhelms device memory and GPU fill rates.

**Independent Test**: Can be tested by clearing system caches, opening a large library, scrolling through all items, and then restarting the app to verify instant cover rendering from cache without background CPU/IPC spikes.

**Acceptance Scenarios**:

1. **Given** tracks with embedded or external cover art, **When** viewed for the first time, **Then** thumbnails are generated, cached, and displayed efficiently.
2. **Given** cached artwork exists, **When** the user scrolls back over previously rendered items, **Then** covers display immediately with zero IPC calls or decoding overhead.
3. **Given** a low-memory mobile device, **When** browsing very large collections, **Then** total memory usage remains bounded and older off-screen image data is recycled without crashing the app.

---

### User Story 4 - Mobile-Optimized Visual Effects & User Settings Control (Priority: P4)

A user on mobile experiences fluid animations and responsive interactions with heavy graphic blur disabled by default. Advanced users can toggle the graphical blur mode in Settings if their hardware supports it, while desktop users enjoy full glassmorphism by default.

**Why this priority**: Heavy desktop-style graphical effects (such as multi-layer backdrop blur filters and deep shadows) severely degrade mobile GPU rasterization performance. Providing platform-aware defaults with user control ensures high performance everywhere.

**Independent Test**: Can be tested by verifying default setting state on Android (blur disabled, high performance active) versus Desktop (blur enabled), and toggling the option in Settings to verify instantaneous UI adaptation.

**Acceptance Scenarios**:

1. **Given** a mobile/Android installation, **When** the app is first launched, **Then** heavy backdrop-blur filters are disabled by default and replaced with clean, solid/semi-opaque surfaces for maximum GPU framerate.
2. **Given** a desktop installation, **When** the app is launched, **Then** full backdrop-blur glassmorphism is enabled by default.
3. **Given** the user visits Settings, **When** toggling the "High Performance / Reduced Blur" option, **Then** the application immediately applies the visual styling without requiring a restart.

---

### Edge Cases

- What happens when a user rapidly flings through 10,000+ tracks? The virtualizer must recycle views cleanly without memory leaks or unbounded DOM nodes.
- What happens when the device enters low-memory / battery-saver mode? The application must gracefully scale down non-essential visual effects (e.g., backdrop blurs) while preserving smooth scrolling and playback.
- What happens when switching tabs while an album or library search filter is actively being typed? Filtered state and input focus must remain stable without resetting or locking the keyboard.
- What happens when artwork files are missing, corrupted, or have non-standard dimensions? The fallback procedural icon/gradient must render instantly without triggering repeated failed extraction attempts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST virtualize all lengthy track, album, and file lists on mobile using `@tanstack/react-virtual` within the existing web layer (React), rendering only items visible in the viewport plus a minimal overscan (6), maintaining constant DOM element count regardless of library size without requiring platform-specific native UI components. Album grids in `AlbumsView` MUST also be virtualized (virtual grid/windowed) so only visible `AlbumCard` nodes are mounted.
- **FR-002**: The system MUST preserve view state and scroll position across ALL navigation levels — both top-level Converter ↔ Player (`src/App.tsx:360-380`) and inner player tabs (Songs, Liked, Albums, Sound Booster) — using `KeepAlivePane` persistent DOM containers (`display:none` visibility toggle) with `lazy={false}` for top-level panes, without unmounting the underlying view tree. Switching either level MUST be <50 ms.
- **FR-003**: The system MUST maintain an intelligent, multi-tier thumbnail and artwork cache (in-memory LRU capped at 100 entries + persistent device disk cache via native `get_track_artwork`) so artwork is resolved and decoded at most once per unique track.
- **FR-004**: The system MUST defer artwork extraction and heavy metadata resolution for off-screen items until they approach the visible scroll boundary — only items returned by `virtualizer.getVirtualItems()` may trigger `resolveArtworkSrc` (`src/utils/artwork.ts:93`), with concurrent IPC capped at 4 and dedup via `inflight` map.
- **FR-005**: The system MUST provide a user setting ("High Performance / Reduced Blur Mode" / "حالت پرسرعت") in Settings that governs heavy GPU `backdrop-blur` and complex shadow styling, defaulting to reduced-blur ON (blur OFF) on mobile/Android via `isAndroid()` and blur ON on desktop, persisted in `AppSettings`/`settingsSlice`, applied instantly via CSS without restart.
- **FR-006**: Long-press gesture detectors and touch event listeners on list rows MUST NOT block or introduce delay to native vertical scroll gesture recognition.
- **FR-007**: Background tasks (such as audio library scanning or batch audio conversion) MUST yield UI thread priority to guarantee active user gestures and scrolling remain fluid.
- **FR-008**: Search filtering and sorting operations on large collections MUST update input immediately but compute `filterAndSortTracks` (`src/stores/musicPlayer/trackUtils.ts:41`) debounced at 150 ms and off the urgent render pass via `useDeferredValue`/`useMemo` to prevent frame drops during text input.

### Key Entities

- **VirtualizedViewport**: Represents the visible window of items in a scrollable list, calculating dynamic offsets, item heights, and render ranges via `@tanstack/react-virtual`.
- **ViewCacheState**: Manages the persistence, scroll position, and active/dormant status of top-level navigation views across tab switches.
- **ArtworkCache**: Represents the cache repository for decoded thumbnail images, keyed by unique track/album content identifiers.
- **PerformancePreferences**: Represents the user-configurable graphics rendering settings, including platform-specific default values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sustained scrolling frame rate on mobile devices reaches 58–60 FPS (or 120 FPS on high-refresh-rate displays) for libraries up to 10,000 tracks, with 99% of frame times under 16.6ms.
- **SC-002**: Tab switching between any two primary views occurs in less than 50ms with zero visible re-render flashes or layout shifts.
- **SC-003**: Native scroll position in track and album views is 100% preserved when navigating away to other tabs and returning.
- **SC-004**: Mobile application memory footprint during continuous scrolling through 1,000+ tracks remains stable and does not exceed 120 MB total web process memory.
- **SC-005**: First-paint rendering of visible list items upon opening the application or switching tabs occurs in under 100ms.
- **SC-006**: Zero touch gesture conflicts or scroll lockups occur when initiating vertical scrolling from a track row.

## Assumptions

- The underlying mobile platform (Android) provides a modern Chromium-based WebView (v90+), which supports standard CSS containment, hardware-accelerated compositing, and modern Web APIs.
- The UI layer remains 100% unified in React / TypeScript across Desktop and Android; no Kotlin or Jetpack Compose UI rewrites will be undertaken.
- Track heights in list views are fixed or deterministically predictable (e.g. 56px per row), allowing high-performance virtualization algorithms to compute layout offsets without expensive DOM measurements.
- Existing Rust backend audio processing, FFmpeg conversions, and native Android media playback operations remain unchanged and adhere to all Core Principles in `constitution.md`.
