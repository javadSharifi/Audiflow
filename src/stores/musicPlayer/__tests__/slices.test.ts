// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMusicPlayerStore } from "../../useMusicPlayerStore";
import * as tauriApi from "../../../utils/tauri";
import type { AudioTrackInfo } from "../../../types";

vi.mock("../../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof tauriApi>();
  return {
    ...actual,
    scanAudioFiles: vi.fn(async () => [] as AudioTrackInfo[]),
    getMusicPermissionStatus: vi.fn(async () => "granted" as const),
  };
});

vi.mock("../persistence", () => ({
  loadLikedPaths: vi.fn(() => new Set<string>()),
  persistLikedPaths: vi.fn(),
  loadSavedSort: vi.fn(() => "titleAsc" as const),
  persistSavedSort: vi.fn(),
  loadCustomFolders: vi.fn(() => []),
  persistCustomFolders: vi.fn(),
  loadCustomAlbums: vi.fn(() => []),
  persistCustomAlbums: vi.fn(),
  loadCachedTracks: vi.fn(() => []),
  persistCachedTracks: vi.fn(),
  loadSavedBoosterGain: vi.fn(() => 100),
  persistSavedBoosterGain: vi.fn(),
}));

vi.mock("../audioEngine", () => ({
  bindMusicStore: vi.fn(),
  applyGainPercent: vi.fn(),
  getGlobalGainNode: vi.fn(() => null),
  getGlobalAudio: vi.fn(() => null),
  unifiedPlayTrack: vi.fn(async () => {}),
  unifiedPause: vi.fn(),
  unifiedResume: vi.fn(),
  unifiedSeekTo: vi.fn(),
  unifiedNext: vi.fn(async () => {}),
  unifiedPrevious: vi.fn(async () => {}),
  unifiedSetRepeatMode: vi.fn(),
  unifiedSetShuffleMode: vi.fn(),
  unifiedSetSpeed: vi.fn(),
  unifiedStop: vi.fn(),
  publishStoppedMediaState: vi.fn(),
  cancelArmedAutoAdvance: vi.fn(),
}));

