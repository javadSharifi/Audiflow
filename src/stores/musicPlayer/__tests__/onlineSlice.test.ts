// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMusicPlayerStore } from "../../useMusicPlayerStore";
import * as onlineApi from "../../../utils/onlineTauri";
import type { OnlineTrack, StreamSource, TimedLyrics, DownloadedMedia } from "../../../types/generated";

vi.mock("../../../utils/onlineTauri", () => ({
  searchOnlineTracks: vi.fn(async (q: string): Promise<OnlineTrack[]> => {
    if (q === "fail") throw new Error("Network error");
    return [
      {
        id: "yt_123",
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        durationSecs: 210,
        provider: "youtube",
        streamIdentifier: "stream_123",
        thumbnailUrl: "https://example.com/thumb.jpg",
      },
    ];
  }),
  resolveOnlineStream: vi.fn(async (): Promise<StreamSource> => ({
    streamUrl: "https://example.com/audio.mp3",
    mimeType: "audio/mpeg",
    format: "mp3",
    bitrateKbps: 320,
    isProxied: false,
    headers: {},
  })),
  downloadOnlineTrack: vi.fn(async (): Promise<DownloadedMedia> => ({
    filePath: "/downloads/Test Song.mp3",
    title: "Test Song",
    artist: "Test Artist",
    format: "mp3",
    sizeBytes: 5000000,
  })),
  fetchOnlineLyrics: vi.fn(async (): Promise<TimedLyrics> => ({
    trackId: "yt_123",
    isSynced: true,
    lines: [
      { timeMs: 0, text: "Intro" },
      { timeMs: 5000, text: "First verse" },
    ],
    plainText: null,
  })),
}));

vi.mock("../../../utils/tauri", () => ({
  scanAudioFiles: vi.fn(async () => []),
  getMusicPermissionStatus: vi.fn(async () => "granted"),
  androidPlayerPlay: vi.fn(async () => "OK"),
  resolveMediaPaths: vi.fn(async () => []),
}));

vi.mock("../persistence", () => ({
  loadLikedPaths: vi.fn(() => new Set<string>()),
  persistLikedPaths: vi.fn(),
  loadSavedSort: vi.fn(() => "titleAsc"),
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

describe("onlineSlice", () => {
  beforeEach(() => {
    useMusicPlayerStore.setState({
      isOnlineMode: false,
      onlineQuery: "",
      onlineResults: [],
      isSearchingOnline: false,
      onlineError: null,
      activeOnlineTrack: null,
      isResolvingStream: false,
      timedLyrics: null,
      isLoadingLyrics: false,
      downloadingTrackIds: {},
      downloadedPaths: {},
      onlineBookmarks: [],
    });
    vi.clearAllMocks();
  });

  it("toggles online mode", () => {
    expect(useMusicPlayerStore.getState().isOnlineMode).toBe(false);
    useMusicPlayerStore.getState().toggleOnlineMode();
    expect(useMusicPlayerStore.getState().isOnlineMode).toBe(true);
    useMusicPlayerStore.getState().toggleOnlineMode(false);
    expect(useMusicPlayerStore.getState().isOnlineMode).toBe(false);
  });

  it("sets online query and clears results on empty search", async () => {
    useMusicPlayerStore.getState().setOnlineQuery("hello");
    expect(useMusicPlayerStore.getState().onlineQuery).toBe("hello");

    await useMusicPlayerStore.getState().searchOnline("   ");
    expect(useMusicPlayerStore.getState().onlineResults).toEqual([]);
    expect(useMusicPlayerStore.getState().isSearchingOnline).toBe(false);
  });

  it("performs online search successfully", async () => {
    await useMusicPlayerStore.getState().searchOnline("test song");
    const state = useMusicPlayerStore.getState();
    expect(onlineApi.searchOnlineTracks).toHaveBeenCalledWith("test song");
    expect(state.onlineResults.length).toBe(1);
    expect(state.onlineResults[0].title).toBe("Test Song");
    expect(state.isSearchingOnline).toBe(false);
    expect(state.onlineError).toBeNull();
  });

  it("captures search errors gracefully", async () => {
    await useMusicPlayerStore.getState().searchOnline("fail");
    const state = useMusicPlayerStore.getState();
    expect(state.onlineError).toBe("Network error");
    expect(state.isSearchingOnline).toBe(false);
    expect(state.onlineResults).toEqual([]);
  });

  it("plays online track and fetches lyrics", async () => {
    const track: OnlineTrack = {
      id: "yt_123",
      title: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      durationSecs: 210,
      provider: "youtube",
      streamIdentifier: "stream_123",
      thumbnailUrl: "https://example.com/thumb.jpg",
    };

    await useMusicPlayerStore.getState().playOnlineTrack(track);
    const state = useMusicPlayerStore.getState();

    expect(onlineApi.resolveOnlineStream).toHaveBeenCalledWith("yt_123", "stream_123", "youtube");
    expect(state.currentTrack).not.toBeNull();
    expect(state.currentTrack?.title).toBe("Test Song");
    expect(state.currentTrack?.uri).toBe("https://example.com/audio.mp3");
  });

  it("handles online track downloads and tracks completion paths", async () => {
    const track: OnlineTrack = {
      id: "yt_123",
      title: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      durationSecs: 210,
      provider: "youtube",
      streamIdentifier: "stream_123",
      thumbnailUrl: null,
    };

    await useMusicPlayerStore.getState().downloadOnlineTrack(track);
    const state = useMusicPlayerStore.getState();

    expect(onlineApi.downloadOnlineTrack).toHaveBeenCalledWith(track);
    expect(state.downloadedPaths["yt_123"]).toBe("/downloads/Test Song.mp3");
    expect(state.downloadingTrackIds["yt_123"]).toBeUndefined();
  });

  it("toggles and checks bookmarks", () => {
    const track: OnlineTrack = {
      id: "sc_999",
      title: "Bookmarked Song",
      artist: "Bookmarked Artist",
      album: null,
      durationSecs: 180,
      provider: "soundcloud",
      streamIdentifier: "sc_stream_999",
      thumbnailUrl: null,
    };

    expect(useMusicPlayerStore.getState().isBookmarked("sc_999")).toBe(false);
    useMusicPlayerStore.getState().toggleBookmark(track);
    expect(useMusicPlayerStore.getState().isBookmarked("sc_999")).toBe(true);
    expect(useMusicPlayerStore.getState().onlineBookmarks.length).toBe(1);

    useMusicPlayerStore.getState().toggleBookmark(track);
    expect(useMusicPlayerStore.getState().isBookmarked("sc_999")).toBe(false);
    expect(useMusicPlayerStore.getState().onlineBookmarks.length).toBe(0);
  });
});
