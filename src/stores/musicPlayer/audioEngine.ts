import { convertFileSrc } from "@tauri-apps/api/core";
import * as api from "../../utils/tauri";
import { resolveOnlineStream } from "../../utils/onlineTauri";
import { isAndroid, isLinux } from "../../utils/platform";
import { revokeActiveBlobSrc, toPlayableLinuxAudioSrc } from "./linuxAssetAudio";
import { initMediaSession, syncMediaSession } from "../../utils/mediaSession";
import type { StoreApi } from "zustand";
import type { AudioTrackInfo } from "../../types";
import type { MusicPlayerState } from "./types";
import { createAdvanceGuard, clearUnplayable, trackKey } from "./autoAdvance";
import { playbackIdentityKey } from "./trackUtils";

type MusicStore = StoreApi<MusicPlayerState>;

let boundStore: MusicStore | null = null;
let androidPollTimer: ReturnType<typeof setInterval> | null = null;

export function bindMusicStore(store: MusicStore): void {
  boundStore = store;
}

let globalAudio: HTMLAudioElement | null = null;
let globalAudioContext: AudioContext | null = null;
let globalGainNode: GainNode | null = null;
let graphInitFailed = false;

// Single-fire guard for track-end auto-advance (see autoAdvance.ts): every
// real track start (`play`) arms a fresh generation; each end signal consumes
// it, so a doubled `ended` + watchdog pair can never advance twice.
const advanceGuard = createAdvanceGuard();
let armedAdvanceGeneration = -1;

/** Position within the last epsilon of a known duration counts as ended. */
const END_WATCHDOG_EPSILON_SECS = 0.25;

function requestGuardedAutoAdvance(): void {
  const s = boundStore?.getState();
  if (!s || !advanceGuard.isCurrent(armedAdvanceGeneration)) return;
  armedAdvanceGeneration = -1;
  void s.playNextTrack(true);
}

/**
 * Invalidate a pending auto-advance token. Called whenever a NEW track start
 * takes over (manual tap/next/prev or skip): a late `ended`/watchdog pulse
 * from the previous track must never advance the queue a second time. The
 * new track's own `play` event re-arms the guard.
 */
export function cancelArmedAutoAdvance(): void {
  armedAdvanceGeneration = -1;
}

/**
 * Ensure the WebAudio gain graph exists BEFORE any src is assigned.
 * Must run before first play so enabling the booster mid-play never
 * re-routes the element (the classic "boost = silence until restart" bug).
 * Sets crossOrigin upfront so asset:// URLs stay CORS-clean once piped
 * through MediaElementSource.
 */
function ensureAudioGraph(): GainNode | null {
  // Android: the native ExoPlayer is the only engine. Building a WebAudio
  // graph (and its HTMLAudioElement below) on Android creates the competing
  // source of truth Rhythm avoids — a second "player" whose listeners fight
  // the native poll/push bridge. Desktop-only by design.
  if (isAndroid()) return null;
  if (typeof window === "undefined" || graphInitFailed) return globalGainNode;
  if (globalGainNode) return globalGainNode;
  const audio = getGlobalAudio();
  if (!audio) return null;
  try {
    // crossOrigin must be set before src — do it here as well as at creation.
    if (!audio.getAttribute("crossorigin")) {
      try {
        audio.crossOrigin = "anonymous";
      } catch { /* best-effort: ignore */ }
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    // Reuse a running context if one already exists.
    if (!globalAudioContext) {
      globalAudioContext = new AudioCtx();
    }
    const source = globalAudioContext.createMediaElementSource(audio);
    globalGainNode = globalAudioContext.createGain();
    // Apply the currently stored boost level immediately so the graph
    // never starts at an unexpected gain.
    try {
      const stored = boundStore?.getState().volumeGainPercent ?? 100;
      globalGainNode.gain.value = Math.max(0, Math.min(400, stored)) / 100;
    } catch {
      globalGainNode.gain.value = 1;
    }
    source.connect(globalGainNode);
    globalGainNode.connect(globalAudioContext.destination);
    // Keep element volume at max — loudness is driven by the GainNode.
    try {
      audio.volume = 1;
    } catch { /* best-effort: ignore */ }
  } catch (e) {
    // createMediaElementSource throws if the element is already bound
    // (e.g. HMR re-init). Don't retry forever; fall back to element volume.
    console.warn("Web Audio GainNode setup skipped:", e);
    if (!globalGainNode) graphInitFailed = true;
  }
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    void globalAudioContext.resume().catch(() => {});
  }
  return globalGainNode;
}

