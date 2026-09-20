import { useEffect, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import { AlbumCard } from "./AlbumCard";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { AlbumItem } from "../../types";

export function getResponsiveAlbumCols(w: number): number {
  if (w >= 1024) return 6;
  if (w >= 768) return 5;
  if (w >= 640) return 4;
  return 3;
}

export function useAlbumColumns(): number {
  const [cols, setCols] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    return getResponsiveAlbumCols(w);
  });

  useEffect(() => {
    const upd = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 0;
      setCols(getResponsiveAlbumCols(w));
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  return cols;
}

type CombinedItem = { kind: "create" } | { kind: "album"; album: AlbumItem };

interface AlbumGridVirtualizedProps {
  albums: AlbumItem[];
  parentRef: React.RefObject<HTMLDivElement | null>;
  onSelectAlbum: (id: string) => void;
  onPlayAlbum: (album: AlbumItem) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (album: AlbumItem) => void;
  showCreateCard?: boolean;
  onCreate?: () => void;
}

export function AlbumGridVirtualized({
  albums,
  parentRef,
  onSelectAlbum,
  onPlayAlbum,
  onRename,
  onDelete,
  showCreateCard = false,
  onCreate,
}: AlbumGridVirtualizedProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const cols = useAlbumColumns();
  const items: CombinedItem[] = useMemo(() => {
    const arr: CombinedItem[] = [];
    if (showCreateCard) arr.push({ kind: "create" });
    for (const a of albums) arr.push({ kind: "album", album: a });
    return arr;
  }, [albums, showCreateCard]);

  const rowCount = Math.ceil(items.length / cols);

  // Each grid row ~ 175px on mobile, ~210 on desktop — use conservative 210
  const estimateRow = 210;
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual returns non-memoizable functions; compiler memoization is intentionally skipped
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRow,
    overscan: 2,
    // Same guard as useTrackVirtualizer: without an initial rect the
    // virtualizer measures 0 rows when the scroll element is null/hidden on
    // first paint (lazy KeepAlive mount + async scan) and stays empty until
    // a scroll/resize forces re-measure — badge shows N but grid is blank.
    initialRect: { width: 800, height: 600 },
    // virtualizer measures against scrollElement; padding for headers is
    // handled by staying inside same scroller with modest over-render.
  });

  // The scroll element (parentRef) is null on first render and may be
  // display:none while its KeepAlive tab is inactive. Re-measure once it is
  // laid out and whenever the row count changes (e.g. async scan lands
  // after the album tab already mounted).
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, rowCount, cols, albums.length]);

  // Keep the virtualizer in sync when the KeepAlive pane toggles
  // display:none -> flex (tab switch) — ResizeObserver on the scroller
  // fires and forces a re-measure so rows appear without a second visit.
  const [, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const el = parentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => rowVirtualizer.measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [parentRef, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  // If measurement hasn't settled yet (scroll element null/hidden on first
  // paint), the virtualizer reports 0 rows / 0 size while albums already
  // exist — the badge counts N but the grid renders blank. Fall back to the
  // first rows synchronously so content is visible immediately; once the
  // virtualizer measures, it takes over for scrolling.
  const fallbackRowCount = rowCount > 0 ? Math.min(rowCount, 6) : 0;
  const effectiveRows =
    virtualRows.length === 0 && rowCount > 0
      ? Array.from({ length: fallbackRowCount }, (_, i) => ({
          key: i,
          index: i,
          start: i * estimateRow,
          size: estimateRow,
        }))
      : virtualRows;
  const effectiveTotalSize = totalSize > 0 ? totalSize : rowCount * estimateRow;

  if (items.length === (showCreateCard ? 1 : 0) && rowCount === (showCreateCard ? 1 : 0)) {
    // Only the create card or empty — render directly without virtualization
    if (showCreateCard && albums.length === 0) {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={onCreate}
            className="flex flex-col items-center justify-center aspect-square p-2 sm:p-4 rounded-2xl sm:rounded-3xl border-2 border-dashed border-orange-500/40 hover:border-orange-500 bg-orange-500/[0.03] hover:bg-orange-500/[0.08] text-orange-600 dark:text-orange-400 transition-all cursor-pointer group active:scale-95 shadow-sm"
          >
            <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 group-hover:scale-110 transition-transform mb-1 sm:mb-2">
              <Plus className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-center leading-tight">
              {translate(lang, "createAlbum")}
            </span>
          </button>
        </div>
      );
    }
  }

  return (
    <div style={{ height: effectiveTotalSize ? `${effectiveTotalSize}px` : undefined, width: "100%", position: "relative" }}>
      {effectiveRows.map((vr) => {
        const startIdx = vr.index * cols;
        const rowItems = items.slice(startIdx, startIdx + cols);
        return (
          <div
            key={vr.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vr.start}px)`,
            }}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
              {rowItems.map((item, idx) => {
                if (item.kind === "create") {
                  return (
                    <button
                      key={`create-${vr.index}-${idx}`}
                      type="button"
                      onClick={onCreate}
                      className="flex flex-col items-center justify-center aspect-square p-2 sm:p-4 rounded-2xl sm:rounded-3xl border-2 border-dashed border-orange-500/40 hover:border-orange-500 bg-orange-500/[0.03] hover:bg-orange-500/[0.08] text-orange-600 dark:text-orange-400 transition-all cursor-pointer group active:scale-95 shadow-sm"
                    >
                      <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 group-hover:scale-110 transition-transform mb-1 sm:mb-2">
                        <Plus className="h-4 w-4 sm:h-6 sm:w-6" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-center leading-tight">
                        {translate(lang, "createAlbum")}
                      </span>
                    </button>
                  );
                }
                const album = item.album;
                return (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => onSelectAlbum(album.id)}
                    onPlay={() => void onPlayAlbum(album)}
                    onRename={onRename ? () => onRename(album.id, album.name) : undefined}
                    onDelete={onDelete ? () => onDelete(album) : undefined}
                  />
                );
              })}
              {/* Fill empty cells to keep grid alignment if last row incomplete */}
              {rowItems.length < cols &&
                Array.from({ length: cols - rowItems.length }).map((_, i) => (
                  <div key={`empty-${vr.index}-${i}`} aria-hidden />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
