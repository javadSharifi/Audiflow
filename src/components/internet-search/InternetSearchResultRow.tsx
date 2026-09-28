import { Music, Play, Pause, RotateCw, Download, Check, AlertCircle, XCircle } from "lucide-react";
import { useDownloaderStore } from "../../stores/useDownloaderStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { MusicSearchResult } from "../../types/downloader";

export interface InternetSearchResultRowProps {
  result: MusicSearchResult;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatSpeed(bytesPerSec?: number | null): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "";
  const mb = bytesPerSec / 1048576;
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
  const kb = bytesPerSec / 1024;
  return `${kb.toFixed(0)} KB/s`;
}

export function InternetSearchResultRow({ result }: InternetSearchResultRowProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const currentTrack = useMusicPlayerStore((s) => s.currentTrack);

  const previewTrackId = useDownloaderStore((s) => s.previewTrackId);
  const previewLoading = useDownloaderStore((s) => s.previewLoading);
  const playPreview = useDownloaderStore((s) => s.playPreview);
  const startDownload = useDownloaderStore((s) => s.startDownload);
  const cancelDownload = useDownloaderStore((s) => s.cancelDownload);
  const retryDownload = useDownloaderStore((s) => s.retryDownload);
  const downloads = useDownloaderStore((s) => s.downloads);

  const isCurrentPreview = previewTrackId === result.id;
  const isGlobalPlayingThis = isCurrentPreview && isPlaying && currentTrack?.id === `online:${result.id}`;
  const download = downloads[result.id];

  return (
    <div
      className={`group relative flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
        isCurrentPreview
          ? "border-orange-500/40 bg-orange-500/[0.07] dark:bg-orange-500/[0.12] shadow-sm"
          : "border-black/[0.05] dark:border-white/[0.05] bg-white/60 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800/70"
      }`}
    >
      {/* Artwork + Title + Artist */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-700 shadow-inner flex items-center justify-center">
          {result.thumbnailUrl ? (
            <img
              src={result.thumbnailUrl}
              alt={result.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Music className="h-5 w-5 text-zinc-400" />
          )}

          {/* Quick Play overlay button on artwork hover */}
          <button
            type="button"
            onClick={() => playPreview(result)}
            title={translate(lang, "preview")}
            aria-label={translate(lang, "preview")}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
          >
            {isCurrentPreview && previewLoading ? (
              <RotateCw className="h-5 w-5 animate-spin" />
            ) : isGlobalPlayingThis ? (
              <Pause className="h-5 w-5 fill-white" />
            ) : (
              <Play className="h-5 w-5 fill-white ml-0.5" />
            )}
          </button>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={result.title}>
            {result.title}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            <span className="truncate max-w-[140px] sm:max-w-[200px]" title={result.artist || result.uploader || ""}>
              {result.artist || result.uploader || translate(lang, "unknownArtist")}
            </span>
            <span>•</span>
            <span>{formatDuration(result.durationSecs)}</span>
            <span className="px-1.5 py-0.2 rounded-md bg-zinc-200/80 dark:bg-zinc-700/80 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              {result.source}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: Preview + Download */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Preview Button */}
        <button
          type="button"
          onClick={() => playPreview(result)}
          disabled={isCurrentPreview && previewLoading}
          title={isGlobalPlayingThis ? translate(lang, "previewPlaying") : translate(lang, "preview")}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
            isCurrentPreview
              ? "border-orange-500/40 bg-orange-500 text-white shadow-sm"
              : "border-black/[0.08] dark:border-white/[0.08] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
          }`}
        >
          {isCurrentPreview && previewLoading ? (
            <>
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">{translate(lang, "previewBuffering")}</span>
            </>
          ) : isGlobalPlayingThis ? (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">{translate(lang, "previewPlaying")}</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">{translate(lang, "preview")}</span>
            </>
          )}
        </button>

        {/* Download State Button */}
        {download?.status === "downloading" ? (
          <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium">
            <RotateCw className="h-3.5 w-3.5 animate-spin shrink-0 text-orange-500" />
            <span className="text-[11px] font-semibold">{Math.round(download.percent ?? 0)}%</span>
            {download.speedBytesPerSec ? (
              <span className="hidden md:inline text-[10px] text-zinc-400">
                ({formatSpeed(download.speedBytesPerSec)})
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => cancelDownload(result.id)}
              title={translate(lang, "cancelDownload")}
              className="ml-1 p-0.5 rounded-md hover:bg-orange-500/20 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : download?.status === "processing" ? (
          <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-medium">
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            <span>{translate(lang, "downloadProcessing")}</span>
          </div>
        ) : download?.status === "preparing" || download?.status === "queued" ? (
          <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[11px] font-medium">
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            <span>{translate(lang, "downloadPreparing")}</span>
            <button
              type="button"
              onClick={() => cancelDownload(result.id)}
              title={translate(lang, "cancelDownload")}
              className="ml-1 p-0.5 text-zinc-400 hover:text-red-500 cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : download?.status === "completed" ? (
          <div className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{translate(lang, "downloadComplete")}</span>
          </div>
        ) : download?.status === "failed" ? (
          <button
            type="button"
            onClick={() => retryDownload(result.id)}
            title={download.error || translate(lang, "downloadFailed")}
            className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all cursor-pointer"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{translate(lang, "retryDownload")}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => startDownload(result)}
            title={translate(lang, "download")}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-orange-500" />
            <span className="hidden sm:inline">{translate(lang, "download")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
