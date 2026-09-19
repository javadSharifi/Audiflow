import { useEffect, useState } from "react";
import { audioDir, desktopDir, documentDir, downloadDir } from "@tauri-apps/api/path";
import { FolderPlus, Loader2, Music2 } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { persistCustomFolders } from "../../stores/musicPlayer/persistence";
import { translate, type TranslationKey } from "../../i18n";
import { pickDirectories } from "../../utils/dialog";

interface FirstRunFoldersGateProps {
  onDone: (selectedDirs: string[]) => void;
  onSkip: () => void;
}

interface FolderRow {
  key: string;
  labelKey: TranslationKey;
  path: string;
  checked: boolean;
}

/**
 * First-run gate (desktop): before the boot library scan, let the user pick
 * which home folders to scan. Each extra root costs its own macOS TCC prompt
 * on first walk, so the subtitle explains the upcoming prompts. Persists the
 * selection to custom folders (batched — addCustomFolder scans per call, so a
 * loop there would walk the disk N+1 times) and reports it via onDone for a
 * single scanLibrary call (which replaces, not appends, tracks).
 */
export function FirstRunFoldersGate({
  onDone,
  onSkip,
}: FirstRunFoldersGateProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const [rows, setRows] = useState<FolderRow[]>([]);
  const [scanning, setScanning] = useState(false);

  // OS-correct home folders via the core path API (no extra plugin needed).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const defs: { key: string; labelKey: TranslationKey; get: () => Promise<string>; checked: boolean }[] = [
        { key: "music", labelKey: "firstRunMusic", get: audioDir, checked: true },
        { key: "downloads", labelKey: "firstRunDownloads", get: downloadDir, checked: false },
        { key: "desktop", labelKey: "firstRunDesktop", get: desktopDir, checked: false },
        { key: "documents", labelKey: "firstRunDocuments", get: documentDir, checked: false },
      ];
      const resolved: FolderRow[] = [];
      for (const d of defs) {
        try {
          const path = await d.get();
          if (path) resolved.push({ key: d.key, labelKey: d.labelKey, path, checked: d.checked });
        } catch { /* best-effort: ignore */ }
      }
      if (!cancelled) setRows(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleRow = (key: string) => {
    if (scanning) return;
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, checked: !r.checked } : r)));
  };

  const handleAddOther = async () => {
    if (scanning) return;
    const picked = await pickDirectories();
    if (picked.length === 0) return;
    setRows((prev) => {
      const known = new Set(prev.map((r) => r.path));
      const extra = picked
        .filter((p) => !known.has(p))
        .map((p, i) => ({
          key: `custom-${Date.now()}-${i}-${p}`,
          labelKey: "firstRunAddOther" as TranslationKey,
          path: p,
          checked: true,
        }));
      return [...prev, ...extra];
    });
  };

  const handleStart = () => {
    if (scanning) return;
    const checked = rows.filter((r) => r.checked).map((r) => r.path);
    // Empty selection = skip: fall through to the default ~/Music boot scan.
    if (checked.length === 0) {
      onSkip();
      return;
    }
    setScanning(true);
    try {
      const store = useMusicPlayerStore.getState();
      const next = Array.from(new Set([...store.customFolders, ...checked]));
      persistCustomFolders(next);
      useMusicPlayerStore.setState({ customFolders: next });
    } catch { /* best-effort: ignore */ }
    onDone(checked);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-100/95 p-6 backdrop-blur-md select-none dark:bg-[#09090b]/95 animate-in fade-in duration-200">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-black/[0.06] bg-white/80 p-8 text-center shadow-2xl dark:border-white/[0.08] dark:bg-zinc-900/80">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/30">
          <Music2 className="h-9 w-9 text-white" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "firstRunTitle")}
          </h1>
          <p className="text-[13px] font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
            {translate(lang, "firstRunSubtitle")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5">
          {rows.map((row) => (
            <label
              key={row.key}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/60 px-3.5 py-2.5 text-start transition-colors hover:bg-white dark:border-white/[0.08] dark:bg-zinc-800/60 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={row.checked}
                disabled={scanning}
                onChange={() => toggleRow(row.key)}
                className="h-4 w-4 shrink-0 rounded accent-orange-500 cursor-pointer"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {translate(lang, row.labelKey)}
                </span>
                <span className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400" dir="ltr">
                  {row.path}
                </span>
              </span>
              {scanning && row.checked && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />}
            </label>
          ))}
          <button
            type="button"
            onClick={() => void handleAddOther()}
            disabled={scanning}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-500/30 bg-orange-500/10 px-3.5 py-2.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-500/15 disabled:opacity-50 dark:text-orange-400 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            <span>{translate(lang, "firstRunAddOther")}</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={scanning}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-105 active:scale-[0.985] disabled:cursor-wait disabled:opacity-70 cursor-pointer"
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{translate(lang, "firstRunScanning")}</span>
            </>
          ) : (
            <span>{translate(lang, "firstRunStart")}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={scanning}
          className="text-xs font-semibold text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50 dark:text-zinc-400 cursor-pointer"
        >
          {translate(lang, "firstRunSkip")}
        </button>
      </div>
    </div>
  );
}
