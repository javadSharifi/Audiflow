// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDownloaderStore } from "../useDownloaderStore";
import * as api from "../../utils/tauri";
import { useMusicPlayerStore } from "../useMusicPlayerStore";
import type { MusicSearchResult } from "../../types/downloader";

vi.mock("../../utils/tauri", () => ({
  getInternetMusicSources: vi.fn().mockResolvedValue([{ id: "youtube", name: "YouTube" }]),
  getInternetDownloads: vi.fn().mockResolvedValue([]),
  searchInternetMusic: vi.fn(),
  getInternetPreviewUrl: vi.fn(),
  startInternetDownload: vi.fn(),
  cancelInternetDownload: vi.fn(),
  retryInternetDownload: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

describe("useDownloaderStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDownloaderStore.setState({
      isOpen: false,
      query: "",
      results: [],
      sources: [{ id: "youtube", name: "YouTube" }],
      selectedSource: "youtube",
      searching: false,
      searchError: null,
      hasSearched: false,
      previewTrackId: null,
      previewLoading: false,
      previewError: null,
      downloads: {},
      isQueueOpen: false,
    });
  });

  it("initializes with default state", () => {
    const state = useDownloaderStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.query).toBe("");
    expect(state.results).toEqual([]);
    expect(state.searching).toBe(false);
    expect(state.selectedSource).toBe("youtube");
  });

  it("handles empty or whitespace searches without invoking API", async () => {
    await useDownloaderStore.getState().search("   ");
    expect(api.searchInternetMusic).not.toHaveBeenCalled();
    expect(useDownloaderStore.getState().searching).toBe(false);
  });

  it("searches and stores normalized results", async () => {
    const mockResults: MusicSearchResult[] = [
      {
        id: "song-1",
        title: "Test Song",
        artist: "Test Artist",
        uploader: "Uploader",
        album: null,
        durationSecs: 200,
        thumbnailUrl: "https://example.com/thumb.jpg",
        webpageUrl: "https://youtube.com/watch?v=song-1",
        source: "youtube",
      },
    ];

    vi.mocked(api.searchInternetMusic).mockResolvedValueOnce(mockResults);

    await useDownloaderStore.getState().search("test query");

    expect(api.searchInternetMusic).toHaveBeenCalledWith("test query", "youtube", 20);
    const state = useDownloaderStore.getState();
    expect(state.results).toEqual(mockResults);
    expect(state.searching).toBe(false);
    expect(state.hasSearched).toBe(true);
    expect(state.searchError).toBe(null);
  });

  it("handles search errors gracefully", async () => {
    vi.mocked(api.searchInternetMusic).mockRejectedValueOnce(new Error("Network offline"));

    await useDownloaderStore.getState().search("failing query");

    const state = useDownloaderStore.getState();
    expect(state.searching).toBe(false);
    expect(state.searchError).toBe("Network offline");
    expect(state.results).toEqual([]);
  });

  it("clears search query and results", () => {
    useDownloaderStore.setState({
      query: "hello",
      results: [
        {
          id: "1",
          title: "Song",
          artist: "Artist",
          uploader: null,
          album: null,
          durationSecs: 180,
          thumbnailUrl: null,
          webpageUrl: "url",
          source: "youtube",
        },
      ],
      hasSearched: true,
    });

    useDownloaderStore.getState().clearSearch();

    const state = useDownloaderStore.getState();
    expect(state.query).toBe("");
    expect(state.results).toEqual([]);
    expect(state.hasSearched).toBe(false);
  });

  it("resolves preview URL and triggers audio player", async () => {
    const mockResult: MusicSearchResult = {
      id: "preview-123",
      title: "Preview Track",
      artist: "Preview Artist",
      uploader: "Channel",
      album: null,
      durationSecs: 150,
      thumbnailUrl: "https://example.com/thumb.jpg",
      webpageUrl: "https://youtube.com/watch?v=preview-123",
      source: "youtube",
    };

    vi.mocked(api.getInternetPreviewUrl).mockResolvedValueOnce(
      "http://127.0.0.1:54321/stream?url=https%3A%2F%2Fgooglevideo.com",
    );

    const playTrackSpy = vi.spyOn(useMusicPlayerStore.getState(), "playTrack").mockResolvedValue();

    await useDownloaderStore.getState().playPreview(mockResult);

    expect(api.getInternetPreviewUrl).toHaveBeenCalledWith(mockResult.webpageUrl);
    expect(playTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "online:preview-123",
        uri: "http://127.0.0.1:54321/stream?url=https%3A%2F%2Fgooglevideo.com",
        name: "Preview Track",
        title: "Preview Track",
        artist: "Preview Artist",
      }),
    );
    expect(useDownloaderStore.getState().previewLoading).toBe(false);
    expect(useDownloaderStore.getState().previewTrackId).toBe("preview-123");
  });

  it("enqueues download and calls startInternetDownload", async () => {
    const mockResult: MusicSearchResult = {
      id: "dl-1",
      title: "Download Song",
      artist: "Artist",
      uploader: "Channel",
      album: null,
      durationSecs: 210,
      thumbnailUrl: "https://thumb.jpg",
      webpageUrl: "https://youtube.com/watch?v=dl-1",
      source: "youtube",
    };

    vi.mocked(api.startInternetDownload).mockResolvedValueOnce("dl-1");

    await useDownloaderStore.getState().startDownload(mockResult);

    expect(api.startInternetDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dl-1",
        title: "Download Song",
        webpageUrl: "https://youtube.com/watch?v=dl-1",
        format: "mp3",
      }),
    );

    const state = useDownloaderStore.getState();
    expect(state.downloads["dl-1"]).toBeDefined();
    expect(state.downloads["dl-1"].status).toBe("queued");
  });

  it("calls cancel and retry download APIs", async () => {
    vi.mocked(api.cancelInternetDownload).mockResolvedValueOnce();
    vi.mocked(api.retryInternetDownload).mockResolvedValueOnce();

    useDownloaderStore.setState({
      downloads: {
        "dl-test": {
          id: "dl-test",
          webpageUrl: "https://youtube.com/watch?v=dl-test",
          title: "Test",
          artist: null,
          thumbnailUrl: null,
          status: "failed",
          percent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speedBytesPerSec: null,
          etaSecs: 0,
          outputPath: null,
          error: "Network error",
        },
      },
    });

    await useDownloaderStore.getState().cancelDownload("dl-test");
    expect(api.cancelInternetDownload).toHaveBeenCalledWith("dl-test");

    await useDownloaderStore.getState().retryDownload("dl-test");
    expect(api.retryInternetDownload).toHaveBeenCalledWith("dl-test");
  });
});
