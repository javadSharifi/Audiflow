import { create } from "zustand";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { LibraryTrack } from "../../types/generated";
import { scanMusicLibrary } from "../../utils/tauri";
import type { Track } from "./useMusicPlayerStore";

const STORAGE_KEY = "ac:music-library";

export type LibraryView = "songs" | "artists" | "albums";

export interface LibraryGroup {
  key: string;
  tracks: LibraryTrack[];
}

export function displayTitle(t: LibraryTrack): string {
  return t.title || t.name.replace(/\.[^.]+$/, "");
}

/** Case-insensitive match over title / artist / album / file name. */
export function filterLibrary(tracks: LibraryTrack[], query: string): LibraryTrack[] {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter((t) =>
    [t.title, t.artist, t.album, t.name].some((v) => v?.toLowerCase().includes(q)),
  );
}

/** Group by artist or album; missing tags land in a trailing "" group. */
export function groupLibrary(tracks: LibraryTrack[], by: "artist" | "album"): LibraryGroup[] {
  const map = new Map<string, LibraryTrack[]>();
  for (const t of tracks) {
    const key = (by === "artist" ? t.artist : t.album)?.trim() || "";
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      tracks: list.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b))),
    }))
    .sort((a, b) => (a.key === "") !== (b.key === "") ? (a.key === "" ? 1 : -1) : a.key.localeCompare(b.key));
}

export function toPlayerTrack(t: LibraryTrack, idx: number): Track {
  return {
    id: `${t.path}-${Date.now()}-${idx}`,
    path: t.path,
    name: t.name,
    title: displayTitle(t),
    artist: t.artist ?? undefined,
    durationSecs: t.durationSecs,
    sizeBytes: t.sizeBytes,
    format: t.path.split(".").pop()?.toUpperCase() || "AUDIO",
    assetUrl: convertFileSrc(t.path),
  };
}

interface LibraryState {
  dir: string | null;
  tracks: LibraryTrack[];
  scanning: boolean;
  error: string | null;
  scan: (dir: string | null) => Promise<void>;
}

function loadStored(): Pick<LibraryState, "dir" | "tracks"> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.tracks)) return { dir: p.dir ?? null, tracks: p.tracks };
    }
  } catch {
    /* ignore */
  }
  return { dir: null, tracks: [] };
}

export const useLibraryStore = create<LibraryState>()((set) => ({
  ...loadStored(),
  scanning: false,
  error: null,

  async scan(dir) {
    set({ scanning: true, error: null });
    try {
      const tracks = await scanMusicLibrary(dir);
      set({ dir, tracks, scanning: false });
      try {
        // shortcut: localStorage (~5 MB) holds ~20k tracks; move to a file in app data if libraries get bigger.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ dir, tracks }));
      } catch {
        /* quota exceeded: keep in memory only */
      }
    } catch (err) {
      set({ scanning: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
