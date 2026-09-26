import type { StateCreator } from "zustand";
import type { OnlineSlice, MusicPlayerState } from "../types";
import type { AudioTrackInfo, OnlineTrack } from "../../../types/generated";
import * as onlineApi from "../../../utils/onlineTauri";
import { useAppStore } from "../../useAppStore";
import { translate } from "../../../i18n";

function loadOnlineBookmarks(): OnlineTrack[] {
  try {
    if (typeof localStorage !== "undefined") {
      const data = localStorage.getItem("audiflow_online_library");
      if (data) return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Failed to load online bookmarks:", e);
  }
  return [];
}

function persistOnlineBookmarks(tracks: OnlineTrack[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("audiflow_online_library", JSON.stringify(tracks));
    }
  } catch (e) {
    console.warn("Failed to persist online bookmarks:", e);
  }
}

export const createOnlineSlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  OnlineSlice
> = (set, get) => ({
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
  onlineBookmarks: loadOnlineBookmarks(),

  toggleOnlineMode: (force) => {
    set((state) => ({
      isOnlineMode: force !== undefined ? force : !state.isOnlineMode,
      onlineError: null,
    }));
  },

  setOnlineQuery: (q: string) => {
    set({ onlineQuery: q });
  },

  searchOnline: async (query: string) => {
    const q = query.trim();
    if (!q) {
      set({ onlineResults: [], onlineError: null, isSearchingOnline: false });
      return;
    }
    set({ isSearchingOnline: true, onlineError: null });
    try {
      const results = await onlineApi.searchOnlineTracks(q);
      set({ onlineResults: results, isSearchingOnline: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ onlineError: message, isSearchingOnline: false, onlineResults: [] });
    }
  },

  playOnlineTrack: async (track: OnlineTrack, playlist?: OnlineTrack[]) => {
    set({ isResolvingStream: true, activeOnlineTrack: track });
    try {
      const streamSource = await onlineApi.resolveOnlineStream(
        track.id,
        track.streamIdentifier,
        track.provider,
      );

      const audioTrack: AudioTrackInfo = {
        id: track.id,
        uri: streamSource.streamUrl,
        path: null,
        name: track.title,
        title: track.title,
        artist: track.artist,
        album: track.album || track.provider,
        durationSecs: track.durationSecs,
        sizeBytes: 0,
        mimeType: streamSource.mimeType,
        format: streamSource.format,
        createdTimestampMs: Date.now(),
        modifiedTimestampMs: Date.now(),
        coverUrl: track.thumbnailUrl,
      };

      const convertedPlaylist: AudioTrackInfo[] = (playlist || get().onlineResults).map((item) => {
        if (item.id === track.id) return audioTrack;
        return {
          id: item.id,
          uri: `online-stream://${item.id}/${item.provider}/${encodeURIComponent(item.streamIdentifier)}`,
          path: null,
          name: item.title,
          title: item.title,
          artist: item.artist,
          album: item.album || item.provider,
          durationSecs: item.durationSecs,
          sizeBytes: 0,
          mimeType: "audio/mpeg",
          format: "mp3",
          createdTimestampMs: Date.now(),
          modifiedTimestampMs: Date.now(),
          coverUrl: item.thumbnailUrl,
        };
      });

      set({ isResolvingStream: false });
      await get().playTrack(audioTrack, convertedPlaylist);
      void get().fetchLyrics(track);
    } catch (err) {
      console.warn("Failed to resolve or play online track:", err);
      set({ isResolvingStream: false });
    }
  },

  downloadOnlineTrack: async (track: OnlineTrack) => {
    set((state) => ({
      downloadingTrackIds: { ...state.downloadingTrackIds, [track.id]: true },
    }));
    try {
      const media = await onlineApi.downloadOnlineTrack(track);
      set((state) => ({
        downloadedPaths: { ...state.downloadedPaths, [track.id]: media.filePath },
      }));
      const lang = useAppStore.getState().lang;
      useAppStore.getState().pushToast("info", translate(lang, "onlineDownloadSuccess"));
      void get().scanLibrary();
    } catch (err) {
      console.warn("Failed to download online track:", err);
      const lang = useAppStore.getState().lang;
      useAppStore.getState().pushToast("error", translate(lang, "onlineDownloadError"));
    } finally {
      set((state) => {
        const next = { ...state.downloadingTrackIds };
        delete next[track.id];
        return { downloadingTrackIds: next };
      });
    }
  },

  openInConverter: (filePath: string) => {
    if (!filePath) return;
    useAppStore.getState().addPaths([filePath]);
    useAppStore.getState().setActiveTool("converter");
  },

  toggleBookmark: (track: OnlineTrack) => {
    set((state) => {
      const exists = state.onlineBookmarks.some((b) => b.id === track.id);
      const next = exists
        ? state.onlineBookmarks.filter((b) => b.id !== track.id)
        : [...state.onlineBookmarks, track];
      persistOnlineBookmarks(next);
      return { onlineBookmarks: next };
    });
  },

  isBookmarked: (trackId: string) => {
    return get().onlineBookmarks.some((b) => b.id === trackId);
  },

  fetchLyrics: async (track) => {
    set({ isLoadingLyrics: true, timedLyrics: null });
    try {
      const lyrics = await onlineApi.fetchOnlineLyrics(
        track.title,
        track.artist,
        track.durationSecs,
      );
      set({ timedLyrics: lyrics, isLoadingLyrics: false });
    } catch (err) {
      console.warn("Failed to fetch lyrics:", err);
      set({ timedLyrics: null, isLoadingLyrics: false });
    }
  },

  clearOnlineSearch: () => {
    set({ onlineQuery: "", onlineResults: [], onlineError: null });
  },
});