import React, { useState, useMemo } from "react";
import { ListMusic, Search, X } from "lucide-react";
import type { AudioTrackInfo } from "../../types";
import { TrackCover } from "./TrackCover";
import { translate, type Lang } from "../../i18n";

export interface NowPlayingDesktopQueueProps {
  activeList: AudioTrackInfo[];
  currentTrack: AudioTrackInfo | null;
  isPlaying: boolean;
  onPlayTrack: (track: AudioTrackInfo, list: AudioTrackInfo[]) => void;
  lang: Lang;
}

export function NowPlayingDesktopQueue({
  activeList,
  currentTrack,
  isPlaying,
  onPlayTrack,
  lang,
}: NowPlayingDesktopQueueProps): React.JSX.Element {
  const [desktopSearch, setDesktopSearch] = useState("");

  const desktopFilteredList = useMemo(() => {
    if (!desktopSearch.trim()) return activeList;
    const q = desktopSearch.toLowerCase();
    return activeList.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.name?.toLowerCase().includes(q) ||
        t.artist?.toLowerCase().includes(q) ||
        t.album?.toLowerCase().includes(q),
    );
  }, [activeList, desktopSearch]);

  return (
    <div className="hidden lg:flex flex-col lg:w-80 xl:w-96 shrink-0 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] p-4 min-h-0 overflow-hidden shadow-inner">
      {/* Desktop Sidebar Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <ListMusic className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "queueDrawer")}
            </h2>
            <span className="text-[10px] text-zinc-400 font-semibold">
              {activeList.length} {lang === "fa" ? "آهنگ" : "songs"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Search in Queue */}
      <div className="relative my-2.5 shrink-0">
        <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={desktopSearch}
          onChange={(e) => setDesktopSearch(e.target.value)}
          placeholder={translate(lang, "searchSongsPlaceholder")}
          className="w-full h-8 pl-8 pr-7 rtl:pl-7 rtl:pr-8 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/5 text-[11px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-orange-500/30"
        />
        {desktopSearch && (
          <button
            type="button"
            onClick={() => setDesktopSearch("")}
            className="absolute right-2 rtl:right-auto rtl:left-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Desktop Queue Tracks List */}
      <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03] dark:divide-white/[0.03] pr-1 space-y-0.5 min-h-0">
        {desktopFilteredList.map((track, idx) => {
          const isCurrent =
            currentTrack &&
            (track.id === currentTrack.id || track.uri === currentTrack.uri);
          return (
            <div
              key={track.id || track.uri || idx}
              onClick={() => void onPlayTrack(track, activeList)}
              className={`group flex items-center justify-between p-2 rounded-2xl transition-all cursor-pointer select-none ${
                isCurrent
                  ? "bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400"
                  : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <TrackCover track={track} size="sm" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className={`text-xs font-bold truncate ${
                      isCurrent
                        ? "text-orange-600 dark:text-orange-400"
                        : "group-hover:text-orange-600 dark:group-hover:text-orange-400"
                    }`}
                  >
                    {track.title || track.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                    {track.artist || "Unknown Artist"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isCurrent && isPlaying ? (
                  <div className="flex items-end gap-0.5 h-3 px-1">
                    <span className="w-1 bg-orange-500 rounded-full animate-music-bar-1" />
                    <span className="w-1 bg-orange-500 rounded-full animate-music-bar-2" />
                    <span className="w-1 bg-orange-500 rounded-full animate-music-bar-3" />
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-400">
                    {Math.floor((track.durationSecs || 0) / 60)}:
                    {String(Math.floor((track.durationSecs || 0) % 60)).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
