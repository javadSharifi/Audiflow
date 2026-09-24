import { convertFileSrc } from "@tauri-apps/api/core";
import { isAndroid, isLinux } from "../../utils/platform";
import {
  resolveScopedBlobAudioSrc,
  type BlobAudioHandle,
} from "../../stores/musicPlayer/linuxAssetAudio";
import * as api from "../../utils/tauri";

export function safeConvertFileSrc(filePath: string): string {
  try {
    if (
      typeof window !== "undefined" &&
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    ) {
      return convertFileSrc(filePath);
    }
  } catch {
    /* fallback */
  }
  return filePath.startsWith("file://") ? filePath : `asset://${filePath}`;
}

function isDirectPlayableProtocol(pathOrUri: string): boolean {
  return (
    pathOrUri.startsWith("http://") ||
    pathOrUri.startsWith("https://") ||
    pathOrUri.startsWith("data:") ||
    pathOrUri.startsWith("blob:")
  );
}

export function getPlayableAudioUrlSync(pathOrUri: string): string | null {
  if (!pathOrUri) return null;
  if (isDirectPlayableProtocol(pathOrUri)) {
    return pathOrUri;
  }
  if (isAndroid() && pathOrUri.startsWith("content://")) {
    return null;
  }
  if (isLinux()) {
    return null;
  }
  return safeConvertFileSrc(pathOrUri);
}

export interface PlayableAudioSourceResult {
  url: string | null;
  blobHandle: BlobAudioHandle | null;
  localPath: string;
}

/**
 * Resolves a media path or URI into a local path, playable preview URL, and optional blob handle.
 */
export async function resolvePlayableAudioSource(
  pathOrUri: string,
): Promise<PlayableAudioSourceResult> {
  let localPath = pathOrUri;

  if (isAndroid() && pathOrUri.startsWith("content://")) {
    try {
      const res = await api.resolveMediaPaths([pathOrUri]);
      const resolved = res[0]?.resolved;
      if (resolved && !resolved.startsWith("STAGE_ERROR")) {
        localPath = resolved;
      }
    } catch (e) {
      console.warn("Failed to resolve Android content URI:", e);
    }
  }

  // Raw remote or data URL
  if (isDirectPlayableProtocol(localPath)) {
    return { url: localPath, blobHandle: null, localPath };
  }

  if (isAndroid() && localPath.startsWith("content://")) {
    return { url: null, blobHandle: null, localPath };
  }

  const assetUrl = safeConvertFileSrc(localPath);

  if (isLinux() && assetUrl.startsWith("asset://")) {
    const handle = await resolveScopedBlobAudioSrc(assetUrl);
    return {
      url: handle ? handle.url : assetUrl,
      blobHandle: handle,
      localPath,
    };
  }

  return { url: assetUrl, blobHandle: null, localPath };
}