export function getGlobalGainNode(): GainNode | null {
  if (typeof window === "undefined" || isAndroid()) return null;
  const node = ensureAudioGraph();
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    void globalAudioContext.resume().catch(() => {});
  }
  return node;
}

/**
 * Convert a 0-400% boost level to a LoudnessEnhancer target gain in millibels (mB).
 * 100% (and anything below) is 0 mB — plain volume covers that range;
 * 101-400% maps aggressively up to 8000 mB (+80 dB nominal) matching competitor apps.
 */
export function boosterMbForPercent(percent: number): number {
  if (percent <= 100) return 0;
  const clamped = Math.min(400, Math.max(100, percent));
  const fraction = (clamped - 100) / 300;
  return Math.round(fraction * 8000);
}

/**
 * Convert a 0-400% boost level to nominal dB (1 dB = 100 mB).
 * 100% = 0.0 dB, 200% = +26.7 dB, 400% = +80.0 dB.
 */
export function boosterDbForPercent(percent: number): number {
  const mb = boosterMbForPercent(percent);
  return mb / 100;
}

/** Apply a 0-400% boost level to the live graph (with volume fallback). */
export function applyGainPercent(percent: number): void {
  const clamped = Math.max(0, Math.min(400, percent));
  if (isAndroid()) {
    // 0-100% rides native volume fraction; >100% rides BoostEngine via
    // aggressive 0..8000 mB LoudnessEnhancer target gain (008-real-volume-boost-400).
    try {
      if (clamped > 100) {
        void api.androidPlayerSetVolume(1).catch(() => {});
        void api.androidPlayerSetBoosterGainMb(boosterMbForPercent(clamped)).catch(() => {});
      } else {
        void api.androidPlayerSetBoosterGainMb(0).catch(() => {});
        void api.androidPlayerSetVolume(Math.max(0, Math.min(1, clamped / 100))).catch(() => {});
      }
    } catch { /* best-effort: ignore */ }
    return;
  }
  const audio = getGlobalAudio();
  const node = ensureAudioGraph();
  if (node) {
    try {
      // setTargetAtTime avoids clicks when dragging the slider.
      const t = globalAudioContext?.currentTime;
      if (globalAudioContext && typeof t === "number") {
        node.gain.setTargetAtTime(clamped / 100, t, 0.02);
      } else {
        node.gain.value = clamped / 100;
      }
    } catch (e) {
      console.warn("Failed to set gain value:", e);
    }
    if (audio) {
      try {
        audio.volume = 1;
        audio.muted = clamped === 0 ? true : false;
        if (clamped === 0) node.gain.value = 0;
        else if (audio.muted) audio.muted = false;
      } catch { /* best-effort: ignore */ }
    }
  } else if (audio) {
    // WebAudio unavailable — best-effort fallback so sound never goes silent.
    try {
      audio.muted = false;
      audio.volume = Math.max(0, Math.min(1, clamped / 100));
    } catch { /* best-effort: ignore */ }
  }
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    void globalAudioContext.resume().catch(() => {});
  }
}

