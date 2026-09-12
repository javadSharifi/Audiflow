// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  unifiedPlayTrack,
  unifiedPause,
  unifiedResume,
  unifiedSeekTo,
  unifiedSetRepeatMode,
  unifiedSetShuffleMode,
  unifiedSetSpeed,
  unifiedStop,
  resolveAudioSource,
  applyGainPercent,
  boosterDbForPercent,
  bindMusicStore,
  noteUserSeek,
  applyNativeStateToStore,
  startSmoothTime,
  stopSmoothTime,
} from "../audioEngine";
import { useMusicPlayerStore } from "../../useMusicPlayerStore";
import * as api from "../../../utils/tauri";
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
  androidPlayerStop: vi.fn(async () => "OK"),
  androidPlayerGetState: vi.fn(async () => ({
    isPlaying: true,
    currentTimeMs: 15000,
    durationMs: 180000,
  })),
  resolveMediaPaths: vi.fn(async (paths: string[]) =>
    paths.map((p) => ({ input: p, resolved: "/cache/staged.mp3", error: null }))
  ),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

const mockTrack: AudioTrackInfo = {
  id: "test_1",
  uri: "content://media/external/audio/media/1234",
  path: "/storage/emulated/0/Music/test.mp3",
  name: "test.mp3",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  durationSecs: 180,
  sizeBytes: 5000000,
  createdTimestampMs: 1000,
  modifiedTimestampMs: 1000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

describe("Unified Audio Engine (Cross-Platform & Media3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Android Native Media3 Execution", () => {
    beforeEach(() => {
      vi.spyOn(platform, "isAndroid").mockReturnValue(true);
    });

    it("dispatches androidPlayerPlay when on Android", async () => {
      await unifiedPlayTrack(mockTrack, [mockTrack], 0);

      expect(api.androidPlayerPlay).toHaveBeenCalledTimes(1);
      expect(api.androidPlayerPlay).toHaveBeenCalledWith(
        JSON.stringify(mockTrack),
        JSON.stringify([mockTrack]),
        0,
      );
    });

    it("dispatches androidPlayerPause on pause", async () => {
      await unifiedPause();
      expect(api.androidPlayerPause).toHaveBeenCalledTimes(1);
    });

    it("dispatches androidPlayerResume on resume", async () => {
      await unifiedResume();
      expect(api.androidPlayerResume).toHaveBeenCalledTimes(1);
    });

    it("dispatches androidPlayerSeekTo in milliseconds", async () => {
      await unifiedSeekTo(45.5);
      expect(api.androidPlayerSeekTo).toHaveBeenCalledWith(45500);
    });

    it("dispatches repeat mode, shuffle mode, speed, and stop", async () => {
      await unifiedSetRepeatMode("all");
      expect(api.androidPlayerSetRepeatMode).toHaveBeenCalledWith("all");

      await unifiedSetShuffleMode(true);
      expect(api.androidPlayerSetShuffleMode).toHaveBeenCalledWith(true);

      await unifiedSetSpeed(1.25);
      expect(api.androidPlayerSetSpeed).toHaveBeenCalledWith(1.25);

      await unifiedStop();
      expect(api.androidPlayerStop).toHaveBeenCalledTimes(1);
    });
  });

  describe("Android Sound Booster routing", () => {
    beforeEach(() => {
      vi.spyOn(platform, "isAndroid").mockReturnValue(true);
    });

    it("maps boost percent to LoudnessEnhancer dB", () => {
      expect(boosterDbForPercent(0)).toBe(0);
      expect(boosterDbForPercent(50)).toBe(0);
      expect(boosterDbForPercent(100)).toBe(0);
      expect(boosterDbForPercent(200)).toBeCloseTo(6.02, 2);
      expect(boosterDbForPercent(400)).toBeCloseTo(12.04, 2);
      expect(boosterDbForPercent(999)).toBeCloseTo(12.04, 2);
    });

    it("routes <=100% to volume and disables the enhancer", async () => {
      applyGainPercent(80);
      await Promise.resolve();

      expect(api.androidPlayerSetVolume).toHaveBeenCalledWith(0.8);
      expect(api.androidPlayerSetBoosterGain).toHaveBeenCalledWith(0);
    });

    it("routes >100% to full volume plus enhancer dB", async () => {
      applyGainPercent(200);
      await Promise.resolve();

      expect(api.androidPlayerSetVolume).toHaveBeenCalledWith(1);
      const gainDb = vi.mocked(api.androidPlayerSetBoosterGain).mock.calls[0][0];
      expect(gainDb).toBeCloseTo(6.02, 2);
    });
  });

  describe("Seek settle guard (no snap-back to stale positions)", () => {
    beforeEach(() => {
      vi.spyOn(platform, "isAndroid").mockReturnValue(true);
      // Clear any real-timer smooth interval leaked by earlier sync tests so
      // fake-timer tests below own their clock. Also reset seek-guard state
      // so each test starts outside any settle window.
      stopSmoothTime();
      noteUserSeek(0);
      bindMusicStore(useMusicPlayerStore);
      useMusicPlayerStore.setState({ currentTime: 30.31, duration: 117.2, isPlaying: true });
    });

    it("ignores a lagging native snapshot right after a user seek", () => {
      noteUserSeek(30.31);
      // Native still reports pre-seek/buffering position (0).
      applyNativeStateToStore({ isPlaying: true, currentTimeMs: 0, durationMs: 117265 });
      expect(useMusicPlayerStore.getState().currentTime).toBeCloseTo(30.31, 2);
    });

    it("adopts the native position once it catches up to the seek target", () => {
      noteUserSeek(30.31);
      applyNativeStateToStore({ isPlaying: true, currentTimeMs: 31500, durationMs: 117265 });
      expect(useMusicPlayerStore.getState().currentTime).toBeCloseTo(31.5, 2);
    });

    it("adopts lagging positions again after the settle window expires", () => {
      vi.useFakeTimers();
      try {
        noteUserSeek(30.31);
        vi.setSystemTime(Date.now() + 5000);
        applyNativeStateToStore({ isPlaying: true, currentTimeMs: 2000, durationMs: 117265 });
        expect(useMusicPlayerStore.getState().currentTime).toBeCloseTo(2, 2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("advances currentTime smoothly between native polls while playing", () => {
      // A real-timer smooth interval may leak from earlier sync tests.
      stopSmoothTime();
      vi.useFakeTimers();
      try {
        bindMusicStore(useMusicPlayerStore);
        useMusicPlayerStore.setState({ currentTime: 10, duration: 100, isPlaying: true });
        applyNativeStateToStore({ isPlaying: true, currentTimeMs: 10000, durationMs: 100000 });
        startSmoothTime();
        vi.advanceTimersByTime(1000);
        const advanced = useMusicPlayerStore.getState().currentTime;
        expect(advanced).toBeGreaterThan(10.5);
        expect(advanced).toBeLessThan(11.5);
      } finally {
        stopSmoothTime();
        vi.useRealTimers();
      }
    });

    it("freezes smooth time while paused", () => {
      stopSmoothTime();
      vi.useFakeTimers();
      try {
        bindMusicStore(useMusicPlayerStore);
        useMusicPlayerStore.setState({ currentTime: 10, duration: 100, isPlaying: false });
        applyNativeStateToStore({ isPlaying: false, currentTimeMs: 10000, durationMs: 100000 });
        startSmoothTime();
        vi.advanceTimersByTime(2000);
        expect(useMusicPlayerStore.getState().currentTime).toBeCloseTo(10, 2);
      } finally {
        stopSmoothTime();
        vi.useRealTimers();
      }
    });
  });

  describe("Audio Source Resolution", () => {
    it("resolves content URIs via Android stage bridge", async () => {
      const resolved = await resolveAudioSource(mockTrack);
      expect(resolved).toContain("staged.mp3");
    });

    it("preserves web URLs without staging", async () => {
      const httpTrack: AudioTrackInfo = { ...mockTrack, uri: "https://example.com/stream.mp3" };
      const resolved = await resolveAudioSource(httpTrack);
      expect(resolved).toBe("https://example.com/stream.mp3");
    });
  });
});
