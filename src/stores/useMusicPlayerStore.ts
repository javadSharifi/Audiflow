import { create } from "zustand";
import type { MusicPlayerState } from "./musicPlayer/types";
import { createPlaybackSlice } from "./musicPlayer/slices/playbackSlice";
import { createQueueSlice } from "./musicPlayer/slices/queueSlice";
import { createLibrarySlice, warmLibraryArtwork } from "./musicPlayer/slices/librarySlice";
import { createFavoritesSlice } from "./musicPlayer/slices/favoritesSlice";
import { createAlbumsSlice } from "./musicPlayer/slices/albumsSlice";
import { createSelectionSlice } from "./musicPlayer/slices/selectionSlice";
import { bindMusicStore } from "./musicPlayer/audioEngine";

export type {
  PlaybackMode,
  PlaybackSlice,
  QueueSlice,
  LibrarySlice,
  FavoritesSlice,
  AlbumsSlice,
  SelectionSlice,
  MusicPlayerState,
} from "./musicPlayer/types";

export { playbackModeOf } from "./musicPlayer/types";

export { getGlobalAudio, getGlobalGainNode } from "./musicPlayer/audioEngine";

export {
  getTrackKey,
  getTrackAliases,
  isTrackLiked,
  filterAndSortTracks,
  computeAllAlbums,
  playbackIdentityKey,
} from "./musicPlayer/trackUtils";

export const useMusicPlayerStore = create<MusicPlayerState>()((...a) => ({
  ...createPlaybackSlice(...a),
  ...createQueueSlice(...a),
  ...createLibrarySlice(...a),
  ...createFavoritesSlice(...a),
  ...createAlbumsSlice(...a),
  ...createSelectionSlice(...a),
}));

bindMusicStore(useMusicPlayerStore);

if (typeof window !== "undefined") {
  const initial = useMusicPlayerStore.getState();
  if (initial.tracks.length > 0) {
    setTimeout(() => {
      warmLibraryArtwork(initial.tracks, initial.customAlbums, initial.likedPaths);
    }, 100);
  }
}
