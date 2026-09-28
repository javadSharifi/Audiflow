// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InternetSearchButton } from "../InternetSearchButton";
import { InternetSearchResultRow } from "../InternetSearchResultRow";
import { InternetSearchView } from "../InternetSearchView";
import { DownloadQueueDrawer } from "../DownloadQueueDrawer";
import { useDownloaderStore } from "../../../stores/useDownloaderStore";
import { useAppStore } from "../../../stores/useAppStore";
import type { MusicSearchResult } from "../../../types/downloader";

vi.mock("../../../utils/tauri", () => ({
  getInternetMusicSources: vi.fn().mockResolvedValue([{ id: "youtube", name: "YouTube" }]),
  getInternetDownloads: vi.fn().mockResolvedValue([]),
  searchInternetMusic: vi.fn().mockResolvedValue([]),
  getInternetPreviewUrl: vi.fn().mockResolvedValue("http://127.0.0.1:1234/stream"),
  startInternetDownload: vi.fn().mockResolvedValue("id-1"),
  cancelInternetDownload: vi.fn().mockResolvedValue(undefined),
  retryInternetDownload: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

describe("InternetSearch Components", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAppStore.setState({ lang: "en" });
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

  describe("InternetSearchButton", () => {
    it("renders and opens the search view on click", () => {
      render(<InternetSearchButton />);
      const btn = screen.getByRole("button");
      expect(btn).toBeTruthy();

      fireEvent.click(btn);
      expect(useDownloaderStore.getState().isOpen).toBe(true);
    });

    it("displays active download count badge when downloads are running", () => {
      useDownloaderStore.setState({
        downloads: {
          "1": {
            id: "1",
            webpageUrl: "url",
            title: "Track",
            artist: null,
            thumbnailUrl: null,
            status: "downloading",
            percent: 50,
            downloadedBytes: 100,
            totalBytes: 200,
            speedBytesPerSec: 1000,
            etaSecs: 10,
            outputPath: null,
            error: null,
          },
        },
      });

      render(<InternetSearchButton />);
      expect(screen.getByText("1")).toBeTruthy();
    });

    it("returns null on Android", () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 14; Pixel 6)",
        configurable: true,
      });
      const { container } = render(<InternetSearchButton />);
      expect(container.firstChild).toBeNull();
      Object.defineProperty(navigator, "userAgent", {
        value: originalUA,
        configurable: true,
      });
    });

    it("returns null on mobile", () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        configurable: true,
      });
      const { container } = render(<InternetSearchButton />);
      expect(container.firstChild).toBeNull();
      Object.defineProperty(navigator, "userAgent", {
        value: originalUA,
        configurable: true,
      });
    });
  });

  describe("InternetSearchResultRow", () => {
    const mockResult: MusicSearchResult = {
      id: "track-abc",
      title: "Bohemian Rhapsody",
      artist: "Queen",
      uploader: "Queen Official",
      album: null,
      durationSecs: 355,
      thumbnailUrl: "https://example.com/cover.jpg",
      webpageUrl: "https://youtube.com/watch?v=track-abc",
      source: "youtube",
    };

    it("renders track metadata correctly", () => {
      render(<InternetSearchResultRow result={mockResult} />);
      expect(screen.getByText("Bohemian Rhapsody")).toBeTruthy();
      expect(screen.getByText("Queen")).toBeTruthy();
      expect(screen.getByText("5:55")).toBeTruthy();
      expect(screen.getByText("youtube")).toBeTruthy();
    });

    it("triggers playPreview on preview button click", () => {
      const playPreviewSpy = vi.spyOn(useDownloaderStore.getState(), "playPreview");
      render(<InternetSearchResultRow result={mockResult} />);

      const previewButtons = screen.getAllByTitle("Preview");
      fireEvent.click(previewButtons[0]);

      expect(playPreviewSpy).toHaveBeenCalledWith(mockResult);
    });

    it("triggers startDownload on download button click", () => {
      const startDownloadSpy = vi.spyOn(useDownloaderStore.getState(), "startDownload");
      render(<InternetSearchResultRow result={mockResult} />);

      const downloadButton = screen.getByTitle("Download");
      fireEvent.click(downloadButton);

      expect(startDownloadSpy).toHaveBeenCalledWith(mockResult);
    });
  });

  describe("InternetSearchView", () => {
    it("renders nothing when closed", () => {
      const { container } = render(<InternetSearchView />);
      expect(container.firstChild).toBeNull();
    });

    it("renders search input and prompt when open", () => {
      useDownloaderStore.setState({ isOpen: true });
      render(<InternetSearchView />);

      expect(screen.getByPlaceholderText(/search artist, song/i)).toBeTruthy();
      expect(screen.getByText(/Search for your favorite songs and artists/i)).toBeTruthy();
    });

    it("triggers search on form submission", () => {
      useDownloaderStore.setState({ isOpen: true, query: "Pink Floyd" });
      const searchSpy = vi.spyOn(useDownloaderStore.getState(), "search");

      render(<InternetSearchView />);
      const searchButton = screen.getByRole("button", { name: /search/i });
      fireEvent.click(searchButton);

      expect(searchSpy).toHaveBeenCalled();
    });
  });

  describe("DownloadQueueDrawer", () => {
    it("renders nothing when isQueueOpen is false", () => {
      const { container } = render(<DownloadQueueDrawer />);
      expect(container.firstChild).toBeNull();
    });

    it("renders downloads list when open", () => {
      useDownloaderStore.setState({
        isQueueOpen: true,
        downloads: {
          "dl-1": {
            id: "dl-1",
            webpageUrl: "url",
            title: "Queued Song",
            artist: "Band",
            thumbnailUrl: null,
            status: "downloading",
            percent: 75,
            downloadedBytes: 750,
            totalBytes: 1000,
            speedBytesPerSec: 500,
            etaSecs: 2,
            outputPath: null,
            error: null,
          },
        },
      });

      render(<DownloadQueueDrawer />);
      expect(screen.getByText("Queued Song")).toBeTruthy();
      expect(screen.getByText("75%")).toBeTruthy();
    });
  });
});
