// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllUnplayable,
  clearUnplayable,
  createAdvanceGuard,
  findTrackIndex,
  isSameTrack,
  isUnplayable,
  noteUnplayable,
  resolveNextTrack,
  trackKey,
} from "../autoAdvance";
import type { AudioTrackInfo } from "../../../types";

function makeTrack(id: string, overrides: Partial<AudioTrackInfo> = {}): AudioTrackInfo {
  return {
    id,
    uri: `file:///music/${id}.mp3`,
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
    ...overrides,
  };
}

describe("autoAdvance guard + queue resolution (T004 foundational)", () => {
  beforeEach(() => {
    clearAllUnplayable();
  });

  describe("createAdvanceGuard", () => {
    it("accepts only the latest armed generation", () => {
      const guard = createAdvanceGuard();
      const first = guard.arm();
      expect(guard.isCurrent(first)).toBe(true);
      const second = guard.arm();
      expect(guard.isCurrent(second)).toBe(true);
      expect(guard.isCurrent(first)).toBe(false);
    });

    it("rejects the pre-play sentinel generation", () => {
      const guard = createAdvanceGuard();
      expect(guard.isCurrent(-1)).toBe(false);
    });
  });

  describe("track identity", () => {
    it("matches by id, uri, or path", () => {
      const a = makeTrack("a");
      expect(isSameTrack(a, makeTrack("a"))).toBe(true);
      expect(isSameTrack(a, { ...makeTrack("other"), uri: a.uri })).toBe(true);
      expect(
        isSameTrack(a, { ...makeTrack("other"), uri: "other-uri", path: a.path }),
      ).toBe(true);
      expect(isSameTrack(a, makeTrack("b"))).toBe(false);
      expect(isSameTrack(a, null)).toBe(false);
      expect(isSameTrack(null, null)).toBe(false);
    });

    it("finds index with the same aligned matching as track start", () => {
      const list = [makeTrack("a"), makeTrack("b"), makeTrack("c")];
      expect(findTrackIndex(list, makeTrack("b"))).toBe(1);
      expect(findTrackIndex(list, { ...makeTrack("x"), path: "/music/c.mp3" })).toBe(2);
      expect(findTrackIndex(list, makeTrack("missing"))).toBe(-1);
      expect(findTrackIndex(list, null)).toBe(-1);
    });

    it("builds a stable key preferring id, then uri, then path", () => {
      expect(trackKey(makeTrack("a"))).toBe("a");
      expect(trackKey({ ...makeTrack("a"), id: "" })).toBe("file:///music/a.mp3");
    });
  });

  describe("resolveNextTrack sequential", () => {
    const list = [makeTrack("a"), makeTrack("b"), makeTrack("c")];

    it("advances to the track after the current one", () => {
      const out = resolveNextTrack({
        list,
        currentTrack: list[0],
        repeatMode: "off",
        shuffleMode: false,
      });
      expect(out).toEqual({ kind: "play", track: list[1] });
    });

    it("stops explicitly at the end when repeat is off", () => {
      const out = resolveNextTrack({
        list,
        currentTrack: list[2],
        repeatMode: "off",
        shuffleMode: false,
      });
      expect(out).toEqual({ kind: "stop" });
    });

    it("wraps to the first track when repeat is all", () => {
      const out = resolveNextTrack({
        list,
        currentTrack: list[2],
        repeatMode: "all",
        shuffleMode: false,
      });
      expect(out).toEqual({ kind: "play", track: list[0] });
    });

    it("restarts the same track when repeat is one", () => {
      const out = resolveNextTrack({
        list,
        currentTrack: list[1],
        repeatMode: "one",
        shuffleMode: false,
      });
      expect(out).toEqual({ kind: "repeatOne" });
    });

    it("stops on an empty list", () => {
      const out = resolveNextTrack({
        list: [],
        currentTrack: null,
        repeatMode: "all",
        shuffleMode: false,
      });
      expect(out).toEqual({ kind: "stop" });
    });

    it("starts from the first track when current is unknown", () => {
      const out = resolveNextTrack({
        list,
        currentTrack: null,
        repeatMode: "off",
        shuffleMode: false,
      });
      expect(out).toEqual({ kind: "play", track: list[0] });
    });
  });

  describe("resolveNextTrack shuffle", () => {
    const list = [makeTrack("a"), makeTrack("b"), makeTrack("c")];

    it("picks a different track when more than one exists", () => {
      const out = resolveNextTrack({
        list,
        currentTrack: list[0],
        repeatMode: "off",
        shuffleMode: true,
        random: () => 0.99,
      });
      expect(out.kind).toBe("play");
      if (out.kind === "play") {
        expect(out.track.id).not.toBe("a");
      }
    });

    it("replays the only track in a single-song list", () => {
      const single = [makeTrack("a")];
      const out = resolveNextTrack({
        list: single,
        currentTrack: single[0],
        repeatMode: "off",
        shuffleMode: true,
      });
      expect(out).toEqual({ kind: "play", track: single[0] });
    });
  });

  describe("unplayable marks", () => {
    it("tracks, clears, and resets session marks", () => {
      expect(isUnplayable("k")).toBe(false);
      noteUnplayable("k");
      expect(isUnplayable("k")).toBe(true);
      clearUnplayable("k");
      expect(isUnplayable("k")).toBe(false);
      noteUnplayable("k");
      clearAllUnplayable();
      expect(isUnplayable("k")).toBe(false);
    });
  });
});
