import type { StoreApi } from "zustand";
import type { AudioTrackInfo } from "../../types";
import type { MusicPlayerState } from "./types";
import * as api from "../../utils/tauri";
import { isAndroid } from "../../utils/platform";
import {
  adoptRunningNativePlayer,
  noteUserSeek,
  parseNativeTrack,
  unifiedPlayTrack,
  unifiedSeekTo,
} from "./audioEngine";
import { playbackIdentityKey } from "./trackUtils";

/**
 * Last-session restore: remember the track (and queue + position) that was
 * loaded when the app went away and put it back in the mini player on the
 * next launch — paused, nothing is started until the user presses play.
 *
 * While a restored track is waiting, the audio engine has NOTHING loaded, so
 * the first resume must do a real start (play + seek to the saved position)
 * instead of a plain engine resume. That "restored but not yet loaded" state
 * lives here, not in the store, so no slice contract changes.
 */

type MusicStore = StoreApi<MusicPlayerState>;

const SESSION_KEY = "player-last-session-v1";
const QUEUE_KEY = "player-last-queue-v1";
const MAX_SAVED_QUEUE = 3000;
/** Position writes while playing are coalesced to one per interval. */
const POSITION_WRITE_INTERVAL_MS = 5000;
/** How long to wait for a cold-starting Android service before seeking. */
const SERVICE_WAIT_ATTEMPTS = 25;
const SERVICE_WAIT_STEP_MS = 120;

interface SavedSession {
  track: AudioTrackInfo;
  positionSecs: number;
}

// ---------------------------------------------------------------------------
// Pending-restore state (restored in the UI, not yet loaded in the engine)
// ---------------------------------------------------------------------------

let pendingPositionSecs: number | null = null;

export function hasPendingRestore(): boolean {
  return pendingPositionSecs !== null;
}

export function updatePendingRestorePosition(positionSecs: number): void {
  if (pendingPositionSecs !== null && Number.isFinite(positionSecs)) {
    pendingPositionSecs = Math.max(0, positionSecs);
  }
}

/** Returns the saved position and clears the pending state (null if none). */
export function takePendingRestore(): number | null {
  const pos = pendingPositionSecs;
  pendingPositionSecs = null;
  return pos;
}

export function clearPendingRestore(): void {
  pendingPositionSecs = null;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function saveSession(track: AudioTrackInfo, positionSecs: number): void {
  try {
    if (typeof localStorage !== "undefined") {
      const payload: SavedSession = {
        track,
        positionSecs: Number.isFinite(positionSecs) ? Math.max(0, positionSecs) : 0,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    }
  } catch { /* best-effort: ignore */ }
}

function saveQueue(playlist: AudioTrackInfo[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      const ids = playlist.slice(0, MAX_SAVED_QUEUE).map((t) => t.id);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(ids));
    }
  } catch { /* best-effort: ignore */ }
}

export function loadLastSession(): SavedSession | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedSession> | null;
        const track = parsed?.track;
        if (
          track &&
          typeof track === "object" &&
          typeof track.id === "string" &&
          typeof track.uri === "string"
        ) {
          const pos = Number(parsed?.positionSecs);
          return { track, positionSecs: Number.isFinite(pos) && pos > 0 ? pos : 0 };
        }
      }
    }
  } catch { /* best-effort: ignore */ }
  return null;
}

function loadQueueIds(): string[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
      }
    }
  } catch { /* best-effort: ignore */ }
  return [];
}

/** Forget the saved session (the user explicitly closed the player). */
export function clearLastSession(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(QUEUE_KEY);
    }
  } catch { /* best-effort: ignore */ }
}

// ---------------------------------------------------------------------------
// Persistence (write side)
// ---------------------------------------------------------------------------

let persistenceStarted = false;

