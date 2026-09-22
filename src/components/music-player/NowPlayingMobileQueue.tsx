import React from "react";
import { ListMusic, X } from "lucide-react";
import type { AudioTrackInfo } from "../../types";
import { TrackCover } from "./TrackCover";
import { translate, type Lang } from "../../i18n";

export interface NowPlayingMobileQueueProps {
  isOpen: boolean;
  onClose: () => void;
  activeList: AudioTrackInfo[];
  currentTrack: AudioTrackInfo | null;
  isPlaying: boolean;
  onPlayTrack: (track: AudioTrackInfo, list: AudioTrackInfo[]) => void;
  lang: Lang;
}

export function NowPlayingMobileQueue({
  isOpen,
  onClose,
  activeList,
  currentTrack,
  isPlaying,
  onPlayTrack,
  lang,
}: NowPlayingMobileQueueProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 lg:hidden">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 shadow-2xl p-4 flex flex-col gap-2.5 max-h-[65%] overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ListMusic className="h-4 w-4 text-orange-500" />
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "queueDrawer")} ({activeList.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Track List */}
        <div className="flex flex-col gap-1 overflow-y-auto pr-1">
          {activeList.map((track, idx) => {
            const isCurrent =
              currentTrack &&
              (track.id === currentTrack.id || track.uri === currentTrack.uri);
            return (
              <button
                key={track.id || track.uri || idx}
                type="button"
                onClick={() => {
                  onPlayTrack(track, activeList);
                  onClose();
                }}
                className={`flex items-center justify-between p-2.5 rounded-2xl text-start transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400"
                    : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <TrackCover track={track} size="sm" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold truncate">
                      {track.title || track.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate">
                      {track.artist || "-"}
                    </span>
                  </div>
                </div>

                {isCurrent && isPlaying && (
                  <div className="flex items-end gap-0.5 h-3 px-1">
                    <span className="w-1 bg-orange-500 rounded-full animate-music-bar-1" />
                    <span className="w-1 bg-orange-500 rounded-full animate-music-bar-2" />
                    <span className="w-1 bg-orange-500 rounded-full animate-music-bar-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
