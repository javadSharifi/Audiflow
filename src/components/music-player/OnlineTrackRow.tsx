import { Play, Pause, Download, Loader2, Music2, Heart } from "lucide-react";
import { ConvertSongIcon } from "./ConvertSongIcon";
import type { OnlineTrack } from "../../types/generated";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

export interface OnlineTrackRowProps {
  track: OnlineTrack;
  isCurrent: boolean;
  isPlaying: boolean;
  isResolving: boolean;
  isDownloading: boolean;
  isBookmarked: boolean;
  downloadedPath?: string | null;
  onPlay: (track: OnlineTrack) => void;
  onDownload: (track: OnlineTrack) => void;
  onToggleBookmark: (track: OnlineTrack) => void;
  onOpenInConverter?: (filePath: string) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function getProviderColor(provider: string): string {
  switch (provider.toLowerCase()) {
    case "youtube":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "soundcloud":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "jiosaavn":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    default:
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
}

export function OnlineTrackRow({
  track,
  isCurrent,
  isPlaying,
  isResolving,
  isDownloading,
  isBookmarked,
  downloadedPath,
  onPlay,
  onDownload,
  onToggleBookmark,
  onOpenInConverter,
}: OnlineTrackRowProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  return (
    <div
      className={`group flex items-center gap-3 p-2.5 rounded-2xl transition-all border ${
        isCurrent
          ? "bg-orange-500/10 border-orange-500/30 dark:bg-orange-500/15"
          : "bg-white/40 dark:bg-zinc-800/40 border-black/[0.04] dark:border-white/[0.04] hover:bg-white/80 dark:hover:bg-zinc-800/80"
      }`}
    >
      <div className="relative h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shadow-sm">
        {track.thumbnailUrl ? (
          <img
            src={track.thumbnailUrl}
            alt={track.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Music2 className="h-5 w-5 text-zinc-400" />
        )}

        <button
          type="button"
          onClick={() => onPlay(track)}
          disabled={isResolving && isCurrent}
          aria-label={isCurrent && isPlaying ? "Pause" : "Play"}
          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {isResolving && isCurrent ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : isCurrent && isPlaying ? (
            <Pause className="h-5 w-5 text-white fill-white" />
          ) : (
            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
          )}
        </button>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
          {track.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-[140px] sm:max-w-[200px]">
            {track.artist}
          </span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${getProviderColor(
              track.provider,
            )}`}
          >
            {track.provider}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
        <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline mr-1">
          {formatDuration(track.durationSecs)}
        </span>

        {/* Bookmark heart button */}
        <button
          type="button"
          onClick={() => onToggleBookmark(track)}
          title={translate(lang, isBookmarked ? "unlikeTrack" : "likeTrack")}
          aria-label={translate(lang, isBookmarked ? "unlikeTrack" : "likeTrack")}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-95"
        >
          <Heart className={`h-4 w-4 ${isBookmarked ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>

        {downloadedPath && onOpenInConverter ? (
          <button
            type="button"
            onClick={() => onOpenInConverter(downloadedPath)}
            title={translate(lang, "openInConverter")}
            aria-label={translate(lang, "openInConverter")}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 hover:bg-orange-500 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <ConvertSongIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDownload(track)}
            disabled={isDownloading}
            title={translate(lang, "onlineDownload")}
            aria-label={translate(lang, "onlineDownload")}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 hover:bg-orange-500 hover:text-white dark:bg-zinc-700/60 dark:text-zinc-300 dark:hover:bg-orange-500 dark:hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}