export function getGlobalAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || isAndroid()) return null;
  if (!globalAudio) {
    globalAudio = new Audio();
    globalAudio.preload = "auto";
    try {
      // Must be set before any src assignment for WebAudio CORS to work.
      globalAudio.crossOrigin = "anonymous";
      globalAudio.volume = 1;
    } catch { /* best-effort: ignore */ }

    const state = () => boundStore?.getState();

    // Initialize Lock Screen / System Media Session listeners (Web / Desktop)
    initMediaSession({
      onPlay: () => state()?.resumeTrack(),
      onPause: () => state()?.pauseTrack(),
      onPrevious: () => void state()?.playPreviousTrack(),
      onNext: () => void state()?.playNextTrack(),
      onSeek: (timeSecs) => state()?.seekTo(timeSecs),
      getCurrentTime: () => state()?.currentTime ?? 0,
    });

    globalAudio.addEventListener("timeupdate", () => {
      if (!globalAudio) return;
      const cur = globalAudio.currentTime;
      const dur =
        Number.isFinite(globalAudio.duration) && globalAudio.duration > 0
          ? globalAudio.duration
          : 0;

      // Coarse 1-second quantization (same rationale as
      // applyNativeStateToStore): subscribers render whole seconds, so
      // sub-second store writes are pure re-render waste.
      const prev = boundStore?.getState();
      if (!prev) return;
      const patch: { currentTime?: number; duration?: number } = {};
      const quantizedCur = Math.floor(cur);
      if (Math.floor(prev.currentTime) !== quantizedCur) {
        patch.currentTime = quantizedCur;
      }
      if (Math.abs(prev.duration - dur) > 0.5) {
        patch.duration = dur;
      }
      if (patch.currentTime !== undefined || patch.duration !== undefined) {
        boundStore?.setState(patch);
      }

      const s = state();
      if (!s) return;
      syncMediaSession({
        track: s.currentTrack,
        isPlaying: s.isPlaying,
        currentTime: cur,
        duration: dur,
        playbackRate: s.playbackRate,
      });

      // Redundant end detection: if the element sits at the tail of a known
      // duration without ever firing `ended` (gapless/corrupt tail), advance
      // through the same single-fire guard.
      if (
        !globalAudio.paused &&
        !globalAudio.ended &&
        dur > 0 &&
        cur >= dur - END_WATCHDOG_EPSILON_SECS
      ) {
        requestGuardedAutoAdvance();
      }
    });

    globalAudio.addEventListener("ended", () => {
      requestGuardedAutoAdvance();
    });

    globalAudio.addEventListener("pause", () => {
      boundStore?.setState({ isPlaying: false });
      const s = state();
      if (!s) return;
      syncMediaSession({
        track: s.currentTrack,
        isPlaying: false,
        currentTime: s.currentTime,
        duration: s.duration,
        playbackRate: s.playbackRate,
      });
    });

    globalAudio.addEventListener("play", () => {
      // A real start (re)arms the auto-advance guard for this track.
      armedAdvanceGeneration = advanceGuard.arm();
      // Self-healing: a track that starts fine is playable again — drop any
      // session skip-mark so a transient failure never bans it permanently.
      try {
        const cur = boundStore?.getState().currentTrack;
        if (cur) clearUnplayable(trackKey(cur));
      } catch { /* best-effort: ignore */ }
      boundStore?.setState({ isPlaying: true });
      const s = state();
      if (!s) return;
      syncMediaSession({
        track: s.currentTrack,
        isPlaying: true,
        currentTime: s.currentTime,
        duration: s.duration,
        playbackRate: s.playbackRate,
      });
    });

    globalAudio.addEventListener("error", (e) => {
      console.warn("Audio playback error:", e);
      // Skip, don't stick: a dead file advances the queue instead of
      // freezing the player on a silent "playing" row.
      const failed = state()?.currentTrack ?? null;
      if (failed) {
        void state()?.handleTrackStartFailure(failed);
        return;
      }
      boundStore?.setState({ isPlaying: false });
      const s = state();
      if (!s) return;
      syncMediaSession({
        track: s.currentTrack,
        isPlaying: false,
        currentTime: s.currentTime,
        duration: s.duration,
        playbackRate: s.playbackRate,
      });
    });
  }
  return globalAudio;
}

