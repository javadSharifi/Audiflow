import { create } from "zustand";
import { EQ_FREQS, EQ_PRESETS, EQ_RANGE_DB, type EqPreset } from "./audioGraph";

export interface Track {
  id: string;
  path: string;
  name: string;
  title: string;
  artist?: string;
  durationSecs: number;
  sizeBytes: number;
  format: string;
  assetUrl?: string;
}

export type RepeatMode = "off" | "all" | "one";

export interface MusicPlayerState {
  playlist: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  playbackRate: number;
  skipSilence: boolean;
  /** 0 = off; otherwise seconds of overlap between tracks. */
  crossfadeSecs: number;
  eqEnabled: boolean;
  /** dB per band, aligned with EQ_FREQS. */
  eqGains: number[];
  /** Epoch ms when the sleep timer pauses playback; null = off. */
  sleepEndsAt: number | null;
  /** Pause when the current track ends instead of advancing. */
  sleepAfterTrack: boolean;

  // Actions
  addTracks: (newTracks: Track[]) => void;
  removeTrack: (id: string) => void;
  clearPlaylist: () => void;
  /** Replace the whole queue (e.g. "play album") and start at `startIndex`. */
  replacePlaylist: (tracks: Track[], startIndex: number) => void;
  playTrack: (index: number) => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleSkipSilence: () => void;
  setCrossfadeSecs: (secs: number) => void;
  setEqEnabled: (on: boolean) => void;
  setEqGain: (band: number, db: number) => void;
  setEqPreset: (preset: EqPreset) => void;
  setSleepTimer: (minutes: number | null) => void;
  setSleepAfterTrack: (on: boolean) => void;
  /** Called from the audio element's `ended` event. */
  trackEnded: () => void;
  loadSavedPlaylist: () => void;
}

const STORAGE_PLAYLIST_KEY = "ac:music-playlist";
const STORAGE_PREFS_KEY = "ac:music-prefs";

function loadStoredPlaylist(): Track[] {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_PLAYLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return [];
}

type Prefs = Pick<
  MusicPlayerState,
  | "volume"
  | "isMuted"
  | "repeatMode"
  | "isShuffle"
  | "playbackRate"
  | "skipSilence"
  | "crossfadeSecs"
  | "eqEnabled"
  | "eqGains"
>;

const PREF_KEYS = [
  "volume",
  "isMuted",
  "repeatMode",
  "isShuffle",
  "playbackRate",
  "skipSilence",
  "crossfadeSecs",
  "eqEnabled",
  "eqGains",
] as const satisfies readonly (keyof Prefs)[];

function loadStoredPrefs(): Prefs {
  const defaults: Prefs = {
    volume: 0.85,
    isMuted: false,
    repeatMode: "all" as RepeatMode,
    isShuffle: false,
    playbackRate: 1.0,
    skipSilence: false,
    crossfadeSecs: 0,
    eqEnabled: false,
    eqGains: [...EQ_PRESETS.flat],
  };
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_PREFS_KEY);
      if (raw) {
        const merged: Prefs = { ...defaults, ...JSON.parse(raw) };
        if (!Array.isArray(merged.eqGains) || merged.eqGains.length !== EQ_FREQS.length) {
          merged.eqGains = defaults.eqGains;
        }
        return merged;
      }
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

function persistPlaylist(playlist: Track[]) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_PLAYLIST_KEY, JSON.stringify(playlist));
    }
  } catch {
    /* ignore */
  }
}

function persistPrefs(s: Prefs) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_PREFS_KEY,
        JSON.stringify(Object.fromEntries(PREF_KEYS.map((k) => [k, s[k]]))),
      );
    }
  } catch {
    /* ignore */
  }
}

const initialPrefs = loadStoredPrefs();
let sleepTimeout: ReturnType<typeof setTimeout> | undefined;

