import React, { useEffect, useRef } from "react";
import { X, Mic2, Loader2, RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import type { TimedLyricLine } from "../../types/generated";

export interface TimedLyricsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TimedLyricsSheet({ isOpen, onClose }: TimedLyricsSheetProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const currentTrack = useMusicPlayerStore((s) => s.currentTrack);
  const currentTime = useMusicPlayerStore((s) => s.currentTime);
  const seekTo = useMusicPlayerStore((s) => s.seekTo);
  const timedLyrics = useMusicPlayerStore((s) => s.timedLyrics);
  const isLoadingLyrics = useMusicPlayerStore((s) => s.isLoadingLyrics);
  const fetchLyrics = useMusicPlayerStore((s) => s.fetchLyrics);
  const activeOnlineTrack = useMusicPlayerStore((s) => s.activeOnlineTrack);

  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const syncedLines = timedLyrics?.lines || [];
  const currentMs = currentTime * 1000;
  const activeIndex = syncedLines.reduce((acc: number, line: TimedLyricLine, idx: number) => {
    return line.timeMs <= currentMs ? idx : acc;
  }, -1);

  useEffect(() => {
    if (activeLineRef.current && isOpen) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex, isOpen]);

  const handleRetryLyrics = () => {
    if (activeOnlineTrack) {
      void fetchLyrics(activeOnlineTrack);
    } else if (currentTrack) {
      void fetchLyrics({
        id: currentTrack.id,
        title: currentTrack.title || currentTrack.name,
        artist: currentTrack.artist || "Unknown",
        album: currentTrack.album || null,
        durationSecs: currentTrack.durationSecs || 0,
        provider: "unknown",
        streamIdentifier: currentTrack.uri || "",
        thumbnailUrl: currentTrack.coverUrl || null,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timed-lyrics-title"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl h-[80vh] max-h-[700px] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-900/95 border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400">
              <Mic2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id="timed-lyrics-title" className="text-sm font-bold text-white">
                {translate(lang, "onlineLyrics")}
              </h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-[220px]">
                {currentTrack?.title || currentTrack?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRetryLyrics}
              disabled={isLoadingLyrics}
              title={translate(lang, "retryFile")}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingLyrics ? "animate-spin text-orange-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title={translate(lang, "close")}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth space-y-4 text-center">
          {isLoadingLyrics ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-xs">{translate(lang, "onlineSearching")}</p>
            </div>
          ) : syncedLines.length > 0 ? (
            syncedLines.map((line: TimedLyricLine, idx: number) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seekTo(line.timeMs / 1000)}
                  className={`py-2 px-3 rounded-2xl transition-all cursor-pointer ${
                    isActive
                      ? "text-orange-400 font-extrabold text-base sm:text-lg scale-105 bg-orange-500/10 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 text-sm font-medium hover:bg-white/5"
                  }`}
                >
                  {line.text}
                </div>
              );
            })
          ) : timedLyrics?.plainText ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 font-medium">
              {timedLyrics.plainText}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500">
              <Mic2 className="h-8 w-8 stroke-[1.5]" />
              <p className="text-xs">{translate(lang, "onlineNoLyrics")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