// ---------------------------------------------------------------------------
// Android Native Jetpack Media3 State Push + Poll Fallback
// ---------------------------------------------------------------------------

type NativePlayerState = Record<string, unknown>;

// Seek settle window: right after a user-initiated seek, ExoPlayer reports
// the pre-seek (or 0 while buffering) position until the seek lands. Adopting
// those stale snapshots clobbers the optimistic seekbar position — the
// visible "jumps to 0 then snaps back" bug. Ignore lagging native positions
// briefly after a seek; adopt once native catches up or the window expires.
const SEEK_SETTLE_MS = 1500;
let lastUserSeekAt = 0;
let lastUserSeekTargetSecs = 0;

/** Records a user-initiated seek so stale native snapshots are ignored briefly. */
export function noteUserSeek(timeSecs: number): void {
  if (Number.isFinite(timeSecs)) {
    lastUserSeekAt = Date.now();
    lastUserSeekTargetSecs = Math.max(0, timeSecs);
    anchorSmoothTime(lastUserSeekTargetSecs);
  }
}

// Smooth local time progression: native polls arrive only every ~2s, which
// made the seekbar jump 2-4-6. Between polls the ticker advances currentTime
// locally from the last anchored native position; each poll re-anchors, so
// drift can never exceed the 0.3s adoption threshold (invisible).
let smoothAnchorSecs = 0;
let smoothAnchorAt = 0;
let smoothTimer: ReturnType<typeof setInterval> | null = null;

function anchorSmoothTime(secs: number): void {
  smoothAnchorSecs = Math.max(0, secs);
  smoothAnchorAt = Date.now();
}

export function startSmoothTime(): void {
  if (smoothTimer || typeof window === "undefined") return;
  smoothTimer = setInterval(() => {
    try {
      if (!boundStore) return;
      const s = boundStore.getState();
      if (!s.isPlaying) return;
      const t = smoothAnchorSecs + (Date.now() - smoothAnchorAt) / 1000;
      const capped = s.duration > 0 ? Math.min(t, s.duration) : t;
      // Whole-second store writes only (seekbar renders MM:SS).
      const quantized = Math.floor(capped);
      if (Math.floor(s.currentTime) !== quantized) {
        boundStore.setState({ currentTime: quantized });
      }
    } catch { /* best-effort: ignore */ }
  }, 250);
}

export function stopSmoothTime(): void {
  if (smoothTimer) {
    try {
      clearInterval(smoothTimer);
    } catch { /* best-effort: ignore */ }
    smoothTimer = null;
  }
}

