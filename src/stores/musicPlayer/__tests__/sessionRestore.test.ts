// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioTrackInfo } from "../../../types";

vi.mock("../audioEngine", () => ({
  bindMusicStore: vi.fn(),
  applyGainPercent: vi.fn(),
  getGlobalGainNode: vi.fn(() => null),
  getGlobalAudio: vi.fn(() => null),
  unifiedPlayTrack: vi.fn(async () => {}),
  unifiedPause: vi.fn(),
  unifiedResume: vi.fn(),
  unifiedSeekTo: vi.fn(async () => {}),
  unifiedNext: vi.fn(async () => {}),
  unifiedPrevious: vi.fn(async () => {}),
  unifiedSetRepeatMode: vi.fn(),
  unifiedSetShuffleMode: vi.fn(),
  unifiedSetSpeed: vi.fn(),
  unifiedStop: vi.fn(),
  publishStoppedMediaState: vi.fn(),
  cancelArmedAutoAdvance: vi.fn(),
  adoptRunningNativePlayer: vi.fn(async () => false),
  noteUserSeek: vi.fn(),
  parseNativeTrack: vi.fn(() => null),
}));

vi.mock("../../../utils/platform", () => ({
  isAndroid: vi.fn(() => false),
  isLinux: vi.fn(() => false),
}));

// In-memory localStorage mock — repo convention (jsdom exposes a broken
// localStorage getter), same as addCustomFolders.test.ts.
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

vi.stubGlobal("localStorage", storageMock);

function track(id: string, title: string): AudioTrackInfo {
  return {
    id,
    uri: `file:///music/${id}.mp3`,
    path: `/music/${id}.mp3`,
    name: `${id}.mp3`,
    title,
    artist: "Artist",
    album: "Album",
    durationSecs: 200,
    sizeBytes: 1000,
    createdTimestampMs: 1,
  } as AudioTrackInfo;
}

const A = track("a", "Song A");
const B = track("b", "Song B");

async function freshStore() {
  vi.resetModules();
  const { useMusicPlayerStore } = await import("../../useMusicPlayerStore");
  const restore = await import("../sessionRestore");
  const engine = await import("../audioEngine");
  return { store: useMusicPlayerStore, restore, engine };
}

describe("last-session restore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("restores the saved track paused, without starting playback", async () => {
    localStorage.setItem(
      "player-last-session-v1",
      JSON.stringify({ track: A, positionSecs: 42.7 }),
    );
    localStorage.setItem("player-last-queue-v1", JSON.stringify(["a", "b"]));
    const { store, restore, engine } = await freshStore();
    store.setState({ tracks: [A, B] });

    await restore.startSessionPersistence(store);

    const s = store.getState();
    expect(s.currentTrack?.id).toBe("a");
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(42);
    expect(s.currentPlaylist.map((t) => t.id)).toEqual(["a", "b"]);
    expect(restore.hasPendingRestore()).toBe(true);
    expect(engine.unifiedPlayTrack).not.toHaveBeenCalled();
    expect(engine.unifiedResume).not.toHaveBeenCalled();
  });

  it("does nothing when no session was saved", async () => {
    const { store, restore } = await freshStore();
    await restore.startSessionPersistence(store);
    expect(store.getState().currentTrack).toBeNull();
    expect(restore.hasPendingRestore()).toBe(false);
  });

  it("first resume loads the track and seeks to the saved position", async () => {
    localStorage.setItem(
      "player-last-session-v1",
      JSON.stringify({ track: B, positionSecs: 30 }),
    );
    localStorage.setItem("player-last-queue-v1", JSON.stringify(["a", "b"]));
    const { store, restore, engine } = await freshStore();
    store.setState({ tracks: [A, B] });
    await restore.startSessionPersistence(store);

    store.getState().resumeTrack();
    await vi.waitFor(() => expect(engine.unifiedSeekTo).toHaveBeenCalledWith(30));

    expect(engine.unifiedPlayTrack).toHaveBeenCalledTimes(1);
    const [playedTrack, playedList, playedIndex] = vi.mocked(engine.unifiedPlayTrack).mock
      .calls[0];
    expect(playedTrack.id).toBe("b");
    expect((playedList ?? []).map((t) => t.id)).toEqual(["a", "b"]);
    expect(playedIndex).toBe(1);
    expect(engine.unifiedResume).not.toHaveBeenCalled();
    expect(store.getState().isPlaying).toBe(true);
    expect(restore.hasPendingRestore()).toBe(false);

    // Second resume is a normal engine resume.
    store.getState().pauseTrack();
    store.getState().resumeTrack();
    expect(engine.unifiedResume).toHaveBeenCalledTimes(1);
    expect(engine.unifiedPlayTrack).toHaveBeenCalledTimes(1);
  });

  it("seeking while restored only moves the saved position", async () => {
    localStorage.setItem(
      "player-last-session-v1",
      JSON.stringify({ track: A, positionSecs: 10 }),
    );
    const { store, restore, engine } = await freshStore();
    await restore.startSessionPersistence(store);

    store.getState().seekTo(90);
    expect(store.getState().currentTime).toBe(90);
    expect(engine.unifiedSeekTo).not.toHaveBeenCalled();

    store.getState().resumeTrack();
    await vi.waitFor(() => expect(engine.unifiedSeekTo).toHaveBeenCalledWith(90));
  });

  it("persists the playing track and clears it when the player is closed", async () => {
    const { store, restore } = await freshStore();
    await restore.startSessionPersistence(store);

    await store.getState().playTrack(A, [A, B]);
    const saved = JSON.parse(localStorage.getItem("player-last-session-v1") ?? "null");
    expect(saved.track.id).toBe("a");
    expect(JSON.parse(localStorage.getItem("player-last-queue-v1") ?? "[]")).toEqual(["a", "b"]);

    store.getState().closePlayer();
    expect(localStorage.getItem("player-last-session-v1")).toBeNull();
    expect(localStorage.getItem("player-last-queue-v1")).toBeNull();
  });

  it("starting another track drops the pending restore", async () => {
    localStorage.setItem(
      "player-last-session-v1",
      JSON.stringify({ track: A, positionSecs: 10 }),
    );
    const { store, restore } = await freshStore();
    await restore.startSessionPersistence(store);
    expect(restore.hasPendingRestore()).toBe(true);

    await store.getState().playTrack(B, [A, B]);
    expect(restore.hasPendingRestore()).toBe(false);
  });
});
