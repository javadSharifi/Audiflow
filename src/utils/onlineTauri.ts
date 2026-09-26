import { commands } from "../types/generated";
import type { DownloadedMedia, OnlineTrack, StreamSource, TimedLyrics } from "../types/generated";

export async function searchOnlineTracks(query: string, provider?: string): Promise<OnlineTrack[]> {
  const res = await commands.searchOnlineTracks(query, provider ?? null);
  if (res.status === "error") {
    throw new Error(res.error);
  }
  return res.data;
}

export async function resolveOnlineStream(
  trackId: string,
  streamIdentifier: string,
  provider: string,
): Promise<StreamSource> {
  const res = await commands.resolveOnlineStream(trackId, streamIdentifier, provider);
  if (res.status === "error") {
    throw new Error(res.error);
  }
  return res.data;
}

export async function fetchOnlineLyrics(
  title: string,
  artist: string,
  durationSecs?: number,
): Promise<TimedLyrics | null> {
  const res = await commands.fetchOnlineLyrics(title, artist, durationSecs ?? null);
  if (res.status === "error") {
    throw new Error(res.error);
  }
  return res.data;
}

export async function downloadOnlineTrack(
  track: OnlineTrack,
  targetDir?: string,
): Promise<DownloadedMedia> {
  const res = await commands.downloadOnlineTrack(track, targetDir ?? null);
  if (res.status === "error") {
    throw new Error(res.error);
  }
  return res.data;
}
