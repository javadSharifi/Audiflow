import type { StateCreator } from "zustand";
import type { FavoritesSlice, MusicPlayerState } from "../types";
import { loadLikedPaths, persistLikedPaths } from "../persistence";
import { getTrackKey, getTrackAliases, isTrackLiked } from "../trackUtils";

export const createFavoritesSlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  FavoritesSlice
> = (set, get) => ({
  likedPaths: loadLikedPaths(),

  toggleLike(trackOrKey) {
    set((state) => {
      const next = new Set(state.likedPaths);
      let aliases: string[];
      let primaryKey: string;

      if (typeof trackOrKey === "string") {
        primaryKey = trackOrKey;
        const matched = state.tracks.find(
          (t) => t.id === trackOrKey || t.uri === trackOrKey || (t.path && t.path === trackOrKey),
        );
        if (matched) {
          aliases = getTrackAliases(matched);
        } else {
          aliases = [trackOrKey];
        }
      } else {
        primaryKey = getTrackKey(trackOrKey);
        aliases = getTrackAliases(trackOrKey);
      }

      // If any alias is currently in likedPaths, remove ALL aliases
      const currentlyLiked = aliases.some((k) => next.has(k));
      if (currentlyLiked) {
        aliases.forEach((k) => next.delete(k));
      } else {
        next.add(primaryKey);
      }

      persistLikedPaths(next);
      return { likedPaths: next };
    });
  },

  toggleLikeMultiple(tracksToToggle) {
    if (tracksToToggle.length === 0) return false;
    let didLike = false;
    set((state) => {
      const next = new Set(state.likedPaths);
      const allLiked = tracksToToggle.every((t) => isTrackLiked(t, state.likedPaths));
      didLike = !allLiked;

      for (const track of tracksToToggle) {
        const aliases = getTrackAliases(track);
        if (allLiked) {
          // Unlike all
          aliases.forEach((k) => next.delete(k));
        } else {
          // Like all
          const primaryKey = getTrackKey(track);
          aliases.forEach((k) => next.delete(k));
          next.add(primaryKey);
        }
      }

      persistLikedPaths(next);
      return { likedPaths: next };
    });
    return didLike;
  },

  isLiked(trackOrKey) {
    return isTrackLiked(trackOrKey, get().likedPaths, get().tracks);
  },
});
