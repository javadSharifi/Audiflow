import type { StateCreator } from "zustand";
import type { PlaybackSlice, MusicPlayerState } from "../types";
import { loadSavedBoosterGain, persistSavedBoosterGain } from "../persistence";
import {
  applyGainPercent,
  getGlobalGainNode,
  unifiedPlayTrack,
  unifiedPause,
  unifiedResume,
  unifiedSeekTo,
  unifiedSetRepeatMode,
  unifiedSetShuffleMode,
  unifiedSetSpeed,
  unifiedStop,
  cancelArmedAutoAdvance,
} from "../audioEngine";
import { createSeekDebouncer } from "../seekDebounce";
import { createGainGlider } from "../gainGlide";
import { playbackIdentityKey } from "../trackUtils";

/**
 * Module-scope trailing seek coalescer (003-volume-boost-accuracy US2).
 * Leading edge applies immediately; scrub bursts inside the window collapse
 * to one trailing apply of the final position.
 */
const seekDebouncer = createSeekDebouncer((targetSecs: number) => {
  void unifiedSeekTo(targetSecs);
});

/**
 * Module-scope gain glide (004-boost-slider-debounce US1). Slider/dial
 * ticks arrive at pointer-event rate; applying every one restarts the
 * engine per movement (audible chop). Leading edge stays immediate so
 * taps/toggles never lag; bursts glide at ~150 ms steps with a guaranteed
 * trailing flush of the final value.
 */
const gainGlider = createGainGlider((percent: number) => {
  try {
    // Routed through the shared WebAudio graph (with safe fallbacks inside).
    applyGainPercent(percent);
  } catch (e) {
    console.warn("Failed to set gain value:", e);
    // Last-resort fallback so playback never goes silent.
    try {
      const fallback = getGlobalGainNode();
      if (fallback) fallback.gain.value = percent / 100;
    } catch { /* best-effort: ignore */ }
  }
  persistSavedBoosterGain(percent);
});

export const createPlaybackSlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  PlaybackSlice
> = (set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playingKey: "",
  repeatMode: "off",
  shuffleMode: false,
  fullscreenOpen: false,
  playbackRate: 1.0,
  volumeGainPercent: loadSavedBoosterGain(),

  async playTrack(track, playlist) {
    if (playlist) {
      set({ currentPlaylist: playlist });
    }

    const currentList = playlist || get().currentPlaylist || get().tracks;
    const startIndex = currentList.findIndex(
      (t) => t.id === track.id || t.uri === track.uri || (t.path && t.path === track.path),
    );

    const current = get().currentTrack;
    if (current && (current.id === track.id || current.uri === track.uri) && get().isPlaying) {
      return;
    }

    // A new start takes over: kill any pending auto-advance token so a late
    // end pulse from the previous track can't double-advance (T017 race).
    cancelArmedAutoAdvance();

    set({
      currentTrack: track,
      playingKey: playbackIdentityKey(track),
      isPlaying: true,
      currentTime: 0,
      duration: track.durationSecs || 0,
    });

    await unifiedPlayTrack(track, currentList, startIndex >= 0 ? startIndex : 0);
  },

  pauseTrack() {
    void unifiedPause();
    set({ isPlaying: false });
  },

  closePlayer() {
    void unifiedStop();
    set({
      currentTrack: null,
      playingKey: "",
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      fullscreenOpen: false,
    });
  },

  resumeTrack() {
    void unifiedResume();
    set({ isPlaying: true });
  },

  async togglePlayTrack(track, playlist) {
    const current = get().currentTrack;
    const isCurrent = current && (current.id === track.id || current.uri === track.uri);
    if (isCurrent) {
      if (get().isPlaying) {
        get().pauseTrack();
      } else {
        get().resumeTrack();
      }
    } else {
      await get().playTrack(track, playlist);
    }
  },

  seekTo(timeSecs) {
    if (Number.isFinite(timeSecs)) {
      // 003-volume-boost-accuracy US2: coalesce scrub bursts so fast
      // scrubbing fires ~1 native seek per second and lands on the final
      // position. Optimistic UI stays instant; short tracks bypass.
      const duration = get().duration;
      if (duration > 0 && duration < 5) {
        void unifiedSeekTo(timeSecs);
      } else {
        seekDebouncer.request(timeSecs);
      }
      set({ currentTime: timeSecs });
    }
  },

  toggleRepeat() {
    const current = get().repeatMode;
    const next = current === "off" ? "all" : current === "all" ? "one" : "off";
    void unifiedSetRepeatMode(next);
    set({ repeatMode: next });
  },

  toggleShuffle() {
    const next = !get().shuffleMode;
    void unifiedSetShuffleMode(next);
    set({ shuffleMode: next });
  },

  setPlaybackMode(mode) {
    const repeatMode = mode === "repeatAll" ? "all" : mode === "repeatOne" ? "one" : "off";
    const shuffleMode = mode === "shuffle";
    void unifiedSetRepeatMode(repeatMode);
    void unifiedSetShuffleMode(shuffleMode);
    set({ repeatMode, shuffleMode });
  },

  setFullscreenOpen(open) {
    set({ fullscreenOpen: open });
  },

  setPlaybackRate(rate) {
    const clamped = Math.max(0.25, Math.min(4.0, rate));
    void unifiedSetSpeed(clamped);
    set({ playbackRate: clamped });
  },

  setVolumeGainPercent(gain) {
    const clamped = Math.max(0, Math.min(400, gain));
    // UI stays live on every tick; the engine glides behind (US1) and the
    // persisted value always matches an applied (heard) value.
    set({ volumeGainPercent: clamped });
    gainGlider.request(clamped);
  },
});
