import { Loader2, AlertCircle, Search } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { OnlineTrackRow } from "./OnlineTrackRow";

export function OnlineSearchResultsView(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const onlineResults = useMusicPlayerStore((s) => s.onlineResults);
  const isSearching = useMusicPlayerStore((s) => s.isSearchingOnline);
  const onlineError = useMusicPlayerStore((s) => s.onlineError);
  const onlineQuery = useMusicPlayerStore((s) => s.onlineQuery);
  const currentTrack = useMusicPlayerStore((s) => s.currentTrack);
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const isResolving = useMusicPlayerStore((s) => s.isResolvingStream);
  const activeOnlineTrack = useMusicPlayerStore((s) => s.activeOnlineTrack);
  const downloadingTrackIds = useMusicPlayerStore((s) => s.downloadingTrackIds);
  const downloadedPaths = useMusicPlayerStore((s) => s.downloadedPaths);
  const isBookmarked = useMusicPlayerStore((s) => s.isBookmarked);
  const toggleBookmark = useMusicPlayerStore((s) => s.toggleBookmark);
  const playOnlineTrack = useMusicPlayerStore((s) => s.playOnlineTrack);
  const downloadOnlineTrack = useMusicPlayerStore((s) => s.downloadOnlineTrack);
  const openInConverter = useMusicPlayerStore((s) => s.openInConverter);
  const searchOnline = useMusicPlayerStore((s) => s.searchOnline);

  if (isSearching) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[220px] gap-3 p-8 text-center">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {translate(lang, "onlineSearching")}
        </p>
      </div>
    );
  }

  if (onlineError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[220px] gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <AlertCircle className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 max-w-sm">
          {onlineError}
        </p>
        <button
          type="button"
          onClick={() => void searchOnline(onlineQuery)}
          className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
        >
          {translate(lang, "retryFile")}
        </button>
      </div>
    );
  }

  if (onlineResults.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[220px] gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-black/[0.05] dark:border-white/[0.05]">
          <Search className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          {onlineQuery ? translate(lang, "onlineNoResults") : translate(lang, "onlineSearchToggle")}
        </p>
        <p className="text-[11px] font-medium text-zinc-400 max-w-xs">
          {onlineQuery ? translate(lang, "onlineTryDifferentQuery") : translate(lang, "onlineSearchPlaceholder")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-1 overflow-y-auto flex-1">
      {onlineResults.map((track) => {
        const isCurrent =
          Boolean(currentTrack?.id && currentTrack.id === track.id) ||
          Boolean(activeOnlineTrack?.id === track.id);
        const isDownloading = Boolean(downloadingTrackIds[track.id]);
        const downloadedPath = downloadedPaths[track.id] || null;

        return (
          <OnlineTrackRow
            key={track.id}
            track={track}
            isCurrent={isCurrent}
            isPlaying={isPlaying && isCurrent}
            isResolving={isResolving && isCurrent}
            isDownloading={isDownloading}
            isBookmarked={isBookmarked(track.id)}
            downloadedPath={downloadedPath}
            onPlay={(t) => void playOnlineTrack(t, onlineResults)}
            onDownload={(t) => void downloadOnlineTrack(t)}
            onToggleBookmark={(t) => toggleBookmark(t)}
            onOpenInConverter={(p) => openInConverter(p)}
          />
        );
      })}
    </div>
  );
}