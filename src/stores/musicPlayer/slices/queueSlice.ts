import type { StateCreator } from "zustand";
import type { QueueSlice, MusicPlayerState } from "../types";
import { isAndroid } from "../../../utils/platform";
import {
  unifiedNext,
  unifiedPrevious,
  publishStoppedMediaState,
} from "../audioEngine";
import {
  resolveNextTrack,
  noteUnplayable,
  snapshotUnplayableKeys,
  trackKey,
} from "../autoAdvance";
import { useAppStore } from "../../useAppStore";

export const createQueueSlice: StateCreator<
  MusicPlayerState,
  [],
  [],
  QueueSlice
> = (set, get) => ({
  currentPlaylist: [],

  async playNextTrack(auto = false) {
    const state = get();
    // Android: the native ExoPlayer owns the queue (set via playTrack's
    // playlist+index). Delegate next/prev to it so notification, lock
    // screen, Bluetooth and auto-advance all share one queue — Rhythm does
    // controller.seekToNext() for the same reason. Re-calling playTrack()
    // here would rebuild the whole queue (re-buffer + notification flicker).
    // NOTE: repeat-one only loops on AUTO (track end, handled natively by
    // ExoPlayer REPEAT_MODE_ONE). A MANUAL next must always advance — the
    // previous code restarted the same track on manual next, which disagrees
    // with Rhythm/platform convention.
    if (isAndroid()) {
      try {
        await unifiedNext();
      } catch (e) {
        console.warn("Native next failed, falling back to JS queue:", e);
      }
      // If native has no queue (e.g. single-track cold start or native
      // error), fall through to the JS queue logic below only when the
      // native call clearly could not advance. The push+poll sync adopts
      // the native track quickly; optimistic JS switching here would
      // fight it, so only fall back when there is nothing native to advance.
      // Heuristic: fall back only when the native playlist is empty.
      // (Native queue is populated on every playTrack with a playlist.)
      if (state.currentPlaylist.length > 0) return;
    }
    const list = state.currentPlaylist.length > 0 ? state.currentPlaylist : state.tracks;
    if (list.length === 0) return;

    const outcome = resolveNextTrack({
      list,
      currentTrack: state.currentTrack,
      repeatMode: state.repeatMode,
      shuffleMode: state.shuffleMode,
    });
    if (outcome.kind === "repeatOne") {
      state.seekTo(0);
      state.resumeTrack();
      return;
    }
    if (outcome.kind === "stop") {
      if (!auto && list.length > 0) {
        // Manual next past the end wraps (long-standing behavior); only
        // AUTO advance stops, so the queue end never freezes silently.
        await state.playTrack(list[0], list);
        return;
      }
      set({ isPlaying: false, currentTime: 0 });
      publishStoppedMediaState();
      return;
    }

    await state.playTrack(outcome.track, list);
  },

  async handleTrackStartFailure(failedTrack) {
    if (!failedTrack) return;
    const state = get();
    noteUnplayable(trackKey(failedTrack));
    try {
      useAppStore.getState().pushToast("warning", "playerSkippedUnplayable");
    } catch { /* best-effort: ignore */ }
    const list = state.currentPlaylist.length > 0 ? state.currentPlaylist : state.tracks;
    const outcome =
      list.length === 0
        ? ({ kind: "stop" } as const)
        : resolveNextTrack({
            list,
            currentTrack: failedTrack,
            repeatMode: state.repeatMode,
            shuffleMode: state.shuffleMode,
            excludeKeys: snapshotUnplayableKeys(),
          });
    if (outcome.kind === "repeatOne") {
      state.seekTo(0);
      state.resumeTrack();
      return;
    }
    if (outcome.kind === "stop") {
      set({ isPlaying: false, currentTime: 0 });
      publishStoppedMediaState();
      return;
    }
    await state.playTrack(outcome.track, list);
  },

  async playPreviousTrack() {
    const state = get();
    // Android: delegate to the native queue (see playNextTrack). The >3s
    // restart-vs-previous rule is enforced natively by position: if the
    // native position is past 3s we seek to 0, else we step back.
    if (isAndroid()) {
      if (state.currentTime > 3) {
        state.seekTo(0);
        return;
      }
      try {
        await unifiedPrevious();
      } catch (e) {
        console.warn("Native previous failed, falling back to JS queue:", e);
      }
      if (state.currentPlaylist.length > 0) return;
    }
    const list = state.currentPlaylist.length > 0 ? state.currentPlaylist : state.tracks;
    if (list.length === 0) return;

    // If more than 3 seconds into track, seek to 0 instead of previous track
    if (state.currentTime > 3) {
      state.seekTo(0);
      return;
    }

    const currentIndex = list.findIndex(
      (t) =>
        state.currentTrack &&
        (t.id === state.currentTrack.id || t.uri === state.currentTrack.uri),
    );

    let prevIndex = list.length - 1;
    if (currentIndex > 0) {
      prevIndex = currentIndex - 1;
    }

    const prevTrack = list[prevIndex];
    if (prevTrack) {
      await state.playTrack(prevTrack, list);
    }
  },
});
