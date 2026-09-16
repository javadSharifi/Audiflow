// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalAudio, bindMusicStore } from "../audioEngine";
import { clearAllUnplayable } from "../autoAdvance";
import { useMusicPlayerStore } from "../../useMusicPlayerStore";
import * as platform from "../../../utils/platform";
import type { AudioTrackInfo } from "../../../types";

vi.mock("../../../utils/tauri", () => ({
  androidPlayerPlay: vi.fn(async () => "OK"),
  androidPlayerPause: vi.fn(async () => "OK"),
  androidPlayerResume: vi.fn(async () => "OK"),
  androidPlayerSeekTo: vi.fn(async () => "OK"),
  androidPlayerNext: vi.fn(async () => "OK"),
  androidPlayerPrevious: vi.fn(async () => "OK"),
  androidPlayerSetRepeatMode: vi.fn(async () => "OK"),
  androidPlayerSetShuffleMode: vi.fn(async () => "OK"),
  androidPlayerSetSpeed: vi.fn(async () => "OK"),
  androidPlayerSetVolume: vi.fn(async () => "OK"),
  androidPlayerSetBoosterGain: vi.fn(async () => "OK"),
  androidPlayerSetBoosterGainMb: vi.fn(async () => "OK"),
  androidPlayerStop: vi.fn(async () => "OK"),
  androidPlayerGetState: vi.fn(async () => ({})),
  resolveMediaPaths: vi.fn(async (paths: string[]) =>
    paths.map((p) => ({ input: p, resolved: "/cache/staged.mp3", error: null })),
  ),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

// The session skip-set is module state: reset it for every test so marks
// from one scenario never leak into the next.
beforeEach(() => {
  clearAllUnplayable();
});

function makeTrack(id: string): AudioTrackInfo {
  return {
    id,
    // data: URLs load quietly in jsdom (no resource error), so only the
    // synthetic element events under test drive the queue — no phantom
    // jsdom load-error cascade after every playTrack.
    uri: `data:audio/mpeg;base64,SUQz${id}`,
    path: `/music/${id}.mp3`,
    name: `${id}.mp3`,
    title: `Title ${id}`,
    artist: "Artist",
    album: "Album",
    durationSecs: 180,
    sizeBytes: 4000000,
    createdTimestampMs: 1000,
    modifiedTimestampMs: 1000,
    format: "mp3",
    mimeType: "audio/mpeg",
    coverUrl: null,
  };
}

const list = [makeTrack("a"), makeTrack("b"), makeTrack("c"), makeTrack("d")];

async function flush(): Promise<void> {
  await vi.waitFor(() => {
    expect(true).toBe(true);
  });
}

describe("guarded auto-advance wiring (T005 RED)", () => {
  beforeEach(() => {
    vi.spyOn(platform, "isAndroid").mockReturnValue(false);
    bindMusicStore(useMusicPlayerStore);
    useMusicPlayerStore.setState({
      tracks: list,
      currentPlaylist: list,
      currentTrack: list[0],
      isPlaying: true,
      currentTime: 0,
      duration: 180,
      repeatMode: "off",
      shuffleMode: false,
    });
    // Arm a fresh generation as a real track start would.
    getGlobalAudio()?.dispatchEvent(new Event("play"));
  });

  it("advances to the next track on a single ended event", async () => {
    getGlobalAudio()?.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => {
      expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
    });
  });

  it("fires only once when ended arrives twice for the same track end", async () => {
    const audio = getGlobalAudio();
    audio?.dispatchEvent(new Event("ended"));
    audio?.dispatchEvent(new Event("ended"));
    await flush();
    await vi.waitFor(() => {
      expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
    });
    await flush();
    // Must NOT have advanced a second time to "c".
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
  });

  it("re-arms on the next track start so the following end advances again", async () => {
    const audio = getGlobalAudio();
    audio?.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => {
      expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
    });
    // New track start re-arms the guard; its end must advance exactly once more.
    audio?.dispatchEvent(new Event("play"));
    audio?.dispatchEvent(new Event("ended"));
    audio?.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => {
      expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("c");
    });
    await flush();
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("c");
  });

  it("advances from the timeupdate watchdog when ended never fires", async () => {
    const audio = getGlobalAudio();
    if (!audio) throw new Error("no audio element");
    Object.defineProperty(audio, "duration", { value: 180, configurable: true });
    // jsdom never really plays (paused stays true); simulate the live tail.
    Object.defineProperty(audio, "paused", { value: false, configurable: true });
    audio.currentTime = 179.95;
    audio.dispatchEvent(new Event("timeupdate"));
    await vi.waitFor(() => {
      expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
    });
  });

  it("does not advance from timeupdate while mid-track", async () => {
    const audio = getGlobalAudio();
    if (!audio) throw new Error("no audio element");
    Object.defineProperty(audio, "duration", { value: 180, configurable: true });
    audio.currentTime = 42;
    audio.dispatchEvent(new Event("timeupdate"));
    await flush();
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("a");
  });
});

