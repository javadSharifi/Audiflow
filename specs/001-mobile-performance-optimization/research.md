# Research & Architecture Decisions: Mobile Performance & Smoothness Optimization

**Feature**: `001-mobile-performance-optimization`
**Date**: 2026-09-15
**Status**: Complete

---

## 1. List Virtualization: `@tanstack/react-virtual` in React 19 & Tauri WebView

### Context & Problem
In `TrackListView.tsx`, the list of audio tracks renders every track directly in the DOM using `filteredTracks.map(...)`. In typical user libraries containing 500 to 2,000+ tracks, this causes 2,000+ complex DOM nodes with SVG icons, multiple event listeners (touch, click, long-press), and image components to be instantiated at once. On mobile Android WebViews, this exhausts GPU memory and causes severe frame dropping (jank) during scrolling.

### Decision
Adopt `@tanstack/react-virtual` (v3) using `useVirtualizer` with a fixed-height estimate (64px per track row) and a controlled scroll container.

### Rationale
- **Predictable Performance**: `@tanstack/react-virtual` renders only the items visible in the viewport plus a customizable overscan buffer (5–10 items). Total rendered DOM elements drop from 2,000+ to ~15–25, regardless of library size.
- **Fixed vs Dynamic Height**: Track rows in `TrackRow.tsx` have a deterministic height of 64px (`h-16` / `h-14` + gap). Fixed estimate sizing eliminates the need for expensive DOM layout measurements (`getBoundingClientRect`) on every scroll tick.
- **Smooth Kinetic Physics**: By maintaining a virtual container with `position: relative` and total height (`virtualizer.getTotalSize()`), native touch inertial scrolling (`-webkit-overflow-scrolling: touch`) is 100% preserved.
- **Lightweight & Framework Agnostic**: Zero heavy runtime dependencies, full React 19 compatibility.

### Alternatives Considered
- `react-window` / `react-virtualized`: Outdated maintenance, lacking modern React 19 hook ergonomics, heavier bundle.
- Custom CSS `content-visibility: auto`: Improves paint times but does not remove off-screen DOM nodes or stop React from mounting thousands of active component instances and hooks.
- Native Android RecyclerView via JNI: Rejected during clarification (breaks cross-platform parity and duplicates codebase).

---

## 2. Tab Navigation State Preservation (Two-Level Keep-Alive View Pattern)

### Context & Problem
Two levels of destructive navigation existed:
1) **Inner tabs** in `MusicPlayerView.tsx:54` (`Songs/Liked/Albums/Booster`) previously used conditional rendering — fixed via `KeepAlivePane` (lazy=true).
2) **Top-level** in `App.tsx:370` (`{isConverter ? <ConverterView/> : <MusicPlayerView/>}`) *still* destroys the entire tree on Converter ↔ Player switch — **this is the primary lag reported** (`$speckit-clarify` Session 2). On mobile, switching back to Player triggers full `SongsView` remount, `checkPermission`/`scanLibrary` effects, and loss of scroll position (300–800 ms jank).

### Decision
Implement **two-level Keep-Alive**:
- **Inner level**: `MusicPlayerView.tsx` keeps 4 tab panes alive (`KeepAlivePane lazy=true` — mount on first visit).
- **Top level**: `App.tsx` keeps BOTH Converter and Player mounted simultaneously, toggled via `KeepAlivePane lazy={false}` (eager mount, `display:none` toggle). Eager mount avoids first-switch penalty; both views render at bootReady.

### Rationale
- **Instantaneous Switch (<10ms)**: Toggling `display:none` avoids any React reconciliation; both levels now <50ms (SC-002).
- **Preserved Scroll State**: Browser retains `scrollTop` for both inner virtualizer containers and outer `<main>` scroll (`overflow-y-auto` when `isConverter`).
- **Safe Memory Footprint**: Converter view (DropZone/FileList) is lightweight; Player inner tabs are already virtualized (~20 rows each). Total retained overhead ~5 MB, acceptable vs. 300–800 ms jank saved.

### Alternatives Considered
- Zustand scroll save/restore: causes visible jump and async remount latency.
- React `<Offscreen>`/`Activity`: still experimental in React 19.
- Keep top-level conditional but memoize Player: still pays mount cost; not sufficient.

---

