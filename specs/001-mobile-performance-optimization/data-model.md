# Data Model: Mobile Performance & Smoothness Optimization

**Feature**: `001-mobile-performance-optimization`
**Date**: 2026-09-15
**Status**: Complete

---

## 1. VirtualizedViewport

Represents the state of a virtualized list container managing items visible in the user's viewport.

### Schema / Interface
```typescript
export interface VirtualizedViewportOptions {
  /** Total count of items in the list */
  count: number;
  /** Fixed estimated height of each item row in pixels */
  estimateSize: number; // e.g. 64 for TrackRow
  /** Number of buffer items rendered beyond viewport edges */
  overscan: number; // default: 6 on mobile, 10 on desktop
  /** Scroll container DOM element reference */
  scrollElement: HTMLElement | null;
}

export interface VirtualItemDescriptor {
  /** 0-based index of item in the full dataset */
  index: number;
  /** Unique key for React reconciliation */
  key: string | number;
  /** Absolute vertical offset in pixels from container top */
  start: number;
  /** Height in pixels of this row */
  size: number;
}
```

### Validation & Rules
- `count` must be non-negative integer.
- `estimateSize` must be positive integer (> 0).
- `overscan` must be >= 2 to prevent blank flashing during fast flings.
- `totalSize` = `virtualizer.getTotalSize()` defines the phantom scroll height.

---

## 2. ViewCacheState

Manages the lifecycle and visibility of views at two levels: inner player tabs and top-level app tool.

### Schema / Interface
```typescript
export type PlayerTab = "songs" | "like" | "boost" | "album";
export type AppTool = "converter" | "player";

export interface ViewCacheContainerProps {
  /** The tab/tool identity for this view */
  tabId: PlayerTab | AppTool;
  /** Current active tab/tool */
  activeTab: PlayerTab | AppTool;
  /** View child components */
  children: React.ReactNode;
  /** eager=false (default lazy) for inner tabs, false for top-level to avoid first-switch penalty */
  lazy?: boolean;
}

export interface TopLevelViewCacheProps {
  activeTool: AppTool;
  childrenConverter: React.ReactNode;
  childrenPlayer: React.ReactNode;
}
```

### State Transitions & Rules
- When `tabId === activeTab`: Container has `display: flex; flex: 1; min-height: 0;` and is fully interactive.
- When `tabId !== activeTab`: Container has `display: none;` (hidden). DOM nodes and scroll position remain alive.
- **Inner level** (`MusicPlayerView`): `lazy=true` (default) — mounted on first visit, stays alive thereafter.
- **Top level** (`App.tsx:360-379`): `lazy=false` — BOTH Converter and Player mounted eagerly at `bootReady`, toggled via `display:none` for <50 ms switch. Required per Session 2026-09-15 clarify (root lag cause).

---

## 3. PerformancePreferences

Extends user settings with hardware-adaptive graphics options.

### Schema / Interface
```typescript
export interface PerformanceSettingsExtension {
  /**
   * When true, disables heavy CSS backdrop-blur and multi-layer shadows,
   * replacing them with high-contrast, semi-opaque backgrounds.
   * Default: true on Android, false on desktop.
   */
  reducedBlur: boolean;
}
```

### Storage & Serialization
- Stored as part of `AppSettings` in `localStorage` and `src-tauri` settings.
- Initialized on cold start:
  - If unset in storage: `reducedBlur = isAndroid()`
  - If set: uses saved user choice.

---

## 4. ArtworkCache

Represents the cache repository for decoded thumbnail images.

### Schema / Interface
```typescript
export interface ArtworkCacheModel {
  /** In-memory cache key: "${trackKey}|${coverUrl}" */
  key: string;
  /** Resolved web-accessible URL or data URI (null if known missing) */
  src: string | null;
  /** Inflight deduplication promise */
  inflight?: Promise<string | null>;
}
```

### Lifecycle Rules
- Synchronous direct covers (http/asset/local file) resolve in O(1) time without IPC.
- Asynchronous native embedded covers resolve through background IPC worker with dedup `inflight` map and concurrency cap 4.
- In-memory cache is LRU capped at 100 entries; `evictArtworkCache(trackKey)` on delete; disk cache (native) is unbounded.
- Because rows/grids are virtualized, maximum concurrent active artwork promises never exceed `visibleRows + overscan` (~20 items) + concurrency queue.
