# Feature Specification: Library Perceived Performance — Cache + Render Optimization

**Feature Branch**: `007-library-artwork-cache`
**Created**: 2026-09-19
**Status**: Implemented (see Verification)

**Input**: User description: "مشکل کش کردن لیست آهنگ‌ها و آلبوم‌ها: هر بار که کاربر بین صفحات جابه‌جا می‌شود داده‌ها از اول لود می‌شوند و تصاویر با تاخیر نمایش داده می‌شوند؛ راه‌حل: کش محلی که فقط در صورت نیاز واقعی به‌روز شود"

## Root-Cause Audit (verified in code before implementation)

| # | Bottleneck | Where | Effect |
|---|---|---|---|
| 1 | Artwork in-memory cache only **100 LRU entries** | `src/utils/artwork.ts` | On larger libraries, returning to a tab re-extracted covers natively → visible pop-in delay |
| 2 | Desktop artwork disk cache in **OS temp dir** | `src-tauri/src/music_library/artwork.rs` | OS purges temp between sessions → full re-extraction every cold start |
| 3 | **No persisted artwork manifest** | — | Even with disk cache, every cover needed an IPC round-trip before first paint |
| 4 | `TrackRow` / `AlbumCard` subscribed to **whole `likedPaths` / `selectedTrackKeys` Sets and `currentTrack` object** | `TrackRow.tsx`, `AlbumCard.tsx` | Every like / seek / rescan re-rendered **all** visible rows/cards |
| 5 | `timeupdate` + Android polls wrote **`currentTime` up to ~4×/sec** with sub-second precision | `src/stores/musicPlayer/audioEngine.ts` | Every subscriber re-rendered multiple times per second for zero visible change (seekbar renders MM:SS) |
| 6 | `computeAllAlbums` resolved custom-album keys with **per-key linear `.find()`** → O(n × keys) | `trackUtils.ts` | Albums tab froze on large libraries whenever tracks changed |
| 7 | `AlbumDetailView` rendered **all** rows of an album (no virtualization) | `AlbumDetailView.tsx` | Opening a large custom album mounted hundreds of rows at once |

## What Was Implemented

1. **Artwork cache** (`src/utils/artwork.ts`): LRU raised 100 → 500; every resolution (including "no artwork") persisted to a bounded `localStorage` manifest (`player-artwork-manifest-v1`, max 1500) hydrated at module init → covers survive restarts with zero IPC; eviction keeps manifest in sync.
2. **Durable desktop cache dir** (`artwork.rs`): moved from OS temp → `directories::ProjectDirs` cache dir, with **lazy migration** of legacy temp hits so nothing re-extracts on upgrade.
3. **`playingKey` store field** (`useMusicPlayerStore`): cheap derived string (`id || uri || path`, `""` when idle) maintained everywhere `currentTrack` is set (play / close / delete / native adoption).
4. **Per-row boolean selectors** (`TrackRow`, `AlbumCard`, `AlbumDetailView`): each subscribes only to its own `isLiked` / `isSelected` / `playingKey` — rows re-render only when *their own* state flips.
5. **1-second `currentTime` quantization** (`audioEngine.ts`): store writes only when the floored second changes, in all three writers (`timeupdate`, smooth ticker, native poll adoption).
6. **`computeAllAlbums` O(n)** (`trackUtils.ts`): one `Map` key-index replaces per-key linear finds.
7. **`AlbumDetailView` virtualization**: reuses `useTrackVirtualizer` (64px rows) instead of rendering every track.
8. **`playbackIdentityKey`** (`trackUtils.ts`): stable row-identity helper for selectors, resilient to rescan object replacement.
9. **Thumbnail downscaling** (`artwork.rs`): covers extracted at 256×256 (`scale=...:force_original_aspect_ratio=increase,crop=`) instead of full-res — ~10–40× smaller, faster WebView decode for ≤64dp tiles; legacy >512KB cache files treated as misses and lazily re-extracted downscaled (one-pass convergence).
10. **Idle prefetch** (`utils/artwork.ts` + `scanLibrary`): after each scan, covers for the first ~50 tracks resolve during browser idle time (`requestIdleCallback`/timeout fallback), deduped per track ref — first paint already has covers.
11. **Boot benchmark** (`utils/bootPerf.ts` + `App.tsx`): Namida-style phase marks (app-module → react-mounted → settings → permission → scan → splash-removed) logged to console at splash removal — measures where cold-start time actually goes before any further tuning.
12. **Code splitting**: `NowPlayingView` (25.3 kB chunk), `BoosterView` (12.6 kB), `PermissionGate` + `FirstRunFoldersGate` (3.0 kB) are lazy chunks — initial bundle 594.8 kB → 555.8 kB (gzip 162.3 → 154.8 kB).
13. **Incremental scan memo ("local database")** (`music_library/scan_memo.rs` + `scan_result_cache_stats` IPC): unchanged files (same path/size/mtime) reuse the previous scan's track record from a durable `scan_memo.v1.json` in the OS cache dir — no cover lookup, no parsing. Deletions prune/eject memo entries immediately; `ScanResultCacheStats` exposes walk-vs-reuse stats to the frontend.



## Verification (all actually executed)

- `npx tsc --noEmit` → clean
- `pnpm test` → **285/285 passed** (44 files), incl. new `perfCaching.test.ts` (10 tests: negative caching, manifest persistence, eviction sync, O(n) albums, playingKey stability, idle prefetch) and the re-aligned `audioEngine` seek-settle test
- `cargo test --lib` → **114/114 passed**, incl. regression tests asserting the artwork cache dir is NOT under the OS temp dir and the thumbnail filter produces a 256×256 square
- `pnpm build` → built successfully
- `pnpm check:types` → no drift in `src/types/generated.ts`

## Remaining / Out of Scope

- `NowPlayingView` (797 lines) still subscribes to `currentTime` — intentional: it IS the seekbar. Quantization already limits it to 1 update/sec.
- No TTL-based auto-refresh was added; freshness comes from launch/foreground background scan + explicit rescan + local mutations (existing `scanLibrary` behavior preserved).
- Bundle-size warning (chunks > 500 kB) predates this change; code-splitting is a separate initiative.

