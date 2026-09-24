import type { StateCreator } from "zustand";
import type { AlbumsSlice, MusicPlayerState } from "../types";
import type { CustomAlbum } from "../../../types";
import { loadCustomAlbums, persistCustomAlbums } from "../persistence";
import { getTrackKey, getTrackAliases } from "../trackUtils";

export const createAlbumsSlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  AlbumsSlice
> = (set, get) => ({
  customAlbums: loadCustomAlbums(),

  createCustomAlbum(name) {
    const newAlbum: CustomAlbum = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || "Untitled Album",
      trackKeys: [],
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    const next = [newAlbum, ...get().customAlbums];
    persistCustomAlbums(next);
    set({ customAlbums: next });
    return newAlbum.id;
  },

  renameCustomAlbum(albumId, newName) {
    const next = get().customAlbums.map((a) =>
      a.id === albumId
        ? { ...a, name: newName.trim() || a.name, updatedAtMs: Date.now() }
        : a,
    );
    persistCustomAlbums(next);
    set({ customAlbums: next });
  },

  deleteCustomAlbum(albumId) {
    const next = get().customAlbums.filter((a) => a.id !== albumId);
    persistCustomAlbums(next);
    set({ customAlbums: next });
  },

  addTrackToAlbum(albumId, track) {
    const key = getTrackKey(track);
    const next = get().customAlbums.map((a) => {
      if (a.id === albumId) {
        const exists = a.trackKeys.includes(key);
        const nextKeys = exists ? a.trackKeys : [...a.trackKeys, key];
        return { ...a, trackKeys: nextKeys, updatedAtMs: Date.now() };
      }
      return a;
    });
    persistCustomAlbums(next);
    set({ customAlbums: next });
  },

  removeTrackFromAlbum(albumId, track) {
    const aliases = getTrackAliases(track);
    const next = get().customAlbums.map((a) => {
      if (a.id === albumId) {
        const nextKeys = a.trackKeys.filter((k) => !aliases.includes(k));
        return { ...a, trackKeys: nextKeys, updatedAtMs: Date.now() };
      }
      return a;
    });
    persistCustomAlbums(next);
    set({ customAlbums: next });
  },

  isTrackInAlbum(albumId, track) {
    const album = get().customAlbums.find((a) => a.id === albumId);
    if (!album) return false;
    const aliases = getTrackAliases(track);
    return album.trackKeys.some((k) => aliases.includes(k));
  },
});