describe("playNextTrack queue boundaries (T010 RED)", () => {
  beforeEach(() => {
    vi.spyOn(platform, "isAndroid").mockReturnValue(false);
    bindMusicStore(useMusicPlayerStore);
  });

  function seedQueue(current: AudioTrackInfo, repeatMode: "off" | "all" | "one" = "off") {
    useMusicPlayerStore.setState({
      tracks: list,
      currentPlaylist: list,
      currentTrack: current,
      isPlaying: true,
      currentTime: 120,
      duration: 180,
      repeatMode,
      shuffleMode: false,
    });
  }

  it("stops explicitly at the end of the queue instead of freezing", async () => {
    seedQueue(list[3]);
    await useMusicPlayerStore.getState().playNextTrack(true);
    const s = useMusicPlayerStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(0);
    expect(s.currentTrack?.id).toBe("d");
  });

  it("wraps to the first track on manual next at the end (unchanged)", async () => {
    seedQueue(list[3]);
    await useMusicPlayerStore.getState().playNextTrack(false);
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("a");
  });

  it("wraps to the first track on auto-advance at the end with repeat-all", async () => {
    seedQueue(list[3], "all");
    await useMusicPlayerStore.getState().playNextTrack(true);
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("a");
  });

  it("resolves the current index by path when id/uri differ (aligned identity)", async () => {
    const aliasCurrent: AudioTrackInfo = {
      ...makeTrack("ghost"),
      uri: "file:///music/ghost.mp3",
      path: "/music/a.mp3",
    };
    seedQueue(aliasCurrent);
    await useMusicPlayerStore.getState().playNextTrack(true);
    // Must continue AFTER track "a", not restart the queue at "a".
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
  });

  it("restarts the track on auto-advance with repeat-one (unchanged)", async () => {
    seedQueue(list[1], "one");
    await useMusicPlayerStore.getState().playNextTrack(true);
    const s = useMusicPlayerStore.getState();
    expect(s.currentTrack?.id).toBe("b");
    expect(s.isPlaying).toBe(true);
  });
});

describe("unplayable-file skip (T013 RED)", () => {
  beforeEach(() => {
    vi.spyOn(platform, "isAndroid").mockReturnValue(false);
    bindMusicStore(useMusicPlayerStore);
    useMusicPlayerStore.setState({
      tracks: list,
      currentPlaylist: list,
      currentTrack: list[0],
      isPlaying: true,
      currentTime: 10,
      duration: 180,
      repeatMode: "off",
      shuffleMode: false,
    });
  });

  it("skips a failed track and keeps playing the next one with a notice", async () => {
    const { useAppStore } = await import("../../useAppStore");
    useAppStore.setState({ toasts: [] });
    await useMusicPlayerStore.getState().handleTrackStartFailure(list[0]);
    const s = useMusicPlayerStore.getState();
    expect(s.currentTrack?.id).toBe("b");
    expect(s.isPlaying).toBe(true);
    expect(
      useAppStore.getState().toasts.some((t) => t.text === "playerSkippedUnplayable"),
    ).toBe(true);
  });

  it("stops explicitly when the failed track was the last playable one", async () => {
    useMusicPlayerStore.setState({ currentTrack: list[3] });
    await useMusicPlayerStore.getState().handleTrackStartFailure(list[3]);
    const s = useMusicPlayerStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(0);
    expect(s.currentTrack?.id).toBe("d");
  });

  it("skips consecutive failures until a playable track", async () => {
    await useMusicPlayerStore.getState().handleTrackStartFailure(list[0]);
    await useMusicPlayerStore.getState().handleTrackStartFailure(list[1]);
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("c");
  });

  it("routes an element error into the same skip path", async () => {
    getGlobalAudio()?.dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
    });
    expect(useMusicPlayerStore.getState().isPlaying).toBe(true);
  });

  it("a late ended after a manual next does not advance a second time (T017 race)", async () => {
    // Simulate a live track start: without this the guard sits disarmed and
    // the test would pass vacuously.
    getGlobalAudio()?.dispatchEvent(new Event("play"));
    // User taps next right as the track ends: exactly one step total.
    await useMusicPlayerStore.getState().playNextTrack(false);
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
    getGlobalAudio()?.dispatchEvent(new Event("ended"));
    await flush();
    await flush();
    expect(useMusicPlayerStore.getState().currentTrack?.id).toBe("b");
  });
});
