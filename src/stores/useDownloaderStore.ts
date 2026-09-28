import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import * as api from "../utils/tauri";
import { useMusicPlayerStore } from "./useMusicPlayerStore";
import { useAppStore } from "./useAppStore";
import { isAndroid } from "../utils/platform";
import { translate } from "../i18n";
import type {
  DownloadItem,
  DownloadProgressEvent,
  DownloadRequest,
  MusicSearchResult,
  MusicSource,
} from "../types/downloader";
import type { AudioTrackInfo } from "../types";

export interface DownloaderState {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  results: MusicSearchResult[];
  sources: MusicSource[];
  selectedSource: string;
  setSelectedSource: (source: string) => void;
  searching: boolean;
  searchError: string | null;
  hasSearched: boolean;

  previewTrackId: string | null;
  previewLoading: boolean;
  previewError: string | null;

  downloads: Record<string, DownloadItem>;
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;

  init: () => Promise<void>;
  search: (overrideQuery?: string) => Promise<void>;
  clearSearch: () => void;
  playPreview: (result: MusicSearchResult) => Promise<void>;
  stopPreview: () => Promise<void>;
  startDownload: (result: MusicSearchResult) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
}

let unlistenProgress: UnlistenFn | null = null;
let initialized = false;

export const useDownloaderStore = create<DownloaderState>((set, get) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  query: "",
  setQuery: (query) => set({ query }),
  results: [],
  sources: [{ id: "youtube", name: "YouTube" }],
  selectedSource: "youtube",
  setSelectedSource: (selectedSource) => set({ selectedSource }),
  searching: false,
  searchError: null,
  hasSearched: false,

  previewTrackId: null,
  previewLoading: false,
  previewError: null,

  downloads: {},
  isQueueOpen: false,
  setIsQueueOpen: (isQueueOpen) => set({ isQueueOpen }),

  async init() {
    if (initialized || isAndroid()) return;
    initialized = true;

    try {
      const [sources, existing] = await Promise.all([
        api.getInternetMusicSources().catch(() => [{ id: "youtube", name: "YouTube" }]),
        api.getInternetDownloads().catch(() => []),
      ]);

      const downloadMap: Record<string, DownloadItem> = {};
      for (const item of existing) {
        downloadMap[item.id] = item;
      }

      set({ sources, downloads: downloadMap });
    } catch { /* best effort */ }

    if (!unlistenProgress) {
      unlistenProgress = await listen<DownloadProgressEvent>("download-progress", (event) => {
        const payload = event.payload;
        if (!payload || !payload.id) return;

        set((state) => {
          const prev = state.downloads[payload.id];
          const updated: DownloadItem = {
            id: payload.id,
            webpageUrl: prev?.webpageUrl || "",
            title: prev?.title || "Track",
            artist: prev?.artist || null,
            thumbnailUrl: prev?.thumbnailUrl || null,
            status: payload.status,
            percent: payload.percent,
            downloadedBytes: payload.downloadedBytes ?? prev?.downloadedBytes ?? 0,
            totalBytes: payload.totalBytes ?? prev?.totalBytes ?? 0,
            speedBytesPerSec: payload.speedBytesPerSec ?? prev?.speedBytesPerSec ?? null,
            etaSecs: payload.etaSecs ?? prev?.etaSecs ?? 0,
            outputPath: prev?.outputPath || null,
            error: payload.error || prev?.error || null,
          };

          return {
            downloads: {
              ...state.downloads,
              [payload.id]: updated,
            },
          };
        });

        if (payload.status === "completed") {
          void useMusicPlayerStore.getState().scanLibrary().catch(() => {});
          useAppStore.getState().pushToast("info", "downloadComplete");
        } else if (payload.status === "failed" && payload.error) {
          useAppStore.getState().pushToast("error", "downloadFailed");
        }
      });
    }
  },

  async search(overrideQuery) {
    const q = (overrideQuery ?? get().query).trim();
    if (!q) return;

    if (isAndroid()) {
      set({
        searching: false,
        searchError: translate(useAppStore.getState().lang, "internetSearchDesktopOnly"),
        results: [],
        hasSearched: true,
      });
      return;
    }

    set({ searching: true, searchError: null, hasSearched: true });
    try {
      const results = await api.searchInternetMusic(q, get().selectedSource, 20);
      set({ results, searching: false, searchError: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isInternalBinary =
        msg.includes("not bundled") || msg.includes("assets") || msg.includes("Unsupported");
      const userMsg = isInternalBinary
        ? translate(useAppStore.getState().lang, "internetSearchDesktopOnly")
        : msg;
      set({ searching: false, searchError: userMsg, results: [] });
    }
  },

  clearSearch() {
    set({ query: "", results: [], hasSearched: false, searchError: null });
  },

  async playPreview(result) {
    if (isAndroid()) return;
    const { previewTrackId, stopPreview } = get();
    if (previewTrackId === result.id) {
      const player = useMusicPlayerStore.getState();
      if (player.isPlaying) {
        player.pauseTrack();
      } else {
        player.resumeTrack();
      }
      return;
    }

    set({ previewTrackId: result.id, previewLoading: true, previewError: null });
    try {
      const streamUrl = await api.getInternetPreviewUrl(result.webpageUrl);

      const previewTrack: AudioTrackInfo = {
        id: `online:${result.id}`,
        uri: streamUrl,
        path: null,
        name: result.title,
        title: result.title,
        artist: result.artist || result.uploader || null,
        album: result.album || "Internet Stream",
        durationSecs: result.durationSecs || 0,
        sizeBytes: 0,
        modifiedTimestampMs: Date.now(),
        createdTimestampMs: Date.now(),
        format: "mp3",
        mimeType: "audio/mpeg",
        coverUrl: result.thumbnailUrl || null,
      };

      await useMusicPlayerStore.getState().playTrack(previewTrack);
      set({ previewLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ previewLoading: false, previewError: msg, previewTrackId: null });
      useAppStore.getState().pushToast("error", "previewFailed");
      await stopPreview();
    }
  },

  async stopPreview() {
    set({ previewTrackId: null, previewLoading: false });
  },

  async startDownload(result) {
    if (isAndroid()) return;
    const req: DownloadRequest = {
      id: result.id,
      webpageUrl: result.webpageUrl,
      title: result.title,
      artist: result.artist || result.uploader || null,
      thumbnailUrl: result.thumbnailUrl || null,
      format: "mp3",
    };

    set((state) => ({
      downloads: {
        ...state.downloads,
        [result.id]: {
          id: result.id,
          webpageUrl: result.webpageUrl,
          title: result.title,
          artist: result.artist || result.uploader || null,
          thumbnailUrl: result.thumbnailUrl || null,
          status: "queued",
          percent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speedBytesPerSec: null,
          etaSecs: 0,
          outputPath: null,
          error: null,
        },
      },
    }));

    try {
      await api.startInternetDownload(req);
      useAppStore.getState().pushToast("info", "downloadQueued");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set((state) => ({
        downloads: {
          ...state.downloads,
          [result.id]: {
            ...state.downloads[result.id],
            status: "failed",
            error: msg,
          },
        },
      }));
      useAppStore.getState().pushToast("error", "downloadFailed");
    }
  },

  async cancelDownload(id) {
    try {
      await api.cancelInternetDownload(id);
    } catch { /* best effort */ }
  },

  async retryDownload(id) {
    try {
      await api.retryInternetDownload(id);
      useAppStore.getState().pushToast("info", "downloadRetrying");
    } catch { /* best effort */ }
  },
}));
