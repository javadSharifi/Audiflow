import { useShallow } from "zustand/react/shallow";
import { useMusicPlayerStore } from "../useMusicPlayerStore";
import { isTrackLiked, getTrackKey } from "./trackUtils";
import type { AudioTrackInfo, CustomAlbum } from "../../types";

/** Selects only the active track object. */
export function useCurrentTrack(): AudioTrackInfo | null {
  return useMusicPlayerStore((s) => s.currentTrack);
}

/** Selects only the playback playing flag. */
export function useIsPlaying(): boolean {
  return useMusicPlayerStore((s) => s.isPlaying);
}

/** Selects only the derived cheap playing identity key. */
export function usePlaybackIdentity(): string {
  return useMusicPlayerStore((s) => s.playingKey);
}

/** Selects playback time and duration without subscribing to full player state. */
export function usePlayerTime(): { currentTime: number; duration: number } {
  return useMusicPlayerStore(
    useShallow((s) => ({
      currentTime: s.currentTime,
      duration: s.duration,
    })),
  );
}

/** Selects volume gain and its setter. */
export function useVolumeGain(): {
  volumeGainPercent: number;
  setVolumeGainPercent: (gain: number) => void;
} {
  return useMusicPlayerStore(
    useShallow((s) => ({
      volumeGainPercent: s.volumeGainPercent,
      setVolumeGainPercent: s.setVolumeGainPercent,
    })),
  );
}

/** Selects active queue and navigation actions. */
export function usePlayerQueue(): {
  currentPlaylist: AudioTrackInfo[];
  playNextTrack: (auto?: boolean) => Promise<void>;
  playPreviousTrack: () => Promise<void>;
} {
  return useMusicPlayerStore(
    useShallow((s) => ({
      currentPlaylist: s.currentPlaylist,
      playNextTrack: s.playNextTrack,
      playPreviousTrack: s.playPreviousTrack,
    })),
  );
}

/** Selects library scanning status and permission flags. */
export function useLibraryStatus(): {
  loading: boolean;
  hasScanned: boolean;
  permissionStatus: string;
} {
  return useMusicPlayerStore(
    useShallow((s) => ({
      loading: s.loading,
      hasScanned: s.hasScanned,
      permissionStatus: s.permissionStatus,
    })),
  );
}

/** Selects the full list of library tracks. */
export function useLibraryTracks(): AudioTrackInfo[] {
  return useMusicPlayerStore((s) => s.tracks);
}

/** Per-track boolean hook: re-renders ONLY when THIS track's liked status flips. */
export function useTrackLiked(track: AudioTrackInfo | null | undefined): boolean {
  return useMusicPlayerStore((s) => (track ? isTrackLiked(track, s.likedPaths) : false));
}

/** Per-track boolean hook: re-renders ONLY when THIS track's selection status flips. */
export function useTrackSelected(
  trackOrKey: AudioTrackInfo | string | null | undefined,
): boolean {
  return useMusicPlayerStore((s) => {
    if (!trackOrKey) return false;
    if (typeof trackOrKey === "string") {
      return s.selectedTrackKeys.has(trackOrKey);
    }
    const key = getTrackKey(trackOrKey);
    return (
      s.selectedTrackKeys.has(key) ||
      s.selectedTrackKeys.has(trackOrKey.id) ||
      s.selectedTrackKeys.has(trackOrKey.uri)
    );
  });
}

/** Selects custom user playlists/albums. */
export function useCustomAlbums(): CustomAlbum[] {
  return useMusicPlayerStore((s) => s.customAlbums);
}
