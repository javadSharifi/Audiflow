# Implementation Plan: Library Perceived Performance — Cache + Render Optimization

**Branch**: `007-library-artwork-cache` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)
**Status**: Implemented & verified (plan written post-hoc for project memory)

**Input**: Feature specification from `/specs/007-library-artwork-cache/spec.md`

## Summary

Make tab switching (Songs/Albums/Liked) and cold start feel instant by fixing 7 measured bottlenecks across two layers: (1) **persistence** — bounded, durable, restart-safe caches for tracks/artwork with negative caching and eviction hygiene; (2) **render granularity** — per-row boolean selectors + 1-second `currentTime` quantization so store writes never cascade into visible-row re-renders.

## Technical Context

- **Stack**: React 19, Zustand 5, Tailwind v4, Vite 7 / Tauri 2, Rust 2021 (MSRV 1.77), Specta typed IPC
- **Constraints honored**: all IPC via `src/utils/tauri.ts`; `generated.ts` untouched (no command signature changed); local-first (zero network); no new npm deps; one new Rust dep (`directories` v5) + one dev-dep (`tempfile` — already in tree transitively)
- **Test layers**: Vitest (jsdom + `vi.stubGlobal("localStorage")` repo convention), `cargo test --lib`

## Constitution Check

| Principle | Verdict |
|---|---|
| I. Local-First | ✅ All caches local; zero network added |
| III. Typed IPC | ✅ No command signatures changed; `check:types` clean |
| V. Test-First | ✅ New regression tests added before/with each fix; full suite green |
| VIII. Storage matrix | ✅ New persisted value (`player-artwork-manifest-v1`, localStorage) declared in spec; desktop artwork moved from temp → OS cache dir with lazy migration |

## Phase 0 — Research (outcomes)

1. **Tab panes already stay mounted** (`KeepAlivePane`) → perceived "reload" came from artwork re-resolution + selector storms, not refetch.
2. **Artwork cache was triple-fragile**: LRU-100 memory, OS-temp disk (desktop), no persisted manifest → covers re-extracted per session and per tab revisit on large libraries.
3. **Selector granularity**: `TrackRow`/`AlbumCard` subscribed to whole Sets / `currentTrack` object → any store write re-rendered all visible rows. Fix pattern: derived `playingKey` string + per-row boolean selectors (Zustand `Object.is` on primitive results).
4. **Store-write rate**: `currentTime` written up to ~4×/s sub-second though UI renders whole seconds → quantize to `Math.floor` deltas in all three writers (`timeupdate`, smooth ticker, native-poll adoption).
5. **computeAllAlbums O(n×keys)** → single `Map` key index makes custom-album resolution O(n + keys).
6. **AlbumDetailView** rendered entire album lists; reuse the existing `useTrackVirtualizer` (no new dep).
## Phase 1 — Design (as implemented)

### Data model additions

- **`player-artwork-manifest-v1`** (localStorage): `{ [memoryKey]: string | null }` — persisted artwork results incl. negative (null = known missing). Bounded at 1500 entries (oldest insertion dropped). Hydrated into the in-memory LRU (500) at module init; written on every resolution; pruned on `evictArtworkCache`.
- **`playingKey: string`** on `MusicPlayerState`: derived playing-identity (`track.id || track.uri || track.path`, `""` when idle). Maintained at every `currentTrack` mutation: `playTrack`, `closePlayer`, `deleteTrack`, `deleteMultipleTracks`, and native track adoption in `audioEngine.applyNativeStateToStore`.
- **Desktop artwork dir**: `ProjectDirs::from("com","AudioConverter","audio-converter").cache_dir()/artworks` with legacy temp-dir read-through + lazy move.

### Changed files

| File | Change |
|---|---|
| `src/utils/artwork.ts` | LRU 100→500; manifest persist/hydrate/evict-sync |
| `src-tauri/src/music_library/artwork.rs` | Durable cache dir + legacy migration + regression test |
| `src-tauri/Cargo.toml` | `directories = "5"`, dev `tempfile = "3"` |
| `src/stores/musicPlayer/trackUtils.ts` | `playbackIdentityKey()`; `computeAllAlbums` Map index |
| `src/stores/useMusicPlayerStore.ts` | `playingKey` field + maintenance; re-export helper |
| `src/stores/musicPlayer/audioEngine.ts` | 1s `currentTime` quantization in 3 writers; `playingKey` on native adoption |
| `src/components/music-player/TrackRow.tsx` | Per-row boolean selectors (`isLiked`, `isSelected`, `playingKey`) |
| `src/components/music-player/AlbumCard.tsx` | `playingKey` selector instead of `currentTrack` |
| `src/components/music-player/TrackListView.tsx` | `isPlayerActive` boolean instead of `currentTrack` (padding only) |
| `src/components/music-player/AlbumDetailView.tsx` | Virtualized track list via `useTrackVirtualizer`; `playingKey` selector |
| `src/stores/musicPlayer/__tests__/perfCaching.test.ts` | NEW: 8 regression/perf tests |
| `src/stores/musicPlayer/__tests__/audioEngine.test.ts` | Seek-settle assertion aligned to whole-second contract |

### Deliberate non-changes

- `NowPlayingView` keeps `currentTime` subscription (it is the seekbar) — rate limited by quantization.
- `scanLibrary` semantics untouched (cache-preserving rescan already existed).
- No TTL refresh: launch/foreground scan + manual rescan + mutations only.