export const useMusicPlayerStore = create<MusicPlayerState>()((set, get) => ({
  playlist: loadStoredPlaylist(),
  currentTrackIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: initialPrefs.volume,
  isMuted: initialPrefs.isMuted,
  repeatMode: initialPrefs.repeatMode,
  isShuffle: initialPrefs.isShuffle,
  playbackRate: initialPrefs.playbackRate,
  skipSilence: initialPrefs.skipSilence,
  crossfadeSecs: initialPrefs.crossfadeSecs,
  eqEnabled: initialPrefs.eqEnabled,
  eqGains: initialPrefs.eqGains,
  sleepEndsAt: null,
  sleepAfterTrack: false,

  loadSavedPlaylist() {
    const saved = loadStoredPlaylist();
    set({ playlist: saved });
  },

  addTracks(newTracks) {
    const { playlist } = get();
    // Filter out duplicates by path or id
    const existingPaths = new Set(playlist.map((t) => t.path));
    const toAdd = newTracks.filter((t) => !existingPaths.has(t.path));
    if (toAdd.length === 0) return;

    const updated = [...playlist, ...toAdd];
    set({ playlist: updated });
    persistPlaylist(updated);
  },

  removeTrack(id) {
    const { playlist, currentTrackIndex } = get();
    const targetIdx = playlist.findIndex((t) => t.id === id);
    if (targetIdx === -1) return;

    const updated = playlist.filter((t) => t.id !== id);
    let nextIdx = currentTrackIndex;

    if (updated.length === 0) {
      nextIdx = 0;
      set({ playlist: [], currentTrackIndex: 0, isPlaying: false, currentTime: 0, duration: 0 });
      persistPlaylist([]);
      return;
    }

    if (targetIdx < currentTrackIndex) {
      nextIdx = currentTrackIndex - 1;
    } else if (targetIdx === currentTrackIndex) {
      nextIdx = Math.min(currentTrackIndex, updated.length - 1);
      set({ isPlaying: false, currentTime: 0 });
    }

    set({ playlist: updated, currentTrackIndex: nextIdx });
    persistPlaylist(updated);
  },

  clearPlaylist() {
    set({
      playlist: [],
      currentTrackIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    });
    persistPlaylist([]);
  },

  replacePlaylist(tracks, startIndex) {
    const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
    set({
      playlist: tracks,
      currentTrackIndex: idx,
      currentTime: 0,
      duration: 0,
      isPlaying: tracks.length > 0,
    });
    persistPlaylist(tracks);
  },

  playTrack(index) {
    const { playlist } = get();
    if (index >= 0 && index < playlist.length) {
      set({
        currentTrackIndex: index,
        isPlaying: true,
        currentTime: 0,
      });
    }
  },

  togglePlay() {
    const { playlist, isPlaying } = get();
    if (playlist.length === 0) return;
    set({ isPlaying: !isPlaying });
  },

  setIsPlaying(playing) {
    set({ isPlaying: playing });
  },

  nextTrack() {
    const { playlist, currentTrackIndex, isShuffle, repeatMode } = get();
    if (playlist.length === 0) return;

    if (repeatMode === "one") {
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    if (isShuffle && playlist.length > 1) {
      let randIdx = currentTrackIndex;
      while (randIdx === currentTrackIndex) {
        randIdx = Math.floor(Math.random() * playlist.length);
      }
      set({ currentTrackIndex: randIdx, currentTime: 0, isPlaying: true });
      return;
    }

    const nextIdx = currentTrackIndex + 1;
    if (nextIdx < playlist.length) {
      set({ currentTrackIndex: nextIdx, currentTime: 0, isPlaying: true });
    } else if (repeatMode === "all") {
      set({ currentTrackIndex: 0, currentTime: 0, isPlaying: true });
    } else {
      set({ isPlaying: false, currentTime: 0 });
    }
  },

  prevTrack() {
    const { playlist, currentTrackIndex, currentTime } = get();
    if (playlist.length === 0) return;

    // If current song has played > 3 seconds, replay from start
    if (currentTime > 3) {
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    const prevIdx = currentTrackIndex - 1;
    if (prevIdx >= 0) {
      set({ currentTrackIndex: prevIdx, currentTime: 0, isPlaying: true });
    } else {
      set({ currentTrackIndex: playlist.length - 1, currentTime: 0, isPlaying: true });
    }
  },

  setCurrentTime(time) {
    set({ currentTime: time });
  },

  setDuration(duration) {
    set({ duration });
  },

  setVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
    persistPrefs(get());
  },

  toggleMute() {
    set({ isMuted: !get().isMuted });
    persistPrefs(get());
  },

  setRepeatMode(mode) {
    set({ repeatMode: mode });
    persistPrefs(get());
  },

  toggleRepeatMode() {
    const modes: RepeatMode[] = ["all", "one", "off"];
    set({ repeatMode: modes[(modes.indexOf(get().repeatMode) + 1) % modes.length] });
    persistPrefs(get());
  },

  toggleShuffle() {
    set({ isShuffle: !get().isShuffle });
    persistPrefs(get());
  },

  setPlaybackRate(rate) {
    set({ playbackRate: rate });
    persistPrefs(get());
  },

  toggleSkipSilence() {
    set({ skipSilence: !get().skipSilence });
    persistPrefs(get());
  },

  setCrossfadeSecs(secs) {
    set({ crossfadeSecs: Math.max(0, Math.min(12, secs)) });
    persistPrefs(get());
  },

  setEqEnabled(on) {
    set({ eqEnabled: on });
    persistPrefs(get());
  },

  setEqGain(band, db) {
    const eqGains = [...get().eqGains];
    eqGains[band] = Math.max(-EQ_RANGE_DB, Math.min(EQ_RANGE_DB, db));
    set({ eqGains, eqEnabled: true });
    persistPrefs(get());
  },

  setEqPreset(preset) {
    set({ eqGains: [...EQ_PRESETS[preset]], eqEnabled: true });
    persistPrefs(get());
  },

  setSleepTimer(minutes) {
    clearTimeout(sleepTimeout);
    if (minutes === null) {
      set({ sleepEndsAt: null });
      return;
    }
    const ms = minutes * 60_000;
    set({ sleepEndsAt: Date.now() + ms, sleepAfterTrack: false });
    sleepTimeout = setTimeout(() => set({ isPlaying: false, sleepEndsAt: null }), ms);
  },

  setSleepAfterTrack(on) {
    if (on) get().setSleepTimer(null);
    set({ sleepAfterTrack: on });
  },

  trackEnded() {
    if (get().sleepAfterTrack) {
      set({ isPlaying: false, sleepAfterTrack: false, currentTime: 0 });
      return;
    }
    get().nextTrack();
  },
}));

/**
 * Whether the current track should crossfade into the next one rather than
 * end normally: only when an actual *different* track follows.
 */
export function canCrossfade(
  s: Pick<
    MusicPlayerState,
    "crossfadeSecs" | "playlist" | "currentTrackIndex" | "isShuffle" | "repeatMode" | "sleepAfterTrack"
  >,
): boolean {
  if (s.crossfadeSecs <= 0 || s.sleepAfterTrack || s.repeatMode === "one") return false;
  if (s.playlist.length < 2) return false;
  return s.isShuffle || s.repeatMode === "all" || s.currentTrackIndex + 1 < s.playlist.length;
}
