import React, { useEffect, useRef } from "react";
import { Search, X, RotateCw } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { TrackSortDropdown } from "./TrackSortDropdown";
import { AddFolderButton } from "./AddFolderButton";
import { OnlineSearchButton } from "./OnlineSearchButton";

export function TrackListSearchBar(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const loading = useMusicPlayerStore((s) => s.loading);
  const searchQuery = useMusicPlayerStore((s) => s.searchQuery);
  const setSearchQuery = useMusicPlayerStore((s) => s.setSearchQuery);
  const sortBy = useMusicPlayerStore((s) => s.sortBy);
  const setSortBy = useMusicPlayerStore((s) => s.setSortBy);
  const scanLibrary = useMusicPlayerStore((s) => s.scanLibrary);

  const isOnlineMode = useMusicPlayerStore((s) => s.isOnlineMode);
  const onlineQuery = useMusicPlayerStore((s) => s.onlineQuery);
  const setOnlineQuery = useMusicPlayerStore((s) => s.setOnlineQuery);
  const searchOnline = useMusicPlayerStore((s) => s.searchOnline);
  const isSearchingOnline = useMusicPlayerStore((s) => s.isSearchingOnline);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnlineMode) return;
    const trimmed = onlineQuery.trim();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (trimmed.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        void searchOnline(trimmed);
      }, 500);
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [onlineQuery, isOnlineMode, searchOnline]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isOnlineMode) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      void searchOnline(onlineQuery);
    }
  };

  const handleClear = () => {
    if (isOnlineMode) {
      setOnlineQuery("");
      void searchOnline("");
    } else {
      setSearchQuery("");
    }
  };

  const currentInputValue = isOnlineMode ? onlineQuery : searchQuery;
  const placeholderText = isOnlineMode
    ? translate(lang, "onlineSearchPlaceholder")
    : translate(lang, "searchSongsPlaceholder");

  return (
    <div className="shrink-0 flex items-center gap-2 w-full">
      <div className="relative flex-1 flex items-center">
        <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={currentInputValue}
          onChange={(e) =>
            isOnlineMode
              ? setOnlineQuery(e.target.value)
              : setSearchQuery(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="w-full h-11 pl-10 pr-9 rtl:pl-9 rtl:pr-10 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-sm transition-all"
        />
        {currentInputValue && (
          <button
            type="button"
            onClick={handleClear}
            title={translate(lang, "searchClear")}
            className="absolute right-3 rtl:right-auto rtl:left-3 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <OnlineSearchButton />

      {!isOnlineMode ? (
        <>
          <TrackSortDropdown sortBy={sortBy} onSelectSort={setSortBy} />
          <AddFolderButton />
          <button
            type="button"
            onClick={() => scanLibrary()}
            disabled={loading}
            title={translate(lang, "rescanLibrary")}
            aria-label={translate(lang, "rescanLibrary")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/80 text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin text-orange-500" : ""}`} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void searchOnline(onlineQuery)}
          disabled={isSearchingOnline || !onlineQuery.trim()}
          title={translate(lang, "onlineSearchButton")}
          aria-label={translate(lang, "onlineSearchButton")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white hover:bg-orange-600 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Search className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}