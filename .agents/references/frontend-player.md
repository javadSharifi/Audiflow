# Reference — frontend-player

Domain: Music library / player UI + player stores. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/components/music-player/AddToAlbumModal.tsx` | Add tracks to custom albums + create; exports `AddToAlbumModal`. |
| `src/components/music-player/AlbumCard.tsx` | Album tile with cover/play/menu; exports `AlbumCard`. |
| `src/components/music-player/AlbumDetailView.tsx` | Album header + virtualized track list (useTrackVirtualizer); exports `AlbumDetailView`. |
| `src/components/music-player/AlbumGridVirtualized.tsx` | Virtualized album grid (TanStack) + create card; exports `AlbumGridVirtualized`. |
| `src/components/music-player/useAlbumColumns.ts` | Responsive column calculation and hook for album grid; exports `getResponsiveAlbumCols`, `useAlbumColumns`. |
| `src/components/music-player/AlbumsView.tsx` | Album search/grid + create/rename/delete; exports `AlbumsView`. |
| `src/components/music-player/BoosterView.tsx` | System volume-gain dial with >200% confirm; exports `BoosterView`. |
| `src/components/music-player/ConvertSongIcon.tsx` | Stroke waveform converter icon; exports `ConvertSongIcon`. |
| `src/components/music-player/FirstRunFoldersGate.tsx` | First-run folder picker persisting scan roots; exports `FirstRunFoldersGate`. |
| `src/components/music-player/HighBoostSafetyModal.tsx` | Confirmation modal for volume boost levels exceeding 200%; exports `HighBoostSafetyModal`. |
| `src/components/music-player/KeepAlivePane.tsx` | Keep-alive tab wrapper preserving DOM/scroll; exports `KeepAlivePane`. |
| `src/components/music-player/LikedView.tsx` | Liked-only wrapper around `TrackListView`; exports `LikedView`. |
| `src/components/music-player/MiniPlayer.tsx` | Collapsed player with seekbar + controls; exports `MiniPlayer`. |
| `src/components/music-player/MultiSelectActionBar.tsx` | Bulk bar select-all/like/album/convert/delete; exports `MultiSelectActionBar`. |
| `src/components/music-player/MusicPlayerNav.tsx` | Floating dock nav songs/album/like/boost/converter; exports `MusicPlayerNav`, `PlayerTab`. |
| `src/components/music-player/navLayoutConstants.ts` | Shared layout constants for nav dock and mini player safe-area offsets. |
| `src/components/music-player/MusicPlayerView.tsx` | Tab container with `KeepAlivePane`s + Android-back; exports `MusicPlayerView`. |
| `src/components/music-player/NowPlayingArtworkCarousel.tsx` | Swipeable album cover with physics tilt/slide animation; exports `NowPlayingArtworkCarousel`. |
| `src/components/music-player/NowPlayingDesktopQueue.tsx` | Now Playing desktop queue sidebar drawer; exports `NowPlayingDesktopQueue`. |
| `src/components/music-player/NowPlayingMobileQueue.tsx` | Now Playing mobile queue bottom sheet drawer; exports `NowPlayingMobileQueue`. |
| `src/components/music-player/NowPlayingSpeedModal.tsx` | Now Playing playback rate selection modal; exports `NowPlayingSpeedModal`. |
| `src/components/music-player/NowPlayingToolbar.tsx` | Now Playing header toolbar with dismiss/queue/options; exports `NowPlayingToolbar`. |
| `src/components/music-player/NowPlayingTransportControls.tsx` | Playback control buttons (play/pause/prev/next/shuffle/repeat); exports `NowPlayingTransportControls`. |
| `src/components/music-player/NowPlayingView.tsx` | Fullscreen player with drag-to-dismiss and swipeable artwork; exports `NowPlayingView`. |
| `src/components/music-player/PermissionGate.tsx` | Fullscreen Android media-permission gate; exports `PermissionGate`. |
| `src/components/music-player/RingtoneConfirmActions.tsx` | Bottom action bar with cancel and confirm/setting/success states; exports `RingtoneConfirmActions`. |
| `src/components/music-player/RingtoneModalHeader.tsx` | Header bar for SetRingtoneModal with cover, track title/artist, and close button; exports `RingtoneModalHeader`. |
| `src/components/music-player/RingtonePresetsBar.tsx` | Quick selection duration presets bar (15s, 30s, 45s, Full); exports `RingtonePresetsBar`. |
| `src/components/music-player/RingtoneSteppersBar.tsx` | Start/end stepper buttons and center play/pause audition button; exports `RingtoneSteppersBar`. |
| `src/components/music-player/SetRingtoneModal.tsx` | Ringtone trimmer dialog composed from shared waveform modules and ringtone subcomponents; exports `SetRingtoneModal`. |
| `src/components/music-player/SongsView.tsx` | All-songs wrapper around `TrackListView`; exports `SongsView`. |
| `src/components/music-player/TrackBoosterSheet.tsx` | In-player sound booster bottom sheet with safe speaker protection; exports `TrackBoosterSheet`. |
| `src/components/music-player/TrackCover.tsx` | Artwork cover with gradient fallback + lazy extract; exports `TrackCover`. |
| `src/components/music-player/TrackDetailsModal.tsx` | Track metadata modal with copy-path/open-folder; exports `TrackDetailsModal`. |
| `src/components/music-player/TrackListBanners.tsx` | Permission/notification warning banners; exports `TrackListBanners`. |
| `src/components/music-player/TrackListView.tsx` | Searchable/sortable virtualized track list + scan/permission; exports `TrackListView`. |
| `src/components/music-player/TrackOptionsSheet.tsx` | Track action sheet (like/share/ringtone/album/delete); exports `TrackOptionsSheet`. |
| `src/components/music-player/TrackRow.tsx` | Memoized row; per-row boolean selectors + `playingKey` (never whole Sets/currentTrack); exports `TrackRow`. |
| `src/components/music-player/TrackSortDropdown.tsx` | Sort dropdown newest/oldest/liked/title; exports `TrackSortDropdown`. |
| `src/components/music-player/WaveformSeekbar.tsx` | Seeded pseudo-waveform seekbar with drag/seek; exports `WaveformSeekbar`. |
| `src/components/music-player/__tests__/AlbumsView.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/AudioPlayback.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/BoosterView.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/FirstRunFoldersGate.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/KeepAlivePane.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/MultiSelect.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/MusicPlayerNav.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/NowPlayingView.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/PermissionBanner.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/PermissionGate.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/SetRingtoneModal.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/SheetPositioning.test.tsx` | Regression tests for sheet/modal portal positioning + z-index (TrackRow, details, add-to-album); Android-mocked. (untracked, not in git index) |
| `src/components/music-player/__tests__/SongsView.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/TrackBoosterSheet.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/TrackCover.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/TrackListView.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/TrackOptionsSheet.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/useNowPlayingGestures.ts` | Gesture physics hook for drag-down dismissal and swipe-to-skip; exports `useNowPlayingGestures`. |
| `src/components/music-player/useTrackVirtualizer.ts` | TanStack virtualizer wrapper with jsdom fallback; exports `useTrackVirtualizer`. |
| `src/components/music-player/__tests__/NowPlayingArtworkCarousel.test.tsx` | Carousel swipe and boundary bounce tests. |
| `src/components/music-player/__tests__/useNowPlayingGestures.test.tsx` | Gesture hook displacement, snapback, dismissal, and velocity tests. |
| `src/stores/musicPlayer/__tests__/audioEngine.test.ts` | Vitest for unified audio engine play/pause/seek (whole-second currentTime contract). |
| `src/stores/musicPlayer/__tests__/perfCaching.test.ts` | Vitest for artwork cache persistence/negative caching, O(n) albums, playingKey stability. |
| `src/stores/musicPlayer/__tests__/autoAdvance.test.ts` | Vitest for autoAdvance guard/resolver/skip-set (pure). |
| `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` | Vitest for guarded end wiring, queue boundaries, failure skip, manual/auto race. |
| `src/stores/musicPlayer/audioEngine.ts` | Unified desktop HTMLAudio+WebAudio-gain / Android native bridge; exports `bindMusicStore`, `unified*`, guarded auto-advance (`requestGuardedAutoAdvance`, `cancelArmedAutoAdvance`, `publishStoppedMediaState`). |
| `src/stores/musicPlayer/autoAdvance.ts` | Auto-advance core: generation-token guard, `resolveNextTrack` (aligned id/uri/path identity), session skip-set; exports `createAdvanceGuard`, `findTrackIndex`, `snapshotUnplayableKeys`. |
| `src/stores/musicPlayer/linuxAssetAudio.ts` | Linux-only audio source: fetch `asset://` bytes → `blob:` URL (WebKitGTK custom-scheme media block, WebKit bug 146351); single live URL revoked on next resolve/stop; fallback to asset URL on fetch failure; plus scoped `resolveScopedBlobAudioSrc` handles for preview/audition elements (trim, booster A/B, ringtone) that never touch the player slot. |
| `src/stores/musicPlayer/__tests__/linuxAssetAudio.test.ts` | Vitest for blob-URL resolution, prev-URL revocation, and asset-URL fallback. |
| `src/stores/musicPlayer/__tests__/shareTrack.test.ts` | Vitest for track share/export helpers. |
| `src/stores/musicPlayer/audioEngine.ts` | Unified desktop HTMLAudio+WebAudio-gain / Android native bridge; exports `bindMusicStore`, `unified*`. |
| `src/stores/musicPlayer/persistence.ts` | localStorage liked/folders/sort/albums/tracks-cache; exports `load*/persist*`. |
| `src/stores/musicPlayer/trackUtils.ts` | Track key/liked/filter-sort helpers; exports `getTrackKey`, `filterAndSortTracks`. |
| `src/stores/musicPlayer/types.ts` | Type definitions for playback, queue, library, favorites, albums, selection slices and combined `MusicPlayerState`. |
| `src/stores/musicPlayer/selectors.ts` | Granular selector hooks with `useShallow` for zero-re-render component subscriptions. |
| `src/stores/musicPlayer/slices/playbackSlice.ts` | Playback transport, seek debouncer, gain glider, repeat/shuffle mode slice. |
| `src/stores/musicPlayer/slices/queueSlice.ts` | Playlist queue management, track progression and unplayable skip slice. |
| `src/stores/musicPlayer/slices/librarySlice.ts` | Library scanning, permissions, custom folders, and artwork pre-warming slice. |
| `src/stores/musicPlayer/slices/favoritesSlice.ts` | Liked paths management, toggles, queries slice. |
| `src/stores/musicPlayer/slices/albumsSlice.ts` | Custom albums CRUD and track membership slice. |
| `src/stores/musicPlayer/slices/selectionSlice.ts` | Multi-select mode, track deletion with artwork eviction, ringtone, share slice. |
| `src/stores/musicPlayer/__tests__/slices.test.ts` | Unit tests for slice boundaries, selectors, and state operations. |
| `src/stores/useMusicPlayerStore.ts` | Modular Zustand store composing all 6 music player slices, preserving backward compatibility and registering with audioEngine. |