export function applyNativeStateToStore(state: NativePlayerState): void {
  if (!boundStore) return;
  const isPlaying = Boolean(state.isPlaying);
  const currentTimeMs = typeof state.currentTimeMs === "number" ? state.currentTimeMs : 0;
  const durationMs = typeof state.durationMs === "number" ? state.durationMs : 0;

  const curSecs = currentTimeMs / 1000;
  const durSecs = durationMs / 1000;

  const currentStoreState = boundStore.getState();
  const patch: Partial<ReturnType<MusicStore["getState"]>> = {};

  if (currentStoreState.isPlaying !== isPlaying) {
    patch.isPlaying = isPlaying;
  }
  const seekSettled =
    Date.now() - lastUserSeekAt >= SEEK_SETTLE_MS ||
    curSecs >= lastUserSeekTargetSecs - 0.3;
  // Coarse 1-second quantization: the MiniPlayer/NowPlaying seekbar displays
  // whole seconds, so sub-second deltas would only re-render subscribers
  // without ever changing a visible pixel.
  const quantizedSecs = Math.floor(curSecs);
  if (
    seekSettled &&
    Math.floor(currentStoreState.currentTime) !== quantizedSecs
  ) {
    patch.currentTime = quantizedSecs;
  }
  // Re-anchor the smooth ticker on every settled snapshot so local
  // progression never drifts; while a seek is landing the anchor keeps
  // holding the seek target (set by noteUserSeek).
  if (seekSettled) {
    anchorSmoothTime(patch.currentTime ?? currentStoreState.currentTime);
  }
  if (durSecs > 0 && Math.abs(currentStoreState.duration - durSecs) > 0.5) {
    patch.duration = durSecs;
  }

  // Rhythm pattern: single source of truth lives in the native player.
  // ExoPlayer auto-advances its own queue (track end, notification
  // next/prev, Bluetooth, lock screen), so the UI must adopt the native
  // currentTrack — otherwise the notification shows track B while the UI
  // still shows track A. Match by stable id/uri against the known lists.
  try {
    const rawTrack = state.currentTrack as unknown;
    let nativeTrack: AudioTrackInfo | null = null;
    if (rawTrack && typeof rawTrack === "object") {
      nativeTrack = rawTrack as AudioTrackInfo;
    } else if (typeof rawTrack === "string" && rawTrack.length > 2) {
      try {
        nativeTrack = JSON.parse(rawTrack) as AudioTrackInfo;
      } catch { /* best-effort: ignore */ }
    }
    if (nativeTrack && (nativeTrack.id || nativeTrack.uri)) {
      const nt: AudioTrackInfo = nativeTrack;
      const cur = currentStoreState.currentTrack;
      const same =
        cur != null &&
        ((nt.id && cur.id === nt.id) ||
          (nt.uri && cur.uri === nt.uri));
      if (cur == null && !isPlaying) {
        // Player was closed by user; do not resurrect track from idle state
      } else if (!same) {
        const pool =
          currentStoreState.currentPlaylist.length > 0
            ? currentStoreState.currentPlaylist
            : currentStoreState.tracks;
        const matched =
          pool.find(
            (t) =>
              (nt.id && t.id === nt.id) ||
              (nt.uri && t.uri === nt.uri),
          ) ?? null;
        // Prefer the full library object (artwork/duration) when known;
        // fall back to the native payload so the UI never shows stale.
        const adopted: AudioTrackInfo = matched ?? {
          ...(cur ?? ({} as AudioTrackInfo)),
          ...nt,
          durationSecs: (nt.durationSecs ?? durSecs) || durSecs,
        };
        patch.currentTrack = adopted as AudioTrackInfo;
        patch.playingKey = playbackIdentityKey(adopted);
        patch.currentTime = 0;
        if (durSecs > 0) patch.duration = durSecs;
        else if (matched?.durationSecs) patch.duration = matched.durationSecs;
      }
    }
  } catch { /* best-effort: ignore */ }

  // Keep repeat/shuffle/rate consistent when changed from system UI
  // (notification, lock screen, Bluetooth) instead of our buttons.
  try {
    const rm = state.repeatMode as unknown;
    if ((rm === "off" || rm === "one" || rm === "all") && currentStoreState.repeatMode !== rm) {
      patch.repeatMode = rm;
    }
    if (typeof state.shuffleMode === "boolean" && currentStoreState.shuffleMode !== state.shuffleMode) {
      patch.shuffleMode = state.shuffleMode as boolean;
    }
    const rate = state.playbackRate as unknown;
    if (typeof rate === "number" && Number.isFinite(rate) && Math.abs(currentStoreState.playbackRate - rate) > 0.01) {
      patch.playbackRate = Math.max(0.25, Math.min(4.0, rate));
    }
  } catch { /* best-effort: ignore */ }

  // Surface native decoder/source failures instead of a silent freeze.
  // Cleared natively on transition/fresh play (see PlaybackService).
  try {
    const errCode = state.errorCode as unknown;
    if (typeof errCode === "string" && errCode.length > 0) {
      const errMsg = typeof state.errorMessage === "string" ? (state.errorMessage as string) : "";
      console.warn(`Android player error ${errCode}: ${errMsg}`);
    }
  } catch { /* best-effort: ignore */ }

  if (Object.keys(patch).length > 0) {
    boundStore.setState(patch);
  }
}

