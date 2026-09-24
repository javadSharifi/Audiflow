import type { StateCreator } from "zustand";
import type { LibrarySlice, MusicPlayerState } from "../types";
import type { AudioTrackInfo, CustomAlbum } from "../../../types";
import * as api from "../../../utils/tauri";
import {
  loadCachedTracks,
  persistCachedTracks,
  loadSavedSort,
  persistSavedSort,
  loadCustomFolders,
  persistCustomFolders,
} from "../persistence";
import { computeAllAlbums, isTrackLiked } from "../trackUtils";
import { scheduleArtworkPrefetch } from "../../../utils/artwork";

/**
 * Warm the artwork cache across Songs, Albums, and Liked tabs in browser idle time
 * so switching between tabs has covers ready immediately without pop-in delays.
 */
export function warmLibraryArtwork(
  tracks: AudioTrackInfo[],
  customAlbums: CustomAlbum[] = [],
  likedPaths: Set<string> = new Set(),
): void {
  if (tracks.length === 0) return;
  const candidates: AudioTrackInfo[] = [];

  // 1. First screenful of Songs tab (40 tracks)
  candidates.push(...tracks.slice(0, 40));

  // 2. First screenful of Albums tab (20 album covers)
  try {
    const { custom, auto } = computeAllAlbums(tracks, customAlbums);
    const topAlbums = [...custom, ...auto].slice(0, 20);
    for (const alb of topAlbums) {
      if (alb.coverTrack) candidates.push(alb.coverTrack);
    }
  } catch { /* best-effort: ignore */ }

  // 3. First screenful of Liked tab (20 tracks)
  if (likedPaths.size > 0) {
    let likedCount = 0;
    for (const t of tracks) {
      if (isTrackLiked(t, likedPaths)) {
        candidates.push(t);
        likedCount++;
        if (likedCount >= 20) break;
      }
    }
  }

  scheduleArtworkPrefetch(candidates, candidates.length);
}

export const createLibrarySlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  LibrarySlice
> = (set, get) => ({
  tracks: loadCachedTracks(),
  loading: false,
  hasScanned: false,
  searchQuery: "",
  sortBy: loadSavedSort(),
  permissionStatus: "granted",
  customFolders: loadCustomFolders(),

  async checkPermission() {
    try {
      const status = await api.getMusicPermissionStatus();
      set({ permissionStatus: status });
    } catch {
      set({ permissionStatus: "notRequired" });
    }
  },

  async requestMediaPermission() {
    try {
      api.requestMediaPermissions();
    } catch { /* best-effort: ignore */ }
    // The native dialog answers asynchronously with no callback — poll the
    // status so the grant is picked up without a second manual tap.
    const deadline = Date.now() + 15000;
    for (;;) {
      await get().checkPermission();
      const status = get().permissionStatus;
      if (status === "granted" || status === "notRequired") {
        const state = get();
        if (state.tracks.length === 0 && !state.loading) {
          void state.scanLibrary();
        }
        return true;
      }
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  },

  async scanLibrary(customDirs) {
    // Keep cached tracks visible while rescanning — the list only swaps
    // once fresh results arrive, so the UI never flashes empty and the
    // permission banner stays hidden when we already have songs.
    if (get().loading) return;
    const hadCached = get().tracks.length > 0;
    const isManual = customDirs !== undefined;
    set({ loading: true });
    try {
      const targetDirs =
        customDirs ?? (get().customFolders.length > 0 ? get().customFolders : undefined);
      const tracks = await api.scanAudioFiles(targetDirs);
      // A background auto-scan that comes back empty (e.g. permission
      // hiccup) must not wipe a good cache — keep showing cached songs.
      if (tracks.length === 0 && hadCached && !isManual) {
        set({ loading: false, hasScanned: true });
        return;
      }
      set({ tracks, loading: false, hasScanned: true });
      // Cache in the background; never let quota errors break the scan.
      try {
        persistCachedTracks(tracks);
      } catch { /* best-effort: ignore */ }
      // Warm covers for top songs, albums, and liked tracks during browser idle
      try {
        warmLibraryArtwork(tracks, get().customAlbums, get().likedPaths);
      } catch { /* best-effort: ignore */ }
    } catch (err) {
      console.warn("Library scan failed:", err);
      set({ loading: false, hasScanned: true });
    }
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setSortBy(sortBy) {
    persistSavedSort(sortBy);
    set({ sortBy });
  },

  async addCustomFolder(path) {
    const next = Array.from(new Set([...get().customFolders, path]));
    persistCustomFolders(next);
    set({ customFolders: next });
    await get().scanLibrary(next);
  },

  // Batched variant: dedupe + persist once + exactly one scan (N+1 avoided).
  // Resolves with the count of newly accepted folders (0 = nothing new).
  async addCustomFolders(paths) {
    const known = new Set(get().customFolders);
    const fresh = paths.filter((p) => !known.has(p));
    if (fresh.length === 0) return 0;
    const next = [...get().customFolders, ...fresh];
    persistCustomFolders(next);
    set({ customFolders: next });
    await get().scanLibrary(next);
    return fresh.length;
  },

  async removeCustomFolder(path) {
    const next = get().customFolders.filter((f) => f !== path);
    persistCustomFolders(next);
    set({ customFolders: next });
    await get().scanLibrary(next.length > 0 ? next : undefined);
  },
});
