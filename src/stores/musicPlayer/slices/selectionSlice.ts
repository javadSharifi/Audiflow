import type { StateCreator } from "zustand";
import type { SelectionSlice, MusicPlayerState } from "../types";
import * as api from "../../../utils/tauri";
import { isAndroid } from "../../../utils/platform";
import { evictArtworkCache } from "../../../utils/artwork";
import { getTrackAliases, isTrackLiked } from "../trackUtils";
import {
  persistLikedPaths,
  persistCachedTracks,
  persistCustomAlbums,
} from "../persistence";

export const createSelectionSlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  selectedTrackKeys: new Set(),
  isSelectionMode: false,

  enterSelectionMode(initialTrack) {
    const key = initialTrack
      ? initialTrack.uri || initialTrack.path || initialTrack.id
      : null;
    set({
      isSelectionMode: true,
      selectedTrackKeys: key ? new Set([key]) : new Set(),
    });
  },

  exitSelectionMode() {
    set({ isSelectionMode: false, selectedTrackKeys: new Set() });
  },

  toggleSelectTrack(trackOrKey) {
    const key =
      typeof trackOrKey === "string"
        ? trackOrKey
        : trackOrKey.uri || trackOrKey.path || trackOrKey.id;
    const next = new Set(get().selectedTrackKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    set({
      selectedTrackKeys: next,
      isSelectionMode: next.size > 0 ? true : get().isSelectionMode,
    });
  },

  selectAllTracks(tracks) {
    const keys = new Set(tracks.map((t) => t.uri || t.path || t.id));
    set({ selectedTrackKeys: keys, isSelectionMode: true });
  },

  clearSelection() {
    set({ selectedTrackKeys: new Set() });
  },

  async deleteMultipleTracks(tracksToDelete) {
    if (tracksToDelete.length === 0) return;

    for (const track of tracksToDelete) {
      const targetKey = track.uri || track.path || track.id;
      try {
        await api.deleteAudioTrack(targetKey);
      } catch (e) {
        console.warn("Failed to delete track:", targetKey, e);
      }
    }

    const deleteKeySet = new Set(
      tracksToDelete.map((t) => t.uri || t.path || t.id),
    );
    // Drop cached covers so a later track reusing one of these uris never
    // inherits the deleted track's artwork (mirrors the native cache evict
    // in MainActivity.deleteAudioTrack).
    try {
      evictArtworkCache(Array.from(deleteKeySet));
    } catch { /* best-effort: ignore */ }

    const current = get().currentTrack;
    if (
      current &&
      (deleteKeySet.has(current.id) ||
        deleteKeySet.has(current.uri) ||
        (current.path && deleteKeySet.has(current.path)))
    ) {
      get().pauseTrack();
      set({ currentTrack: null, playingKey: "", isPlaying: false, currentTime: 0 });
    }

    const deleteAliases = new Set(
      tracksToDelete.flatMap((t) => getTrackAliases(t)),
    );

    set((state) => {
      const nextLiked = new Set(state.likedPaths);
      deleteAliases.forEach((k) => nextLiked.delete(k));
      persistLikedPaths(nextLiked);

      const nextTracks = state.tracks.filter(
        (t) =>
          !deleteKeySet.has(t.id) &&
          !deleteKeySet.has(t.uri) &&
          (!t.path || !deleteKeySet.has(t.path)),
      );
      const nextPlaylist = state.currentPlaylist.filter(
        (t) =>
          !deleteKeySet.has(t.id) &&
          !deleteKeySet.has(t.uri) &&
          (!t.path || !deleteKeySet.has(t.path)),
      );

      const nextAlbums = state.customAlbums.map((album) => ({
        ...album,
        trackKeys: album.trackKeys.filter((k) => !deleteKeySet.has(k)),
      }));
      persistCustomAlbums(nextAlbums);

      return {
        tracks: nextTracks,
        currentPlaylist: nextPlaylist,
        customAlbums: nextAlbums,
        likedPaths: nextLiked,
        selectedTrackKeys: new Set(),
        isSelectionMode: false,
      };
    });
    try {
      persistCachedTracks(get().tracks);
    } catch { /* best-effort: ignore */ }
  },

  addMultipleTracksToAlbum(albumId, tracksToAdd) {
    const keys = tracksToAdd.map((t) => t.uri || t.path || t.id);
    set((state) => {
      const next = state.customAlbums.map((a) => {
        if (a.id === albumId) {
          const keySet = new Set(a.trackKeys);
          for (const k of keys) {
            keySet.add(k);
          }
          return { ...a, trackKeys: Array.from(keySet) };
        }
        return a;
      });
      persistCustomAlbums(next);
      return { customAlbums: next };
    });
  },

  async deleteTrack(track) {
    const targetKey = track.uri || track.path || track.id;
    try {
      await api.deleteAudioTrack(targetKey);
    } catch (e) {
      console.warn("Failed to delete track:", targetKey, e);
    }
    // See deleteMultipleTracks: keep the artwork cache free of stale covers.
    try {
      evictArtworkCache([targetKey]);
    } catch { /* best-effort: ignore */ }

    // If currently playing, stop playback
    const current = get().currentTrack;
    if (current && (current.id === track.id || current.uri === track.uri)) {
      get().pauseTrack();
      set({ currentTrack: null, playingKey: "", isPlaying: false, currentTime: 0 });
    }

    // Remove from tracks and currentPlaylist
    set((state) => {
      const nextTracks = state.tracks.filter(
        (t) => t.id !== track.id && t.uri !== track.uri,
      );
      const nextPlaylist = state.currentPlaylist.filter(
        (t) => t.id !== track.id && t.uri !== track.uri,
      );
      return { tracks: nextTracks, currentPlaylist: nextPlaylist };
    });
    try {
      persistCachedTracks(get().tracks);
    } catch { /* best-effort: ignore */ }

    // Remove from liked if present
    const isLiked = isTrackLiked(track, get().likedPaths);
    if (isLiked) {
      get().toggleLike(track);
    }

    // Remove from custom albums
    const aliases = getTrackAliases(track);
    set((state) => {
      const nextAlbums = state.customAlbums.map((a) => ({
        ...a,
        trackKeys: a.trackKeys.filter((k) => !aliases.includes(k)),
      }));
      persistCustomAlbums(nextAlbums);
      return { customAlbums: nextAlbums };
    });
  },

  async setRingtone(track) {
    const targetKey = track.uri || track.path || track.id;
    await api.setAsRingtone(targetKey);
  },

  async shareTrack(track) {
    const targetKey = track.uri || track.path || track.id;
    const title = track.title || track.name;
    const mime = track.mimeType || "audio/mpeg";

    // The Android WebView exposes navigator.share, but only for title/text —
    // sharing without the audio file looks broken. Always use the native
    // FileProvider share there; the web path stays for desktop browsers.
    if (!isAndroid() && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `${title} - ${track.artist || "Audio Track"}`,
        });
        return;
      } catch {
        // Fallback to native backend command
      }
    }

    await api.shareAudioTrack(targetKey, title, mime);
  },
});