let androidPushSubscribed = false;

function ensureAndroidPushSubscribed(): void {
  if (androidPushSubscribed || typeof window === "undefined") return;
  androidPushSubscribed = true;
  // Pushed by PlaybackService.broadcastStateUpdate via
  // MainActivity.dispatchPlayerState (CustomEvent, same transport as
  // ac:open-files). Shares the parser with the poll fallback below.
  window.addEventListener("ac:player-state", (e: Event) => {
    try {
      const detail = (e as CustomEvent).detail as NativePlayerState | undefined;
      if (detail && typeof detail === "object") applyNativeStateToStore(detail);
    } catch (err) {
      console.warn("Android push-state apply failed:", err);
    }
  });
}

function startAndroidStateSync(): void {
  ensureAndroidPushSubscribed();
  startSmoothTime();
  if (androidPollTimer) return;
  const syncOnce = async () => {
    if (!boundStore) return;
    try {
      const state = await api.androidPlayerGetState();
      if (!state || Object.keys(state).length === 0) return;
      applyNativeStateToStore(state);
    } catch (e) {
      console.warn("Android player state sync error:", e);
    }
  };
  // Push is primary (instant on isPlaying/transition/seek); poll is a safety
  // net for missed pushes and cold-start races. 2000ms is enough — Rhythm
  // pushes at 100ms from the service side, we push on every native callback.
  void syncOnce();
  androidPollTimer = setInterval(() => {
    void syncOnce();
  }, 2000);
  // WebView timers are throttled in background; resync immediately when the
  // UI returns so the seekbar never shows a stale position.
  try {
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncOnce();
    };
    document.removeEventListener("visibilitychange", onVisible);
    document.addEventListener("visibilitychange", onVisible);
  } catch { /* best-effort: ignore */ }
}

function stopAndroidStateSync(): void {
  stopSmoothTime();
  if (androidPollTimer) {
    clearInterval(androidPollTimer);
    androidPollTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Unified Cross-Platform Playback Operations
// ---------------------------------------------------------------------------

export async function unifiedPlayTrack(
  track: AudioTrackInfo,
  playlist?: AudioTrackInfo[],
  startIndex = 0,
): Promise<void> {
  if (isAndroid()) {
    // Android is native-only (Rhythm: service player is the single engine).
    // Never fall back to WebAudio here: a WebView element would become a
    // second competing player (seekbar fights, background death) and it
    // cannot play content:// URIs without staging anyway.
    const result = await api.androidPlayerPlay(
      JSON.stringify(track),
      playlist ? JSON.stringify(playlist) : undefined,
      startIndex,
    );
    // PENDING = cold-start queued in PlaybackService.onCreate drain;
    // SERVICE_NOT_READY = transient race. Push+poll adopts the native state
    // once the service is alive.
    if (result === "SERVICE_NOT_READY") {
      console.warn("Android player not ready, will adopt native state via sync");
    }
    startAndroidStateSync();
    return;
  }

  await playViaWebAudio(track);
}

async function playViaWebAudio(track: AudioTrackInfo): Promise<void> {
  const audio = getGlobalAudio();
  if (!audio) return;

  // Build the gain graph BEFORE assigning src so the element never flips
  // from direct output to WebAudio mid-stream (which mutes on Windows).
  ensureAudioGraph();
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    try {
      await globalAudioContext.resume();
    } catch { /* best-effort: ignore */ }
  }

  try {
    audio.pause();
  } catch { /* best-effort: ignore */ }
  try {
    audio.currentTime = 0;
  } catch { /* best-effort: ignore */ }
  // Re-apply the stored boost + speed on every fresh src.
  try {
    const s = boundStore?.getState();
    if (s) {
      applyGainPercent(s.volumeGainPercent);
      if (Number.isFinite(s.playbackRate)) audio.playbackRate = s.playbackRate;
    } else {
      audio.volume = 1;
    }
  } catch { /* best-effort: ignore */ }

  try {
    const src = await resolveAudioSource(track);
    const latest = boundStore?.getState().currentTrack;
    if (!latest || (latest.id !== track.id && latest.uri !== track.uri)) {
      return;
    }
    audio.src = src;
    audio.load();
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        console.warn("WebAudio play error:", err);
        void boundStore?.getState().handleTrackStartFailure(track);
      });
    }
  } catch (err) {
    console.warn("Failed to play track via WebAudio:", err);
    void boundStore?.getState().handleTrackStartFailure(track);
  }
}