function startPersistence(store: MusicStore): void {
  if (persistenceStarted) return;
  persistenceStarted = true;

  let lastWriteAt = 0;
  let savedQueueRef: AudioTrackInfo[] | null = null;
  const flush = (s: MusicPlayerState) => {
    // A null track never clears storage: only an explicit close does
    // (closePlayer → clearLastSession), so a transient empty state during
    // launch can't wipe the remembered session.
    if (!s.currentTrack) return;
    saveSession(s.currentTrack, s.currentTime);
    lastWriteAt = Date.now();
  };

  store.subscribe((s, prev) => {
    if (!s.currentTrack) return;
    const trackChanged = s.currentTrack !== prev.currentTrack;
    // playTrack sets the playlist before the track, so compare against what
    // was last written rather than against the previous state.
    if (s.currentPlaylist !== savedQueueRef) {
      savedQueueRef = s.currentPlaylist;
      saveQueue(s.currentPlaylist);
    }
    if (trackChanged || s.isPlaying !== prev.isPlaying) {
      flush(s);
      return;
    }
    if (
      s.currentTime !== prev.currentTime &&
      Date.now() - lastWriteAt >= POSITION_WRITE_INTERVAL_MS
    ) {
      flush(s);
    }
  });

  // The app can be swiped away or killed right after backgrounding; write the
  // exact position as the page is hidden instead of trusting the throttle.
  try {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush(store.getState());
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => flush(store.getState()));
    }
  } catch { /* best-effort: ignore */ }
}

// ---------------------------------------------------------------------------
// Restore (read side)
// ---------------------------------------------------------------------------

function sameTrack(a: AudioTrackInfo, b: AudioTrackInfo): boolean {
  return a.id === b.id || a.uri === b.uri;
}

function buildRestoredQueue(
  track: AudioTrackInfo,
  library: AudioTrackInfo[],
): AudioTrackInfo[] {
  const ids = loadQueueIds();
  // Empty queue = "play from the library" (same convention as playTrack).
  if (ids.length === 0) return [];
  const byId = new Map(library.map((t) => [t.id, t] as const));
  const queue: AudioTrackInfo[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t) queue.push(t);
  }
  // A queue that no longer contains the track (library changed) would make
  // "next" jump somewhere unrelated — fall back to the lone track instead.
  return queue.some((t) => sameTrack(t, track)) ? queue : [track];
}

/**
 * Put the last session back in the player without playing it. When Android's
 * playback service survived the app being closed and is still playing, adopt
 * that live session instead.
 */
async function restoreLastSession(store: MusicStore): Promise<void> {
  if (store.getState().currentTrack) return;
  const saved = loadLastSession();

  if (isAndroid()) {
    const adopted = await adoptRunningNativePlayer();
    if (adopted) {
      if (saved) {
        const s = store.getState();
        const queue = buildRestoredQueue(s.currentTrack ?? saved.track, s.tracks);
        if (s.currentPlaylist.length === 0 && queue.length > 1) {
          store.setState({ currentPlaylist: queue });
        }
      }
      return;
    }
  }

  if (!saved) return;
  // The user (or an open-with intent) may have started something while the
  // native state was being queried; never override a live choice.
  const state = store.getState();
  if (state.currentTrack) return;

  const track = state.tracks.find((t) => sameTrack(t, saved.track)) ?? saved.track;
  pendingPositionSecs = saved.positionSecs;
  store.setState({
    currentTrack: track,
    playingKey: playbackIdentityKey(track),
    isPlaying: false,
    currentTime: Math.floor(saved.positionSecs),
    duration: track.durationSecs || 0,
    currentPlaylist: buildRestoredQueue(track, state.tracks),
  });
}

let sessionStarted = false;

/** Start remembering the playing track and restore the previous one. */
export async function startSessionPersistence(store: MusicStore): Promise<void> {
  if (sessionStarted) return;
  sessionStarted = true;
  startPersistence(store);
  try {
    await restoreLastSession(store);
  } catch (e) {
    console.warn("Last-session restore failed:", e);
  }
}

// ---------------------------------------------------------------------------
// First play of a restored track
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Load the restored track into the (empty) engine, start it, and move to the
 * saved position.
 */
export async function startRestoredPlayback(
  track: AudioTrackInfo,
  playlist: AudioTrackInfo[],
  startIndex: number,
  positionSecs: number,
): Promise<void> {
  const seek = positionSecs > 0;
  // Hold the seekbar at the saved position until native catches up.
  if (seek && isAndroid()) noteUserSeek(positionSecs);

  await unifiedPlayTrack(track, playlist, startIndex);
  if (!seek) return;

  if (!isAndroid()) {
    await unifiedSeekTo(positionSecs);
    return;
  }
  // Cold service start queues the play request; a seek sent before the queue
  // is drained would hit an empty player. Wait until the track is visible.
  for (let i = 0; i < SERVICE_WAIT_ATTEMPTS; i++) {
    const native = await api.androidPlayerGetState();
    const nt = parseNativeTrack(native.currentTrack);
    if (nt && sameTrack(nt, track)) break;
    await sleep(SERVICE_WAIT_STEP_MS);
  }
  await unifiedSeekTo(positionSecs);
}
