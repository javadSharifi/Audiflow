import { convertFileSrc } from "@tauri-apps/api/core";
import type { AudioTrackInfo } from "../types";
import { getTrackArtworkUrl } from "./tauri";

type TrackLike = Partial<AudioTrackInfo> & {
  title?: string | null;
  name?: string;
  artist?: string | null;
  coverUrl?: string | null;
};

/** In-memory cover cache: artwork key -> resolved src (or null = known missing). LRU 500. */
const memoryCache = new Map<string, string | null>();
const LRU_LIMIT = 500;
/** localStorage manifest backing the memory cache across sessions. */
const ARTWORK_MANIFEST_KEY = "player-artwork-manifest-v1";
const MANIFEST_LIMIT = 1500;
/** Dedup concurrent extractions for the same track. */
const inflight = new Map<string, Promise<string | null>>();
/** Concurrency throttling for native IPC. */
const MAX_CONCURRENCY = 4;
let activeIpc = 0;
const ipcQueue: Array<() => void> = [];

function touchCache(key: string): void {
  const v = memoryCache.get(key);
  if (v !== undefined) {
    memoryCache.delete(key);
    memoryCache.set(key, v as string | null);
  }
}

function setCacheLru(key: string, value: string | null): void {
  if (memoryCache.has(key)) memoryCache.delete(key);
  memoryCache.set(key, value);
  while (memoryCache.size > LRU_LIMIT) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
  persistManifestEntry(key, value);
}

/** In-memory manifest mirror to avoid repeated JSON.parse across resolutions. */
const manifestCache = new Map<string, string | null>();

/** Persist one resolved artwork entry so the next cold start reuses it. */
function persistManifestEntry(key: string, value: string | null): void {
  manifestCache.set(key, value);
  while (manifestCache.size > MANIFEST_LIMIT) {
    const oldest = manifestCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    manifestCache.delete(oldest);
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        ARTWORK_MANIFEST_KEY,
        JSON.stringify(Object.fromEntries(manifestCache)),
      );
    }
  } catch { /* best-effort: ignore */ }
}

/** Load the persisted manifest into the memory cache at module init. */
function hydrateFromManifest(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(ARTWORK_MANIFEST_KEY);
    if (!raw) return;
    const manifest: Record<string, string | null> = JSON.parse(raw);
    for (const [k, v] of Object.entries(manifest)) {
      manifestCache.set(k, v);
      if (!memoryCache.has(k)) setCacheLruNoPersist(k, v);
    }
  } catch { /* best-effort: ignore */ }
}

/** setCacheLru without manifest write (used during hydration). */
function setCacheLruNoPersist(key: string, value: string | null): void {
  memoryCache.set(key, value);
  while (memoryCache.size > LRU_LIMIT) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

hydrateFromManifest();

function runWithConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (activeIpc < MAX_CONCURRENCY) {
    activeIpc++;
    return fn().finally(() => {
      activeIpc--;
      const next = ipcQueue.shift();
      if (next) next();
    });
  }
  return new Promise<T>((resolve, reject) => {
    ipcQueue.push(() => {
      activeIpc++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeIpc--;
          const nxt = ipcQueue.shift();
          if (nxt) nxt();
        });
    });
  });
}

/** Stable identity for one track's artwork (matches the native cache key input). */
export function artworkCacheKey(track: TrackLike): string {
  return track.uri || track.path || track.id || "";
}

/**
 * In-memory cache key. Must include coverUrl: the same audio ref can point
 * at a new cover after a rescan — keying on the uri alone would keep serving
 * the removed cover.
 */
function memoryKey(track: TrackLike): string {
  return `${artworkCacheKey(track)}|${track.coverUrl ?? ""}`;
}

/**
 * Legacy MediaStore `content://media/external/audio/albumart/...` URIs look
 * like covers but no longer resolve on Android 10+ and can never load inside
 * a WebView `<img>` — treat them as missing so embedded art is extracted.
 */
export function isUnresolvedCoverUrl(coverUrl: string | null | undefined): boolean {
  if (!coverUrl) return true;
  return coverUrl.startsWith("content://");
}

function toLoadableSrc(coverUrl: string): string | null {
  if (
    coverUrl.startsWith("http://") ||
    coverUrl.startsWith("https://") ||
    coverUrl.startsWith("asset://") ||
    coverUrl.startsWith("data:") ||
    coverUrl.startsWith("blob:")
  ) {
    return coverUrl;
  }
  if (coverUrl.startsWith("content://")) return null;
  try {
    return convertFileSrc(coverUrl);
  } catch {
    return null;
  }
}

