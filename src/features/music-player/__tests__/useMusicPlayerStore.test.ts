import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMusicPlayerStore, canCrossfade, type Track } from "../useMusicPlayerStore";

const sampleTracks: Track[] = [
  {
    id: "track-1",
    path: "/music/song1.mp3",
    name: "song1.mp3",
    title: "Song 1",
    durationSecs: 180,
    sizeBytes: 4000000,
    format: "MP3",
  },
  {
    id: "track-2",
    path: "/music/song2.flac",
    name: "song2.flac",
    title: "Song 2",
    durationSecs: 240,
    sizeBytes: 15000000,
    format: "FLAC",
  },
  {
    id: "track-3",
    path: "/music/song3.wav",
    name: "song3.wav",
    title: "Song 3",
    durationSecs: 120,
    sizeBytes: 12000000,
    format: "WAV",
  },
];

describe("useMusicPlayerStore", () => {
  beforeEach(() => {
    useMusicPlayerStore.getState().clearPlaylist();
  });

  it("adds tracks to playlist without duplicates", () => {
    const store = useMusicPlayerStore.getState();
    store.addTracks(sampleTracks);

    expect(useMusicPlayerStore.getState().playlist).toHaveLength(3);
    expect(useMusicPlayerStore.getState().playlist[0].title).toBe("Song 1");

    // Adding duplicate by path should be ignored
    store.addTracks([sampleTracks[0]]);
    expect(useMusicPlayerStore.getState().playlist).toHaveLength(3);
  });

  it("handles remove track and updates currentTrackIndex", () => {
    const store = useMusicPlayerStore.getState();
    store.addTracks(sampleTracks);
    store.playTrack(1);

    expect(useMusicPlayerStore.getState().currentTrackIndex).toBe(1);

    // Remove track 0 -> index should decrement to 0
    store.removeTrack("track-1");
    expect(useMusicPlayerStore.getState().playlist).toHaveLength(2);
    expect(useMusicPlayerStore.getState().currentTrackIndex).toBe(0);
  });

  it("handles next, prev, and repeat mode", () => {
    const store = useMusicPlayerStore.getState();
    store.addTracks(sampleTracks);
    store.playTrack(0);

    store.nextTrack();
    expect(useMusicPlayerStore.getState().currentTrackIndex).toBe(1);

    store.nextTrack();
    expect(useMusicPlayerStore.getState().currentTrackIndex).toBe(2);

    // In repeat all, next goes to 0
    store.setRepeatMode("all");
    store.nextTrack();
    expect(useMusicPlayerStore.getState().currentTrackIndex).toBe(0);

    store.prevTrack();
    expect(useMusicPlayerStore.getState().currentTrackIndex).toBe(2);
  });

  it("toggles volume, mute, and playback rate", () => {
    const store = useMusicPlayerStore.getState();
    store.setVolume(0.5);
    expect(useMusicPlayerStore.getState().volume).toBe(0.5);
    expect(useMusicPlayerStore.getState().isMuted).toBe(false);

    store.toggleMute();
    expect(useMusicPlayerStore.getState().isMuted).toBe(true);

    store.setPlaybackRate(1.5);
    expect(useMusicPlayerStore.getState().playbackRate).toBe(1.5);
  });

  it("sleep timer pauses after the given minutes", () => {
    vi.useFakeTimers();
    const store = useMusicPlayerStore.getState();
    store.addTracks(sampleTracks);
    store.playTrack(0);
    store.setSleepTimer(15);
    expect(useMusicPlayerStore.getState().sleepEndsAt).not.toBeNull();
    vi.advanceTimersByTime(15 * 60_000);
    expect(useMusicPlayerStore.getState().isPlaying).toBe(false);
    expect(useMusicPlayerStore.getState().sleepEndsAt).toBeNull();
    vi.useRealTimers();
  });

  it("stop-after-track pauses instead of advancing, once", () => {
    const store = useMusicPlayerStore.getState();
    store.addTracks(sampleTracks);
    store.playTrack(0);
    store.setSleepAfterTrack(true);
    store.trackEnded();
    let s = useMusicPlayerStore.getState();
    expect([s.isPlaying, s.currentTrackIndex, s.sleepAfterTrack]).toEqual([false, 0, false]);
    store.playTrack(0);
    store.trackEnded();
    s = useMusicPlayerStore.getState();
    expect([s.isPlaying, s.currentTrackIndex]).toEqual([true, 1]);
  });

  it("persists skipSilence alongside other prefs", () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
    });
    const store = useMusicPlayerStore.getState();
    store.toggleSkipSilence();
    store.setVolume(0.4);
    const saved = JSON.parse(localStorage.getItem("ac:music-prefs") ?? "{}");
    expect(saved.skipSilence).toBe(true);
    expect(saved.volume).toBe(0.4);
    store.toggleSkipSilence();
    vi.unstubAllGlobals();
  });

  it("crossfades only when a different track follows", () => {
    const base = {
      crossfadeSecs: 6,
      playlist: sampleTracks,
      currentTrackIndex: 0,
      isShuffle: false,
      repeatMode: "off" as const,
      sleepAfterTrack: false,
    };
    expect(canCrossfade(base)).toBe(true);
    expect(canCrossfade({ ...base, currentTrackIndex: 2 })).toBe(false);
    expect(canCrossfade({ ...base, currentTrackIndex: 2, repeatMode: "all" })).toBe(true);
    expect(canCrossfade({ ...base, repeatMode: "one" })).toBe(false);
    expect(canCrossfade({ ...base, sleepAfterTrack: true })).toBe(false);
    expect(canCrossfade({ ...base, crossfadeSecs: 0 })).toBe(false);
    expect(canCrossfade({ ...base, playlist: sampleTracks.slice(0, 1) })).toBe(false);
  });

  it("clamps EQ gains and presets enable the EQ", () => {
    const store = useMusicPlayerStore.getState();
    store.setEqEnabled(false);
    store.setEqGain(0, 40);
    expect(useMusicPlayerStore.getState().eqGains[0]).toBe(12);
    expect(useMusicPlayerStore.getState().eqEnabled).toBe(true);
    store.setEqPreset("flat");
    expect(useMusicPlayerStore.getState().eqGains.every((g) => g === 0)).toBe(true);
  });
});