export async function unifiedPause(): Promise<void> {
  if (isAndroid()) {
    // Android: native ExoPlayer is the ONLY engine. Touching the WebView
    // HTMLAudioElement here creates a second "player" whose timeupdate/pause
    // listeners overwrite the store with zeros (seekbar desync) and whose
    // lifecycle dies with the WebView (fake "5-second stop" reports).
    try {
      await api.androidPlayerPause();
    } catch (err) {
      console.warn("Android native pause failed:", err);
    }
    return;
  }
  const audio = getGlobalAudio();
  if (audio) {
    try {
      audio.pause();
    } catch { /* best-effort: ignore */ }
  }
}

export async function unifiedResume(): Promise<void> {
  if (isAndroid()) {
    // Native-only; no WebAudio fallback (see unifiedPlayTrack). getGlobalAudio
    // returns null on Android so the desktop path below is a safe no-op, but
    // return explicitly to avoid even touching AudioContext in background.
    try {
      await api.androidPlayerResume();
      startAndroidStateSync();
    } catch (err) {
      console.warn("Android native resume failed:", err);
    }
    return;
  }
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    try {
      await globalAudioContext.resume();
    } catch { /* best-effort: ignore */ }
  }
  const audio = getGlobalAudio();
  if (audio && audio.src) {
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => console.warn("WebAudio resume error:", err));
      }
    } catch { /* best-effort: ignore */ }
  }
}

export async function unifiedSeekTo(timeSecs: number): Promise<void> {
  if (isAndroid()) {
    // Arm the settle guard BEFORE the async bridge so a racing poll/push
    // can't clobber the optimistic position with a pre-seek snapshot.
    noteUserSeek(timeSecs);
    try {
      await api.androidPlayerSeekTo(timeSecs * 1000);
    } catch (err) {
      console.warn("Android native seek failed:", err);
    }
    // Do NOT mirror into HTMLAudioElement on Android (see unifiedPause).
    // Optimistically nudge the store so the seekbar tracks instantly; the
    // next native poll corrects any rounding.
    try {
      if (Number.isFinite(timeSecs) && boundStore) {
        boundStore.setState({ currentTime: Math.max(0, timeSecs) });
      }
    } catch { /* best-effort: ignore */ }
    return;
  }
  const audio = getGlobalAudio();
  if (audio && Number.isFinite(timeSecs)) {
    audio.currentTime = timeSecs;
  }
}

export async function unifiedNext(): Promise<void> {
  if (isAndroid()) {
    try {
      await api.androidPlayerNext();
      return;
    } catch (err) {
      console.warn("Android native next failed:", err);
    }
  }
}

export async function unifiedPrevious(): Promise<void> {
  if (isAndroid()) {
    try {
      await api.androidPlayerPrevious();
      return;
    } catch (err) {
      console.warn("Android native previous failed:", err);
    }
  }
}

export async function unifiedSetRepeatMode(mode: "off" | "one" | "all"): Promise<void> {
  if (isAndroid()) {
    try {
      await api.androidPlayerSetRepeatMode(mode);
    } catch (err) {
      console.warn("Android native setRepeatMode failed:", err);
    }
  }
}

