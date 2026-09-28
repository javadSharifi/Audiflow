import { useEffect, useRef } from "react";
import { Search, X, Globe, RotateCw, AlertCircle, ArrowDownToLine, Music } from "lucide-react";
import { useDownloaderStore } from "../../stores/useDownloaderStore";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { isAndroid, isMobile } from "../../utils/platform";
import { InternetSearchResultRow } from "./InternetSearchResultRow";
import { DownloadQueueDrawer } from "./DownloadQueueDrawer";

export function InternetSearchView(): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const isOpen = useDownloaderStore((s) => s.isOpen);
  const setIsOpen = useDownloaderStore((s) => s.setIsOpen);
  const query = useDownloaderStore((s) => s.query);
  const setQuery = useDownloaderStore((s) => s.setQuery);
  const results = useDownloaderStore((s) => s.results);
  const searching = useDownloaderStore((s) => s.searching);
  const searchError = useDownloaderStore((s) => s.searchError);
  const hasSearched = useDownloaderStore((s) => s.hasSearched);
  const search = useDownloaderStore((s) => s.search);
  const clearSearch = useDownloaderStore((s) => s.clearSearch);
  const init = useDownloaderStore((s) => s.init);
  const setIsQueueOpen = useDownloaderStore((s) => s.setIsQueueOpen);
  const downloads = useDownloaderStore((s) => s.downloads);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void init();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, init]);

  // Escape hotkey to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (isAndroid() || isMobile() || !isOpen) return null;

  const activeDownloadsCount = Object.values(downloads).filter(
    (d) => d.status === "downloading" || d.status === "preparing" || d.status === "queued" || d.status === "processing",
  ).length;

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      void search();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel relative flex flex-col w-full max-w-3xl h-[88vh] max-h-[820px] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl bg-white/95 dark:bg-[#0c0c0e]/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 shadow-inner">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {translate(lang, "internetSearchTitle")}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {translate(lang, "internetSearchSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQueueOpen(true)}
              title={translate(lang, "downloadQueue")}
              className="relative flex items-center gap-1.5 h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
            >
              <ArrowDownToLine className="h-4 w-4 text-orange-500" />
              <span className="hidden sm:inline">{translate(lang, "downloadQueue")}</span>
              {activeDownloadsCount > 0 && (
                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold">
                  {activeDownloadsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title={translate(lang, "close")}
              aria-label={translate(lang, "close")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 px-5 py-3 shrink-0">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={translate(lang, "internetSearchPlaceholder")}
              className="w-full h-11 pl-10 pr-9 rtl:pl-9 rtl:pr-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-sm transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 rtl:right-auto rtl:left-3 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="flex h-11 items-center gap-2 px-5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0"
          >
            {searching ? <RotateCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>{translate(lang, "searchAction")}</span>
          </button>
        </form>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
          {searching ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center text-zinc-400">
              <RotateCw className="h-8 w-8 text-orange-500 animate-spin" />
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {translate(lang, "searchingWeb")}
              </p>
            </div>
          ) : searchError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-red-500/10 text-red-500 border border-red-500/20">
                <AlertCircle className="h-7 w-7" />
              </div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-sm">
                {searchError}
              </p>
              <button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer"
              >
                {translate(lang, "retryFile")}
              </button>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 px-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <span>{translate(lang, "songCount").replace("{count}", String(results.length))}</span>
              </div>
              {results.map((result) => (
                <InternetSearchResultRow key={result.id} result={result} />
              ))}
            </div>
          ) : hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-black/[0.05] dark:border-white/[0.05]">
                <Search className="h-8 w-8" />
              </div>
              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {translate(lang, "noInternetResults")}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
                {translate(lang, "noInternetResultsDesc")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                <Music className="h-8 w-8" />
              </div>
              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {translate(lang, "internetSearchPrompt")}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                {translate(lang, "internetSearchPromptDesc")}
              </p>
            </div>
          )}
        </div>
      </div>

      <DownloadQueueDrawer />
    </div>
  );
}