/**
 * Synchronous fast path: directly loadable covers (http/data/asset/local
 * file path). Returns null when the cover needs async extraction (or when
 * there is no cover at all — use `isUnresolvedCoverUrl` to tell apart).
 */
export function getSyncArtworkSrc(track: TrackLike): string | null {
  if (!track.coverUrl) return null;
  return toLoadableSrc(track.coverUrl);
}

/**
 * Returns the synchronously available artwork source:
 * 1. directly loadable coverUrl, OR
 * 2. previously resolved & cached in-memory artwork, OR
 * 3. undefined if not yet resolved.
 */
export function getCachedArtworkSrc(track: TrackLike): string | null | undefined {
  const sync = getSyncArtworkSrc(track);
  if (sync) return sync;
  if (!artworkCacheKey(track)) return null;
  const k = memoryKey(track);
  const v = memoryCache.get(k);
  if (v !== undefined) touchCache(k);
  return v;
}

function audioRefOf(track: TrackLike): string {
  return track.uri || track.path || "";
}

/**
 * Full resolution with lazy embedded-art extraction:
 * 1. directly loadable coverUrl -> that src (cached in memory),
 * 2. else extract the embedded picture via the native `get_track_artwork`
 *    command (cached natively + in memory, shared with the media notification),
 * 3. else null (UI shows its gradient placeholder).
 */
export function resolveArtworkSrc(track: TrackLike): Promise<string | null> {
  if (!artworkCacheKey(track)) return Promise.resolve(null);
  const key = memoryKey(track);

  const syncSrc = getSyncArtworkSrc(track);
  if (syncSrc) {
    setCacheLru(key, syncSrc);
    return Promise.resolve(syncSrc);
  }

  const cached = memoryCache.get(key);
  if (cached !== undefined) {
    touchCache(key);
    return Promise.resolve(cached);
  }

  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;

  const audioRef = audioRefOf(track);
  if (!audioRef) return Promise.resolve(null);

  const task = runWithConcurrency(() => getTrackArtworkUrl(audioRef))
    .then((src) => {
      setCacheLru(key, src);
      return src;
    })
    .catch(() => {
      setCacheLru(key, null);
      return null;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  return task;
}

/**
 * Drop cached covers (call after tracks are deleted). Takes audio refs
 * (uri || path || id) and removes every entry derived from them, so a later
 * track reusing the same uri never inherits the deleted track's cover.
 */
export function evictArtworkCache(audioRefs?: string[]): void {
  if (!audioRefs) {
    memoryCache.clear();
    manifestCache.clear();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(ARTWORK_MANIFEST_KEY);
      }
    } catch { /* best-effort: ignore */ }
    return;
  }
  for (const ref of audioRefs) {
    memoryCache.delete(ref);
    manifestCache.delete(ref);
    const prefix = `${ref}|`;
    for (const k of Array.from(memoryCache.keys())) {
      if (k.startsWith(prefix)) memoryCache.delete(k);
    }
    for (const k of Array.from(manifestCache.keys())) {
      if (k.startsWith(prefix)) manifestCache.delete(k);
    }
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        ARTWORK_MANIFEST_KEY,
        JSON.stringify(Object.fromEntries(manifestCache)),
      );
    }
  } catch { /* best-effort: ignore */ }
}

/** Test-only hook to reset module state. */
export function __clearArtworkCachesForTests(): void {
  memoryCache.clear();
  manifestCache.clear();
  inflight.clear();
  prefetchScheduled.clear();
  activeIpc = 0;
  ipcQueue.length = 0;
}

/** Track refs already queued for idle prefetch (dedupe across rescans). */
const prefetchScheduled = new Set<string>();

/**
 * Namida-style idle prefetch: after a scan completes, warm the artwork
 * cache for the first screenful of tracks during browser idle time so the
 * first paint already has covers instead of popping them in on demand.
 * Deduped by track ref across calls; bounded by `count`; actual IPC is
 * already throttled by the module's concurrency queue.
 */
export function scheduleArtworkPrefetch(tracks: TrackLike[], count = 50): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void) => number;
  };
  const idle =
    typeof w.requestIdleCallback === "function"
      ? (cb: () => void) => w.requestIdleCallback!(cb)
      : (cb: () => void) => window.setTimeout(cb, 0);

  let scheduled = 0;
  for (const track of tracks) {
    if (scheduled >= count) break;
    const key = memoryKey(track);
    if (!artworkCacheKey(track) || memoryCache.has(key) || prefetchScheduled.has(key)) {
      continue;
    }
    prefetchScheduled.add(key);
    scheduled++;
    idle(() => {
      void resolveArtworkSrc(track).catch(() => {});
    });
  }
}