export async function unifiedSetShuffleMode(enabled: boolean): Promise<void> {
  if (isAndroid()) {
    try {
      await api.androidPlayerSetShuffleMode(enabled);
    } catch (err) {
      console.warn("Android native setShuffleMode failed:", err);
    }
  }
}

export async function unifiedSetSpeed(speed: number): Promise<void> {
  if (isAndroid()) {
    try {
      await api.androidPlayerSetSpeed(speed);
    } catch (err) {
      console.warn("Android native setSpeed failed:", err);
    }
    return;
  }
  const audio = getGlobalAudio();
  if (audio) {
    audio.playbackRate = speed;
  }
}

/**
 * Publish an explicit stopped state to the system media session after the
 * queue is spent (or every candidate failed). The element fires no further
 * events in that state, so without this the lock screen/notification would
 * keep showing a stale "playing" row.
 */
export function publishStoppedMediaState(): void {
  const s = boundStore?.getState();
  if (!s) return;
  syncMediaSession({
    track: s.currentTrack,
    isPlaying: false,
    currentTime: 0,
    duration: s.duration,
    playbackRate: s.playbackRate,
  });
}

export async function unifiedStop(): Promise<void> {  stopAndroidStateSync();
  if (isAndroid()) {
    try {
      await api.androidPlayerStop();
    } catch (err) {
      console.warn("Android native stop failed:", err);
    }
    return;
  }
  const audio = getGlobalAudio();
  if (audio) {
    try {
      audio.pause();
      audio.src = "";
    } catch { /* best-effort: ignore */ }
  }
  // Drop the Linux blob URL so a stopped track holds no file bytes in RAM.
  try {
    revokeActiveBlobSrc();
  } catch { /* best-effort: ignore */ }
}

export async function resolveAudioSource(track: AudioTrackInfo): Promise<string> {
  const target = track.uri || track.path || "";
  if (!target) return "";

  if (target.startsWith("online-stream://")) {
    try {
      const rest = target.replace("online-stream://", "");
      const slash1 = rest.indexOf("/");
      const slash2 = rest.indexOf("/", slash1 + 1);
      if (slash1 !== -1 && slash2 !== -1) {
        const id = rest.substring(0, slash1);
        const provider = rest.substring(slash1 + 1, slash2);
        const ident = decodeURIComponent(rest.substring(slash2 + 1));
        const res = await resolveOnlineStream(id, ident, provider);
        return res.streamUrl;
      }
    } catch (e) {
      console.warn("Failed to resolve dynamic online stream URL:", e);
      return "";
    }
  }

  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("data:") ||
    target.startsWith("blob:")
  ) {
    return target;
  }

  // 1. Android content URI or device storage path
  if (
    target.startsWith("content://") ||
    target.startsWith("/storage/") ||
    target.startsWith("/sdcard/")
  ) {
    try {
      const resolved = await api.resolveMediaPaths([target]);
      if (
        resolved.length > 0 &&
        resolved[0].resolved &&
        !resolved[0].resolved.startsWith("STAGE_ERROR")
      ) {
        return convertFileSrc(resolved[0].resolved);
      }
    } catch (e) {
      console.warn("Failed to resolve Android media URI:", e);
    }
  }

  // 2. Desktop POSIX / Windows path or file:// URI
  const rawPath =
    track.path ||
    (target.startsWith("file://")
      ? decodeURIComponent(target.replace(/^file:\/\//, ""))
      : target);

  try {
    const assetUrl = convertFileSrc(rawPath);
    // Linux only: WebKitGTK cannot play media from the asset:// custom
    // scheme (WebKit bug 146351) — serve the element a blob: URL instead.
    if (isLinux()) return await toPlayableLinuxAudioSrc(assetUrl);
    return assetUrl;
  } catch {
    return rawPath;
  }
}
