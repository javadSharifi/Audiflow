import type {
  AudioTrackInfo,
  MusicSortOption,
  LibraryPermissionStatus,
  CustomAlbum,
} from "../../types";

/** Combined shuffle/repeat playback mode cycled by a single Now-Playing button. */
export type PlaybackMode = "normal" | "shuffle" | "repeatAll" | "repeatOne";

export function playbackModeOf(
  repeatMode: "off" | "all" | "one",
  shuffleMode: boolean,
): PlaybackMode {
  if (shuffleMode) return "shuffle";
  if (repeatMode === "all") return "repeatAll";
  if (repeatMode === "one") return "repeatOne";
  return "normal";
}

export interface PlaybackSlice {
  currentTrack: AudioTrackInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  /**
   * Derived, cheap playing-indicator key ("" when idle). Selectors should
   * subscribe to THIS for row highlight / play-icon state instead of
   * `currentTrack` — the full object identity changes on every library
   * rescan and would re-render every visible row.
   */
  playingKey: string;
  repeatMode: "off" | "all" | "one";
  shuffleMode: boolean;
  fullscreenOpen: boolean;
  playbackRate: number;
  volumeGainPercent: number;

  playTrack: (track: AudioTrackInfo, playlist?: AudioTrackInfo[]) => Promise<void>;
  pauseTrack: () => void;
  resumeTrack: () => void;
  closePlayer: () => void;
  togglePlayTrack: (track: AudioTrackInfo, playlist?: AudioTrackInfo[]) => Promise<void>;
  seekTo: (timeSecs: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setFullscreenOpen: (open: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVolumeGainPercent: (gain: number) => void;
}

export interface QueueSlice {
  currentPlaylist: AudioTrackInfo[];

  playNextTrack: (auto?: boolean) => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  /**
   * Skip path for a track that failed to start (element `error`, play()
   * rejection, resolve failure): mark it unplayable for this session, show
   * a notice, and continue with the next playable track — or stop
   * explicitly when nothing playable remains. Never leaves a stuck state.
   */
  handleTrackStartFailure: (failedTrack: AudioTrackInfo | null) => Promise<void>;
}

export interface LibrarySlice {
  tracks: AudioTrackInfo[];
  loading: boolean;
  hasScanned: boolean;
  searchQuery: string;
  sortBy: MusicSortOption;
  permissionStatus: LibraryPermissionStatus;
  customFolders: string[];

  checkPermission: () => Promise<void>;
  /**
   * Fire the native runtime-permission dialog, then poll the permission
   * status until the user answers (the native request is fire-and-forget —
   * it resolves before the system dialog is answered, so a single
   * check-then-scan always races it and scans empty). On grant with an
   * empty library, triggers a scan. Resolves true when granted.
   */
  requestMediaPermission: () => Promise<boolean>;
  scanLibrary: (customDirs?: string[]) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: MusicSortOption) => void;
  addCustomFolder: (path: string) => Promise<void>;
  addCustomFolders: (paths: string[]) => Promise<number>;
  removeCustomFolder: (path: string) => Promise<void>;
}

export interface FavoritesSlice {
  likedPaths: Set<string>;

  toggleLike: (trackOrKey: AudioTrackInfo | string) => void;
  toggleLikeMultiple: (tracksToToggle: AudioTrackInfo[]) => boolean;
  isLiked: (trackOrKey: AudioTrackInfo | string) => boolean;
}

export interface AlbumsSlice {
  customAlbums: CustomAlbum[];

  createCustomAlbum: (name: string) => string;
  renameCustomAlbum: (albumId: string, newName: string) => void;
  deleteCustomAlbum: (albumId: string) => void;
  addTrackToAlbum: (albumId: string, track: AudioTrackInfo) => void;
  removeTrackFromAlbum: (albumId: string, track: AudioTrackInfo) => void;
  isTrackInAlbum: (albumId: string, track: AudioTrackInfo) => boolean;
}

export interface SelectionSlice {
  selectedTrackKeys: Set<string>;
  isSelectionMode: boolean;

  enterSelectionMode: (initialTrack?: AudioTrackInfo) => void;
  exitSelectionMode: () => void;
  toggleSelectTrack: (trackOrKey: AudioTrackInfo | string) => void;
  selectAllTracks: (tracks: AudioTrackInfo[]) => void;
  clearSelection: () => void;
  deleteMultipleTracks: (tracks: AudioTrackInfo[]) => Promise<void>;
  addMultipleTracksToAlbum: (albumId: string, tracks: AudioTrackInfo[]) => void;
  deleteTrack: (track: AudioTrackInfo) => Promise<void>;
  setRingtone: (track: AudioTrackInfo) => Promise<void>;
  shareTrack: (track: AudioTrackInfo) => Promise<void>;
}

export type MusicPlayerState = PlaybackSlice &
  QueueSlice &
  LibrarySlice &
  FavoritesSlice &
  AlbumsSlice &
  SelectionSlice;

/** Decoupled event listener interface for AudioEngine events */
export interface IAudioEngineListener {
  onTimeUpdate?: (seconds: number) => void;
  onTrackEnd?: () => void;
  onError?: (err: Error) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

