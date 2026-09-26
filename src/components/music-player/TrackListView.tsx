import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedDeferred } from "../../hooks/useDebouncedDeferred";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore, filterAndSortTracks, isTrackLiked } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { hasNotificationPermission } from "../../utils/tauri";
import { isAndroid } from "../../utils/platform";
import { TrackRow } from "./TrackRow";
import { TrackListBanners } from "./TrackListBanners";
import { MultiSelectActionBar } from "./MultiSelectActionBar";
import { useTrackVirtualizer } from "./useTrackVirtualizer";
import { TrackListSearchBar } from "./TrackListSearchBar";
import { OnlineSearchResultsView } from "./OnlineSearchResultsView";
import { RotateCw, Heart, Music2, Globe } from "lucide-react";

export interface TrackListViewProps {
  likedOnly?: boolean;
}

export function TrackListView({ likedOnly = false }: TrackListViewProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const tracks = useMusicPlayerStore((s) => s.tracks);
  const loading = useMusicPlayerStore((s) => s.loading);
  const hasScanned = useMusicPlayerStore((s) => s.hasScanned);
  const searchQuery = useMusicPlayerStore((s) => s.searchQuery);
  const sortBy = useMusicPlayerStore((s) => s.sortBy);
  const likedPaths = useMusicPlayerStore((s) => s.likedPaths);
  const permissionStatus = useMusicPlayerStore((s) => s.permissionStatus);
  const checkPermission = useMusicPlayerStore((s) => s.checkPermission);
  const scanLibrary = useMusicPlayerStore((s) => s.scanLibrary);
  const requestMediaPermission = useMusicPlayerStore((s) => s.requestMediaPermission);
  const setSearchQuery = useMusicPlayerStore((s) => s.setSearchQuery);
  const isSelectionMode = useMusicPlayerStore((s) => s.isSelectionMode);
  const isPlayerActive = useMusicPlayerStore((s) => s.playingKey !== "");
  const isOnlineMode = useMusicPlayerStore((s) => s.isOnlineMode);

  const [notifBlocked, setNotifBlocked] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("ac:notif-banner-dismissed") === "1";
    } catch {
      return false;
    }
  });

  const dismissNotifBanner = () => {
    try {
      sessionStorage.setItem("ac:notif-banner-dismissed", "1");
    } catch { /* best-effort: ignore */ }
    setNotifDismissed(true);
  };

  useEffect(() => {
    if (!isAndroid()) return;
    let cancelled = false;
    const check = () => {
      void hasNotificationPermission().then((allowed) => {
        if (!cancelled) setNotifBlocked(!allowed);
      });
    };
    check();
    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    void checkPermission();
    if (!hasScanned && !loading) {
      void scanLibrary();
    }
  }, [hasScanned, loading, scanLibrary, checkPermission]);

  useEffect(() => {
    if (!isAndroid()) return;
    let cancelled = false;
    const recover = () => {
      if (document.visibilityState === "hidden") return;
      void (async () => {
        try {
          await checkPermission();
          if (cancelled) return;
          const state = useMusicPlayerStore.getState();
          const granted =
            state.permissionStatus === "granted" ||
            state.permissionStatus === "notRequired";
          if (granted && state.tracks.length === 0 && !state.loading) {
            void scanLibrary();
          }
        } catch (err) {
          console.warn("Permission recovery check failed:", err);
        }
      })();
    };
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [checkPermission, scanLibrary]);

  const handleRequestPermission = async () => {
    try {
      await requestMediaPermission();
    } catch (err) {
      console.warn("Permission request failed:", err);
    }
  };

  const deferredSearch = useDebouncedDeferred(searchQuery, 150);

  const baseTracks = useMemo(
    () => (likedOnly ? tracks.filter((t) => isTrackLiked(t, likedPaths)) : tracks),
    [likedOnly, tracks, likedPaths],
  );
  const filteredTracks = useMemo(
    () => filterAndSortTracks(baseTracks, deferredSearch, sortBy, likedPaths),
    [baseTracks, deferredSearch, sortBy, likedPaths],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useTrackVirtualizer({
    count: filteredTracks.length,
    parentRef,
    estimateSize: 64,
    overscan: 6,
  });

  const isPermissionDenied =
    (permissionStatus === "denied" || permissionStatus === "permanentlyDenied") &&
    tracks.length === 0 &&
    hasScanned &&
    !loading;

  return (
    <div className="flex flex-col flex-1 w-full gap-3 min-h-0 overflow-hidden">
      <TrackListBanners
        isPermissionDenied={isPermissionDenied}
        permissionStatus={permissionStatus}
        notifBlocked={notifBlocked}
        notifDismissed={notifDismissed}
        hasTracks={tracks.length > 0}
        onRequestPermission={handleRequestPermission}
        onDismissNotif={dismissNotifBanner}
      />

      <TrackListSearchBar />

      <div className="glass-panel flex-1 flex flex-col rounded-3xl p-3 sm:p-4 min-h-0 overflow-hidden shadow-sm">
        <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-black/[0.05] dark:border-white/[0.05] px-1">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {isOnlineMode ? (
              <>
                <Globe className="h-4 w-4 text-orange-500 animate-pulse" />
                <span>{translate(lang, "onlineSearchToggle")}</span>
              </>
            ) : likedOnly ? (
              <>
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                <span>
                  {filteredTracks.length === 1
                    ? translate(lang, "singleSong")
                    : translate(lang, "songCount").replace("{count}", String(filteredTracks.length))}
                </span>
              </>
            ) : (
              <>
                <Music2 className="h-4 w-4 text-orange-500" />
                <span>
                  {filteredTracks.length === 1
                    ? translate(lang, "singleSong")
                    : translate(lang, "songCount").replace("{count}", String(filteredTracks.length))}
                </span>
              </>
            )}
          </div>
          {loading && !isOnlineMode && (
            <span className="text-[11px] text-zinc-400 animate-pulse font-medium">
              {translate(lang, "scanningLibrary")}
            </span>
          )}
        </div>

        {isOnlineMode ? (
          <OnlineSearchResultsView />
        ) : loading && tracks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center min-h-[200px] gap-3 p-8 text-center">
            <RotateCw className="h-8 w-8 text-orange-500 animate-spin" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {translate(lang, "scanningLibrary")}
            </p>
          </div>
        ) : baseTracks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center min-h-[200px] gap-3 p-8 text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-3xl border shadow-lg ${
                likedOnly
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10"
                  : "bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-orange-500/10"
              }`}
            >
              {likedOnly ? <Heart className="h-8 w-8 fill-rose-500" /> : <Music2 className="h-8 w-8" />}
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, likedOnly ? "noLikedSongs" : "noSongsFound")}
            </h3>
            {likedOnly && (
              <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                {translate(lang, "noLikedSongsHint")}
              </p>
            )}
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center min-h-[200px] gap-2 p-8 text-center">
            <Music2 className="h-7 w-7 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {translate(lang, "noSongsMatchingQuery").replace("{query}", searchQuery)}
            </h3>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-1 text-xs font-semibold text-orange-500 hover:underline cursor-pointer"
              >
                {translate(lang, "searchClear")}
              </button>
            )}
          </div>
        ) : (
          <div
            ref={parentRef}
            className={`flex-1 overflow-y-auto min-h-0 pr-1 ${
              isSelectionMode && isPlayerActive
                ? "pb-[calc(18rem+env(safe-area-inset-bottom,0px))]"
                : isSelectionMode || isPlayerActive
                  ? "pb-[calc(11.5rem+env(safe-area-inset-bottom,0px))]"
                  : "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
            }`}
          >
            <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const track = filteredTracks[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <TrackRow track={track} playlist={filteredTracks} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MultiSelectActionBar tracks={filteredTracks} />
    </div>
  );
}