## 3. Mobile GPU Optimization ("High Performance / Reduced Blur Mode")

### Context & Problem
The application uses modern glassmorphism with heavy CSS backdrop filters (`backdrop-blur-xl`, `backdrop-blur-md`) and multi-layer drop shadows (`shadow-xl`). On desktop GPUs (Apple Silicon, Nvidia/AMD, Intel), blur is virtually free. On mobile Android WebViews, CSS backdrop filters require off-screen framebuffer copies and multi-pass blur shaders on every frame during scrolling, cutting framerates in half.

### Decision
Introduce a `reducedBlur` / `performanceMode` setting into `AppSettings`:
- **Default on Android**: Enabled (`reducedBlur = true`, blur disabled).
- **Default on Desktop**: Disabled (`reducedBlur = false`, blur enabled).
- **Visual Mapping**: When enabled, replace `backdrop-blur-*` classes with high-contrast, semi-opaque surfaces (e.g. `bg-white/98 dark:bg-zinc-900/98 border-black/[0.08] dark:border-white/[0.08]`).
- **User Control**: Add an explicit toggle switch in the Settings modal ("حالت عملکرد بالا / کاهش افکت‌های بلور") with instantaneous visual update.

### Rationale
- Immediately relieves GPU fill-rate strain during scrolling on mobile devices.
- Honors user preference while providing optimal defaults out-of-the-box.
- Completely complies with Constitution Principle VIII (i18n strings for setting labels in Persian and English).

---

## 4. Artwork Caching & Viewport-Bounded Resolution

### Context & Problem
`src/utils/artwork.ts:93` and `TrackCover.tsx:49` trigger `resolveArtworkSrc` per row. Before virtualization, 2,000 rows fired 2,000 concurrent IPCs via `invoke("get_track_artwork")`. Even after list virtualization, `AlbumsView.tsx:342` renders all album cards without virtualization, and no concurrency/LRU limit existed (memory unbounded).

### Decision
1. **Viewport-gated**: Only `virtualizer.getVirtualItems()` indices may call `resolveArtworkSrc`; off-screen rows render placeholder synchronously.
2. **Concurrency 4**: `artwork.ts` maintains an `inflight` dedup map with max 4 parallel IPC invocations, queueing the rest.
3. **LRU 100**: In-memory `Map` capped at 100 entries; eviction via `evictArtworkCache` on track delete; persistent disk cache via native `get_track_artwork` is unbounded.
4. **Albums grid**: Virtualize `AlbumsView` grid so only visible album cards mount → naturally caps artwork requests.
5. Procedural gradients: memoized palette index, no re-calc on scroll.

## 5. Albums Grid Virtualization & Search Debounce

### Context & Problem
- `AlbumsView.tsx:291` renders the entire album grid (`tracks → albums → AlbumCard`) with no virtualization — 200 albums = 200 DOM cards + 200 artwork IPCs.
- `TrackListView.tsx:116` computes `filterAndSortTracks` synchronously on every keystroke (O(n log n) over 2000 tracks), blocking the main thread.

### Decision
- **Albums**: Use `@tanstack/react-virtual` virtual grid (row count = ceil(albums/columns), estimate row height ~220px, overscan 2) — only visible rows mount.
- **Search/sort**: Input value updates urgently, but `filteredTracks` derived via `useDeferredValue(searchQuery)` + `useMemo` + 150 ms debounce (`setTimeout`/`useDebouncedValue`), keeping typing at 60 FPS while filtering runs on deferred render pass.

---

## Summary of Decisions

| Area | Decision | Primary Benefit |
|------|----------|-----------------|
| **List Virtualization** | `@tanstack/react-virtual` list (64px) + grid (albums) | 60–120 FPS scrolling with 10,000+ tracks |
| **Two-Level Keep-Alive** | `KeepAlivePane` inner (lazy) + top-level `App.tsx` (lazy=false) | <50ms switch both levels, 100% scroll memory |
| **Graphics & Blur** | Platform-aware `reducedBlur` setting (Default ON on mobile) | Eliminates mobile GPU compositing bottleneck |
| **Artwork Pipeline** | Viewport-gated + LRU 100 + concurrency 4 | Eliminates IPC and image decode storms |
| **Search/Sort** | 150 ms debounce + useDeferredValue | Typing stays 60 FPS on 2k tracks |
