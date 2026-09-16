# Reference — frontend-player

Domain: Music library / player UI + player stores. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/components/music-player/AddToAlbumModal.tsx` | Add tracks to custom albums + create; exports `AddToAlbumModal`. |
| `src/components/music-player/AlbumCard.tsx` | Album tile with cover/play/menu; exports `AlbumCard`. |
| `src/components/music-player/AlbumDetailView.tsx` | Album header + track list with rename/delete/play; exports `AlbumDetailView`. |
| `src/components/music-player/AlbumGridVirtualized.tsx` | Virtualized album grid (TanStack) + create card; exports `AlbumGridVirtualized`. |
| `src/components/music-player/AlbumsView.tsx` | Album search/grid + create/rename/delete; exports `AlbumsView`. |
| `src/components/music-player/BoosterView.tsx` | System volume-gain dial with >200% confirm; exports `BoosterView`. |
| `src/components/music-player/ConvertSongIcon.tsx` | Stroke waveform converter icon; exports `ConvertSongIcon`. |
| `src/components/music-player/FirstRunFoldersGate.tsx` | First-run folder picker persisting scan roots; exports `FirstRunFoldersGate`. |
| `src/components/music-player/KeepAlivePane.tsx` | Keep-alive tab wrapper preserving DOM/scroll; exports `KeepAlivePane`. |
| `src/components/music-player/LikedView.tsx` | Liked-only wrapper around `TrackListView`; exports `LikedView`. |
| `src/components/music-player/MiniPlayer.tsx` | Collapsed player with seekbar + controls; exports `MiniPlayer`. |
| `src/components/music-player/MultiSelectActionBar.tsx` | Bulk bar select-all/like/album/convert/delete; exports `MultiSelectActionBar`. |
| `src/components/music-player/MusicPlayerNav.tsx` | Floating dock nav songs/album/like/boost/converter; exports `MusicPlayerNav`, `PlayerTab`. |
| `src/components/music-player/MusicPlayerView.tsx` | Tab container with `KeepAlivePane`s + Android-back; exports `MusicPlayerView`. |
| `src/components/music-player/NowPlayingView.tsx` | Fullscreen player with waveform/speed/boost/queue; exports `NowPlayingView`. |
| `src/components/music-player/PermissionGate.tsx` | Fullscreen Android media-permission gate; exports `PermissionGate`. |
| `src/components/music-player/SetRingtoneModal.tsx` | Ringtone trimmer with canvas waveform; exports `SetRingtoneModal`. |
| `src/components/music-player/SongsView.tsx` | All-songs wrapper around `TrackListView`; exports `SongsView`. |
| `src/components/music-player/TrackCover.tsx` | Artwork cover with gradient fallback + lazy extract; exports `TrackCover`. |
| `src/components/music-player/TrackDetailsModal.tsx` | Track metadata modal with copy-path/open-folder; exports `TrackDetailsModal`. |
| `src/components/music-player/TrackListBanners.tsx` | Permission/notification warning banners; exports `TrackListBanners`. |
| `src/components/music-player/TrackListView.tsx` | Searchable/sortable virtualized track list + scan/permission; exports `TrackListView`. |
| `src/components/music-player/TrackOptionsSheet.tsx` | Track action sheet (like/share/ringtone/album/delete); exports `TrackOptionsSheet`. |
| `src/components/music-player/TrackRow.tsx` | Memoized track row with play/like/select + sheet; exports `TrackRow`. |
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
| `src/components/music-player/__tests__/TrackCover.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/TrackListView.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/__tests__/TrackOptionsSheet.test.tsx` | Repo-tracked support file. |
| `src/components/music-player/useTrackVirtualizer.ts` | TanStack virtualizer wrapper with jsdom fallback; exports `useTrackVirtualizer`. |
| `src/stores/musicPlayer/__tests__/audioEngine.test.ts` | Vitest for unified audio engine play/pause/seek. |
| `src/stores/musicPlayer/__tests__/autoAdvance.test.ts` | Vitest for autoAdvance guard/resolver/skip-set (pure). |
| `src/stores/musicPlayer/__tests__/autoAdvanceEngine.test.ts` | Vitest for guarded end wiring, queue boundaries, failure skip, manual/auto race. |
| `src/stores/musicPlayer/audioEngine.ts` | Unified desktop HTMLAudio+WebAudio-gain / Android native bridge; exports `bindMusicStore`, `unified*`, guarded auto-advance (`requestGuardedAutoAdvance`, `cancelArmedAutoAdvance`, `publishStoppedMediaState`). |
| `src/stores/musicPlayer/autoAdvance.ts` | Auto-advance core: generation-token guard, `resolveNextTrack` (aligned id/uri/path identity), session skip-set; exports `createAdvanceGuard`, `findTrackIndex`, `snapshotUnplayableKeys`. |
| `src/stores/musicPlayer/__tests__/shareTrack.test.ts` | Vitest for track share/export helpers. |
| `src/stores/musicPlayer/audioEngine.ts` | Unified desktop HTMLAudio+WebAudio-gain / Android native bridge; exports `bindMusicStore`, `unified*`. |
| `src/stores/musicPlayer/persistence.ts` | localStorage liked/folders/sort/albums/tracks-cache; exports `load*/persist*`. |
| `src/stores/musicPlayer/trackUtils.ts` | Track key/liked/filter-sort helpers; exports `getTrackKey`, `filterAndSortTracks`. |
| `src/stores/useMusicPlayerStore.ts` | Library/playback store bridging desktop/Android audio; exports `useMusicPlayerStore`; deps `audioEngine`, `autoAdvance`, `persistence`, `trackUtils`; `playNextTrack` resolves via `resolveNextTrack` (explicit stop at queue end, manual wraps), `handleTrackStartFailure` skips unplayable with `playerSkippedUnplayable` toast. |

