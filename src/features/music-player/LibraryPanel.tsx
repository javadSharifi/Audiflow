import React, { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronLeft, FolderOpen, Loader2, Play, RefreshCw, Search } from "lucide-react";
import type { Lang } from "../../i18n";
import { translate } from "../../i18n";
import { formatDuration } from "../../utils/format";
import { isAndroid } from "../../utils/platform";
import { hasMediaPermissions, requestMediaPermissions } from "../../utils/tauri";
import type { LibraryTrack } from "../../types/generated";
import {
  displayTitle,
  filterLibrary,
  groupLibrary,
  toPlayerTrack,
  useLibraryStore,
  type LibraryView,
} from "./library";
import { useMusicPlayerStore } from "./useMusicPlayerStore";

const PAGE = 200;

export function LibraryPanel({ lang }: { lang: Lang }): React.JSX.Element {
  const { dir, tracks, scanning, error, scan } = useLibraryStore();
  const replacePlaylist = useMusicPlayerStore((s) => s.replacePlaylist);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("songs");
  const [group, setGroup] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => filterLibrary(tracks, query), [tracks, query]);
  const groups = useMemo(
    () => (view === "songs" ? [] : groupLibrary(filtered, view === "artists" ? "artist" : "album")),
    [filtered, view],
  );
  const songs = group !== null ? (groups.find((g) => g.key === group)?.tracks ?? []) : filtered;

  async function startScan(rescan: boolean) {
    if (isAndroid()) {
      if (!(await hasMediaPermissions())) {
        requestMediaPermissions();
        return;
      }
      await scan(null);
      return;
    }
    let target = rescan ? dir : null;
    if (!target) {
      const picked = await open({ directory: true });
      if (!picked || Array.isArray(picked)) return;
      target = String(picked);
    }
    await scan(target);
  }

  const play = (list: LibraryTrack[], idx: number) =>
    replacePlaylist(list.map(toPlayerTrack), idx);

  const unknown = (key: string) =>
    key || translate(lang, view === "artists" ? "libraryUnknownArtist" : "libraryUnknownAlbum");

  const btn =
    "inline-flex items-center gap-1.5 rounded-xl border border-black/5 bg-black/[0.03] px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08] active:scale-95 transition-all disabled:opacity-50";

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <p>{error ?? translate(lang, "libraryEmpty")}</p>
        <button type="button" className={btn} disabled={scanning} onClick={() => startScan(false)}>
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
          <span>
            {translate(
              lang,
              scanning ? "libraryScanning" : isAndroid() ? "libraryScanDevice" : "libraryChooseFolder",
            )}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/5 bg-black/[0.03] px-3 py-1.5 dark:border-white/5 dark:bg-white/[0.04]">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={translate(lang, "librarySearch")}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-400"
          />
        </label>
        <div className="flex rounded-xl bg-black/[0.04] p-0.5 dark:bg-white/[0.06]">
          {(["songs", "artists", "albums"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setGroup(null);
                setLimit(PAGE);
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                view === v
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
              }`}
            >
              {translate(lang, `libraryView_${v}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={btn}
          disabled={scanning}
          onClick={() => startScan(true)}
          title={translate(lang, "libraryRescan")}
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
        {!isAndroid() && (
          <button
            type="button"
            className={btn}
            disabled={scanning}
            onClick={() => startScan(false)}
            title={translate(lang, "libraryChooseFolder")}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {view !== "songs" && group === null ? (
        <div className="max-h-[380px] divide-y divide-black/[0.03] overflow-y-auto pe-1 dark:divide-white/[0.03]">
          {groups.slice(0, limit).map((g) => (
            <button
              key={g.key || "\u0000"}
              type="button"
              onClick={() => setGroup(g.key)}
              className="flex w-full items-center justify-between rounded-2xl p-2.5 text-start hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            >
              <span className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {unknown(g.key)}
              </span>
              <span className="shrink-0 text-[11px] text-zinc-500">
                {translate(lang, "trackCount", { count: g.tracks.length })}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {group !== null && (
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={btn} onClick={() => setGroup(null)}>
                <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
                <span className="truncate max-w-48">{unknown(group)}</span>
              </button>
              <button type="button" className={btn} onClick={() => play(songs, 0)}>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{translate(lang, "libraryPlayAll")}</span>
              </button>
            </div>
          )}
          <div className="max-h-[380px] divide-y divide-black/[0.03] overflow-y-auto pe-1 dark:divide-white/[0.03]">
            {songs.slice(0, limit).map((t, i) => (
              <button
                key={t.path}
                type="button"
                onClick={() => play(songs, i)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl p-2.5 text-start hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {displayTitle(t)}
                  </span>
                  <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                    {[t.artist, t.album].filter(Boolean).join(" — ") || t.name}
                  </span>
                </span>
                {t.durationSecs > 0 && (
                  <span className="shrink-0 font-mono text-[11px] text-zinc-500">
                    {formatDuration(t.durationSecs)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {(view === "songs" || group !== null ? songs.length : groups.length) > limit && (
        <button type="button" className={`${btn} w-full justify-center`} onClick={() => setLimit((l) => l + PAGE)}>
          {translate(lang, "libraryShowMore")}
        </button>
      )}
    </div>
  );
}