const mockTrackA: AudioTrackInfo = {
  id: "track_a",
  uri: "file:///music/song_a.mp3",
  path: "/music/song_a.mp3",
  name: "song_a.mp3",
  title: "Song A",
  artist: "Artist A",
  album: "Album A",
  durationSecs: 180,
  sizeBytes: 3000000,
  createdTimestampMs: 1000,
  modifiedTimestampMs: 1000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

const mockTrackB: AudioTrackInfo = {
  id: "track_b",
  uri: "file:///music/song_b.mp3",
  path: "/music/song_b.mp3",
  name: "song_b.mp3",
  title: "Song B",
  artist: "Artist B",
  album: "Album B",
  durationSecs: 200,
  sizeBytes: 4000000,
  createdTimestampMs: 2000,
  modifiedTimestampMs: 2000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

describe("Music Player Slices", () => {
  beforeEach(() => {
    useMusicPlayerStore.setState({
      tracks: [mockTrackA, mockTrackB],
      likedPaths: new Set<string>(),
      customAlbums: [],
      selectedTrackKeys: new Set<string>(),
      isSelectionMode: false,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playingKey: "",
      repeatMode: "off",
      shuffleMode: false,
      playbackRate: 1.0,
      volumeGainPercent: 100,
    });
  });

  describe("favoritesSlice", () => {
    it("toggles single track like state correctly", () => {
      expect(useMusicPlayerStore.getState().isLiked(mockTrackA)).toBe(false);

      useMusicPlayerStore.getState().toggleLike(mockTrackA);
      expect(useMusicPlayerStore.getState().isLiked(mockTrackA)).toBe(true);

      useMusicPlayerStore.getState().toggleLike(mockTrackA);
      expect(useMusicPlayerStore.getState().isLiked(mockTrackA)).toBe(false);
    });

    it("toggles multiple tracks liked status", () => {
      const didLike = useMusicPlayerStore
        .getState()
        .toggleLikeMultiple([mockTrackA, mockTrackB]);
      expect(didLike).toBe(true);
      expect(useMusicPlayerStore.getState().isLiked(mockTrackA)).toBe(true);
      expect(useMusicPlayerStore.getState().isLiked(mockTrackB)).toBe(true);

      const didUnlike = useMusicPlayerStore
        .getState()
        .toggleLikeMultiple([mockTrackA, mockTrackB]);
      expect(didUnlike).toBe(false);
      expect(useMusicPlayerStore.getState().isLiked(mockTrackA)).toBe(false);
      expect(useMusicPlayerStore.getState().isLiked(mockTrackB)).toBe(false);
    });
  });

  describe("albumsSlice", () => {
    it("creates, renames, and manages tracks in custom albums", () => {
      const albumId = useMusicPlayerStore
        .getState()
        .createCustomAlbum("My Favorites");
      expect(albumId).toBeTruthy();

      let albums = useMusicPlayerStore.getState().customAlbums;
      expect(albums).toHaveLength(1);
      expect(albums[0]?.name).toBe("My Favorites");

      // Add track
      useMusicPlayerStore.getState().addTrackToAlbum(albumId, mockTrackA);
      expect(
        useMusicPlayerStore.getState().isTrackInAlbum(albumId, mockTrackA),
      ).toBe(true);

      // Rename album
      useMusicPlayerStore.getState().renameCustomAlbum(albumId, "Renamed Album");
      albums = useMusicPlayerStore.getState().customAlbums;
      expect(albums[0]?.name).toBe("Renamed Album");

      // Remove track
      useMusicPlayerStore.getState().removeTrackFromAlbum(albumId, mockTrackA);
      expect(
        useMusicPlayerStore.getState().isTrackInAlbum(albumId, mockTrackA),
      ).toBe(false);

      // Delete album
      useMusicPlayerStore.getState().deleteCustomAlbum(albumId);
      expect(useMusicPlayerStore.getState().customAlbums).toHaveLength(0);
    });
  });

  describe("selectionSlice", () => {
    it("handles selection mode and track key toggles", () => {
      expect(useMusicPlayerStore.getState().isSelectionMode).toBe(false);

      useMusicPlayerStore.getState().enterSelectionMode(mockTrackA);
      expect(useMusicPlayerStore.getState().isSelectionMode).toBe(true);
      expect(
        useMusicPlayerStore.getState().selectedTrackKeys.has(mockTrackA.uri),
      ).toBe(true);

      useMusicPlayerStore.getState().toggleSelectTrack(mockTrackB);
      expect(useMusicPlayerStore.getState().selectedTrackKeys.size).toBe(2);

      useMusicPlayerStore.getState().clearSelection();
      expect(useMusicPlayerStore.getState().selectedTrackKeys.size).toBe(0);

      useMusicPlayerStore
        .getState()
        .selectAllTracks([mockTrackA, mockTrackB]);
      expect(useMusicPlayerStore.getState().selectedTrackKeys.size).toBe(2);

      useMusicPlayerStore.getState().exitSelectionMode();
      expect(useMusicPlayerStore.getState().isSelectionMode).toBe(false);
      expect(useMusicPlayerStore.getState().selectedTrackKeys.size).toBe(0);
    });
  });

  describe("playbackSlice", () => {
    it("toggles repeat and shuffle modes correctly", () => {
      expect(useMusicPlayerStore.getState().repeatMode).toBe("off");
      useMusicPlayerStore.getState().toggleRepeat();
      expect(useMusicPlayerStore.getState().repeatMode).toBe("all");
      useMusicPlayerStore.getState().toggleRepeat();
      expect(useMusicPlayerStore.getState().repeatMode).toBe("one");
      useMusicPlayerStore.getState().toggleRepeat();
      expect(useMusicPlayerStore.getState().repeatMode).toBe("off");

      expect(useMusicPlayerStore.getState().shuffleMode).toBe(false);
      useMusicPlayerStore.getState().toggleShuffle();
      expect(useMusicPlayerStore.getState().shuffleMode).toBe(true);

      useMusicPlayerStore.getState().setPlaybackMode("repeatAll");
      expect(useMusicPlayerStore.getState().repeatMode).toBe("all");
      expect(useMusicPlayerStore.getState().shuffleMode).toBe(false);
    });

    it("clamps playbackRate and volumeGainPercent", () => {
      useMusicPlayerStore.getState().setPlaybackRate(5.0);
      expect(useMusicPlayerStore.getState().playbackRate).toBe(4.0);

      useMusicPlayerStore.getState().setPlaybackRate(0.1);
      expect(useMusicPlayerStore.getState().playbackRate).toBe(0.25);

      useMusicPlayerStore.getState().setVolumeGainPercent(500);
      expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(400);

      useMusicPlayerStore.getState().setVolumeGainPercent(-10);
      expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(0);
    });
  });

  describe("librarySlice", () => {
    it("transitions loading state and updates tracks on scanLibrary", async () => {
      vi.mocked(tauriApi.scanAudioFiles).mockResolvedValueOnce([mockTrackA]);
      const store = useMusicPlayerStore.getState();
      expect(store.loading).toBe(false);

      const scanPromise = store.scanLibrary();
      expect(useMusicPlayerStore.getState().loading).toBe(true);

      await scanPromise;
      expect(useMusicPlayerStore.getState().loading).toBe(false);
      expect(useMusicPlayerStore.getState().hasScanned).toBe(true);
      expect(useMusicPlayerStore.getState().tracks).toEqual([mockTrackA]);
    });
  });
});
