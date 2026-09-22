/**
 * Linux desktop audio source workaround.
 *
 * WebKitGTK's GStreamer media backend cannot load <audio>/<video> from custom
 * URI schemes such as Tauri's `asset://` (upstream WebKit bug 146351 — still
 * present in the 2.52 series). The element stalls at readyState 0: no `play`,
 * no `error`, duration stays 0:00. Images are unaffected (different loader).
 *
 * `fetch()` CAN read the same custom scheme, and the media backend accepts
 * `blob:` URLs — so on Linux we fetch the asset bytes once and hand the
 * element a blob URL. Fully offline/local (same-origin custom scheme, no
 * network). Only one blob URL is live at a time: resolving the next track
 * (or stopping) revokes the previous one.
 */

type FetchImpl = (input: string) => Promise<Response>;
type CreateUrl = (blob: Blob) => string;
type RevokeUrl = (url: string) => void;

let activeBlobUrl: string | null = null;

const defaultFetch: FetchImpl = (input) => fetch(input);
const defaultCreateUrl: CreateUrl = (blob) => URL.createObjectURL(blob);
const defaultRevokeUrl: RevokeUrl = (url) => URL.revokeObjectURL(url);

/**
 * Convert an `asset://` audio URL into a playable `blob:` URL.
 * Falls back to the original URL on any failure so the error/skip path
 * downstream behaves exactly as before.
 */
export async function toPlayableLinuxAudioSrc(
  assetUrl: string,
  fetchImpl: FetchImpl = defaultFetch,
  createUrl: CreateUrl = defaultCreateUrl,
  revokeUrl: RevokeUrl = defaultRevokeUrl,
): Promise<string> {
  revokeActiveBlobSrc(revokeUrl);
  try {
    const res = await fetchImpl(assetUrl);
    if (!res.ok) return assetUrl;
    const blob = await res.blob();
    const url = createUrl(blob);
    activeBlobUrl = url;
    return url;
  } catch {
    return assetUrl;
  }
}

/** Revoke the live blob URL, if any (call on stop / track change). */
export function revokeActiveBlobSrc(revokeUrl: RevokeUrl = defaultRevokeUrl): void {
  if (!activeBlobUrl) return;
  try {
    revokeUrl(activeBlobUrl);
  } catch {
    /* best-effort: ignore */
  }
  activeBlobUrl = null;
}

/**
 * Independently-owned blob URL for preview/audition elements (trim editor,
 * booster A/B, ringtone). Unlike `toPlayableLinuxAudioSrc` this never touches
 * the main player's singleton slot, so resolving a preview cannot revoke a
 * background track that is still playing. Returns null on any failure so the
 * caller can fall back to the asset URL. The caller owns the handle and must
 * call `revoke()` on change/unmount.
 */
export interface BlobAudioHandle {
  url: string;
  revoke: () => void;
}

export async function resolveScopedBlobAudioSrc(
  assetUrl: string,
  fetchImpl: FetchImpl = defaultFetch,
  createUrl: CreateUrl = defaultCreateUrl,
  revokeUrl: RevokeUrl = defaultRevokeUrl,
): Promise<BlobAudioHandle | null> {
  try {
    const res = await fetchImpl(assetUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = createUrl(blob);
    let revoked = false;
    return {
      url,
      revoke: () => {
        if (revoked) return;
        revoked = true;
        try {
          revokeUrl(url);
        } catch {
          /* best-effort: ignore */
        }
      },
    };
  } catch {
    return null;
  }
}

/** Test-only hook to reset module state. */
export function __resetLinuxAssetAudioForTests(): void {
  activeBlobUrl = null;
}
