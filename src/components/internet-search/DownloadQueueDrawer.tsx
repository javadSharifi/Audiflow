import { X, RotateCw, AlertCircle, Check, XCircle, ArrowDownToLine } from "lucide-react";
import { useDownloaderStore } from "../../stores/useDownloaderStore";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

export function DownloadQueueDrawer(): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const isQueueOpen = useDownloaderStore((s) => s.isQueueOpen);
  const setIsQueueOpen = useDownloaderStore((s) => s.setIsQueueOpen);
  const downloads = useDownloaderStore((s) => s.downloads);
  const cancelDownload = useDownloaderStore((s) => s.cancelDownload);
  const retryDownload = useDownloaderStore((s) => s.retryDownload);

  if (!isQueueOpen) return null;

  const items = Object.values(downloads).reverse();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 p-5 shadow-2xl flex flex-col max-h-[85vh] bg-white/95 dark:bg-zinc-900/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-orange-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "downloadQueue")}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
              {items.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsQueueOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List of downloads */}
        <div className="flex-1 overflow-y-auto min-h-0 py-3 space-y-2.5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
              <ArrowDownToLine className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
              <p className="text-xs font-medium">{translate(lang, "downloadQueueEmpty")}</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 p-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.05] bg-zinc-50/50 dark:bg-zinc-800/40"
              >
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={item.title}>
                      {item.title}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {item.artist || translate(lang, "unknownArtist")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === "downloading" ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-orange-500">
                        <RotateCw className="h-3 w-3 animate-spin" />
                        <span>{Math.round(item.percent ?? 0)}%</span>
                      </span>
                    ) : item.status === "processing" ? (
                      <span className="text-[11px] text-orange-500 font-medium">
                        {translate(lang, "downloadProcessing")}
                      </span>
                    ) : item.status === "preparing" || item.status === "queued" ? (
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {translate(lang, "downloadPreparing")}
                      </span>
                    ) : item.status === "completed" ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                        <Check className="h-3.5 w-3.5" />
                        <span>{translate(lang, "downloadComplete")}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => retryDownload(item.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-500 text-[11px] font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        <AlertCircle className="h-3 w-3" />
                        <span>{translate(lang, "retryDownload")}</span>
                      </button>
                    )}

                    {(item.status === "downloading" || item.status === "preparing" || item.status === "queued") && (
                      <button
                        type="button"
                        onClick={() => cancelDownload(item.id)}
                        title={translate(lang, "cancelDownload")}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {item.status === "downloading" && (
                  <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-200 rounded-full"
                      style={{ width: `${Math.max(2, item.percent ?? 0)}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
