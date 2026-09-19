// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  artworkCacheKey,
  resolveArtworkSrc,
  getCachedArtworkSrc,
  evictArtworkCache,
  scheduleArtworkPrefetch,
  __clearArtworkCachesForTests,
} from "../../../utils/artwork";
import {
  computeAllAlbums,
  playbackIdentityKey,
  filterAndSortTracks,
} from "../trackUtils";
import type { AudioTrackInfo } from "../../../types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
}));

const { mockGetTrackArtworkUrl } = vi.hoisted(() => ({
  mockGetTrackArtworkUrl: vi.fn(),
}));
vi.mock("../../../utils/tauri", () => ({
  getTrackArtworkUrl: mockGetTrackArtworkUrl,
}));

// In-memory localStorage mock — the repo convention (jsdom in this
// environment exposes a broken localStorage getter), same as
// bootPrefs.test.ts / HeaderBar.test.tsx.
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

function makeTrack(id: string, artist = "Artist"): AudioTrackInfo {
  return {
    id,
    uri: `file:///music/${id}.mp3`,
    path: `/music/${id}.mp3`,
    name: `${id}.mp3`,
    title: id,
    artist,
    album: null,
    durationSecs: 180,
    sizeBytes: 5_000_000,
    modifiedTimestampMs: 1_700_000_000_000,
    createdTimestampMs: 1_700_000_000_000,
    format: "mp3",
    mimeType: "audio/mpeg",
    coverUrl: null,
  } as unknown as AudioTrackInfo;
}

beforeEach(() => {
  __clearArtworkCachesForTests();
  localStorage.clear();
  mockGetTrackArtworkUrl.mockReset();
});
// ---------------------------------------------------------------------------
// 1. Artwork negative caching — extraction must not be retried
// ---------------------------------------------------------------------------

describe("artwork negative caching (no repeated extraction)", () => {
  it("caches a null (no artwork) result and never re-extracts within a session", async () => {
    const track = makeTrack("t1");
    mockGetTrackArtworkUrl.mockResolvedValue(null);

    const first = await resolveArtworkSrc(track);
    expect(first).toBeNull();
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(1);

    // Second resolution (e.g. switching tabs) must be served from cache.
    const second = await resolveArtworkSrc(track);
    expect(second).toBeNull();
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(1);
  });

  it("persists the no-artwork result to localStorage so a cold start skips extraction", async () => {
    const track = makeTrack("t2");
    mockGetTrackArtworkUrl.mockResolvedValue(null);
    await resolveArtworkSrc(track);

    const raw = localStorage.getItem("player-artwork-manifest-v1");
    expect(raw).toBeTruthy();
    const manifest = JSON.parse(raw!);
    const key = `${artworkCacheKey(track)}|`;
    expect(manifest[key]).toBeNull();
  });

  it("serves the cached cover across tab switches without re-calling native IPC", async () => {
    const track = makeTrack("t3");
    mockGetTrackArtworkUrl.mockResolvedValue("/cache/art_abc.jpg");

    await resolveArtworkSrc(track);
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(1);

    // Simulates leaving the tab and coming back.
    const src = getCachedArtworkSrc(track);
    expect(src).toContain("art_abc.jpg");
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(1);
  });

  it("evicts the persisted manifest entry when a track is deleted", async () => {
    const track = makeTrack("t4");
    mockGetTrackArtworkUrl.mockResolvedValue("/cache/art_t4.jpg");
    await resolveArtworkSrc(track);
    expect(localStorage.getItem("player-artwork-manifest-v1")).toContain("t4");

    evictArtworkCache([artworkCacheKey(track)]);
    const raw = localStorage.getItem("player-artwork-manifest-v1");
    expect(raw).not.toContain(artworkCacheKey(track));
  });
});

// ---------------------------------------------------------------------------
// 2. computeAllAlbums — O(n) instead of O(n×keys)
// ---------------------------------------------------------------------------

describe("computeAllAlbums lookup complexity", () => {
  it("resolves custom-album keys without a per-key linear scan of all tracks", () => {
    const tracks: AudioTrackInfo[] = [];
    for (let i = 0; i < 3000; i++) tracks.push(makeTrack(`song_${i}`, `artist_${i % 25}`));

    const customAlbums = [
      {
        id: "custom_1",
        name: "Mix",
        trackKeys: Array.from({ length: 500 }, (_, i) => `file:///music/song_${i * 5}.mp3`),
        createdAtMs: 0,
        updatedAtMs: 0,
      },
    ];

    const start = performance.now();
    const { custom } = computeAllAlbums(tracks, customAlbums);
    const elapsed = performance.now() - start;

    expect(custom[0].trackCount).toBe(500);
    expect(elapsed).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// 3. playingKey selector stability
// ---------------------------------------------------------------------------

describe("playbackIdentityKey", () => {
  it("is stable across rescan-equivalent track objects", () => {
    const a = makeTrack("same");
    const b = { ...makeTrack("same") };
    expect(playbackIdentityKey(a)).toBe(playbackIdentityKey(b));
  });

  it("differs between different tracks", () => {
    expect(playbackIdentityKey(makeTrack("a"))).not.toBe(
      playbackIdentityKey(makeTrack("b")),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. filterAndSortTracks — regression sanity
// ---------------------------------------------------------------------------

describe("filterAndSortTracks regression", () => {
  it("filters by title and sorts newest-first", () => {
    const t1 = { ...makeTrack("alpha"), modifiedTimestampMs: 100, createdTimestampMs: 100 };
    const t2 = { ...makeTrack("beta"), modifiedTimestampMs: 200, createdTimestampMs: 200 };
    const t3 = { ...makeTrack("alphabet"), modifiedTimestampMs: 300, createdTimestampMs: 300 };
    const out = filterAndSortTracks([t1, t2, t3], "alpha", "newest", new Set());
    expect(out.map((t) => t.title)).toEqual(["alphabet", "alpha"]);
  });
});

// ---------------------------------------------------------------------------
// 5. Idle prefetch after scan (Namida-style warm cache)
// ---------------------------------------------------------------------------

describe("scheduleArtworkPrefetch", () => {
  it("resolves covers for the first N tracks during idle time and dedupes repeats", async () => {
    const tracks = Array.from({ length: 60 }, (_, i) => makeTrack(`p_${i}`));
    mockGetTrackArtworkUrl.mockResolvedValue("/cache/art.jpg");

    scheduleArtworkPrefetch(tracks, 50);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(50);

    // Re-scheduling after a rescan prefetches only the not-yet-cached
    // remainder (p_50..p_59) — already-scheduled tracks are deduped.
    scheduleArtworkPrefetch(tracks, 50);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(60);

    // Once everything is cached/scheduled, further calls do nothing.
    scheduleArtworkPrefetch(tracks, 50);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(60);
  });

  it("skips tracks whose cover is already cached", async () => {
    const cached = makeTrack("already_cached");
    mockGetTrackArtworkUrl.mockResolvedValue("/cache/art.jpg");
    await resolveArtworkSrc(cached);
    mockGetTrackArtworkUrl.mockClear();

    const fresh = makeTrack("fresh_track");
    scheduleArtworkPrefetch([cached, fresh], 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetTrackArtworkUrl).toHaveBeenCalledTimes(1);
  });
});
