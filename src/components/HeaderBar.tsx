import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getVersion } from "@tauri-apps/api/app";
import { Settings as SettingsIcon, X, AudioLines, Music, Sun, Moon, Languages, Zap, Download } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import { applyResolvedTheme, resolveTheme } from "../hooks/useTheme";
import { revealOrigin, revealThemeChange } from "../utils/themeTransition";
import { useGithubUpdate } from "../hooks/useGithubUpdate";
import { UpdateModal } from "./UpdateModal";
import type { AppSettings } from "../types";

export function HeaderBar(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const activeTool = useAppStore((s) => s.activeTool);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const persistSettings = useAppStore((s) => s.persistSettings);
  const settings = useAppStore((s) => s.settings);
  const reducedBlur = useAppStore((s) => s.reducedBlur);
  const setReducedBlur = useAppStore((s) => s.setReducedBlur);
  const [open, setOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [version, setVersion] = useState("");
  const { latest, updateAvailable } = useGithubUpdate();

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const patch = (p: Partial<AppSettings>) => {
    if (!settings) return;
    updateSettings(p);
    void persistSettings();
  };

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const currentResolved = resolveTheme(theme);
    const nextTheme = currentResolved === "dark" ? "light" : "dark";
    const { x, y } = revealOrigin(e);
    revealThemeChange(x, y, () => {
      // Paint synchronously so the view-transition snapshot captures the new
      // theme even though the store update below flushes asynchronously.
      applyResolvedTheme(nextTheme);
      patch({ theme: nextTheme });
    });
  };

  const toggleLang = () => {
    const nextLang = lang === "fa" ? "en" : "fa";
    patch({ language: nextLang });
  };

  const isDark = resolveTheme(theme) === "dark";

  return (
    <header className="relative z-30 flex items-center justify-between gap-2 border-b border-black/[0.06] bg-white/95 backdrop-blur-md px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] shadow-sm dark:border-white/[0.06] dark:bg-zinc-900/95 md:px-6">
      {/* Brand & App Title (Dynamic based on active tool) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/20 transition-all duration-300">
          {activeTool === "player" ? (
            <Music className="h-5 w-5" strokeWidth={2.4} />
          ) : (
            <AudioLines className="h-5 w-5" strokeWidth={2.4} />
          )}
        </div>
        <h1 className="text-sm font-bold tracking-tight md:text-base text-zinc-900 dark:text-zinc-100 truncate transition-all duration-200">
          {activeTool === "player"
            ? translate(lang, "musicPlayerTitle")
            : translate(lang, "appTitle")}
        </h1>
      </div>

      {/* Header Actions: Update (when available) + Theme quick toggle + Settings — 44dp intermediate (prev 32 → now 44) */}
      <div className="flex items-center gap-2 text-xs ms-auto">
        {updateAvailable && latest && (
          <button
            type="button"
            onClick={() => setUpdateOpen(true)}
            className="relative flex min-h-[44px] min-w-[44px] h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-600 shadow-sm shadow-orange-500/20 transition-all hover:bg-orange-500/20 active:scale-95 dark:text-orange-400"
            title={translate(lang, "updateAvailable")}
            aria-label={translate(lang, "updateAvailable")}
          >
            <Download className="h-[18px] w-[18px]" strokeWidth={2.2} />
            <span className="absolute top-2 end-2 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900" />
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-xl border border-black/5 bg-black/[0.03] text-zinc-600 transition-all hover:bg-black/[0.06] active:scale-95 dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]"
          title={isDark ? translate(lang, "themeLight") : translate(lang, "themeDark")}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-xl border border-black/5 bg-black/[0.03] text-zinc-600 transition-all hover:bg-black/[0.06] active:scale-95 dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]"
          title={translate(lang, "settingsTitle")}
          aria-label={translate(lang, "settingsTitle")}
        >
          <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>

      {/* Settings Dialog Portal */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl">
              {/* Settings Header */}
              <div className="flex items-center justify-between mb-5 border-b border-black/[0.05] pb-3 dark:border-white/[0.05]">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {translate(lang, "settingsTitle")}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Settings Options List */}
              <div className="space-y-3.5 text-sm">
                {/* Language Setting Row */}
                <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                      <Languages className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
                        {translate(lang, "language")}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {lang === "fa" ? "فارسی (Persian)" : "English"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleLang}
                    className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 dark:border-white/5 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <span className="text-[11px] font-extrabold text-orange-500 uppercase">
                      {lang === "fa" ? "EN" : "FA"}
                    </span>
                    <span>{lang === "fa" ? "English" : "فارسی"}</span>
                  </button>
                </div>

                {/* Performance Mode (Reduced Blur) Setting Row */}
                <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
                        {translate(lang, "perfModeTitle")}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {translate(lang, "perfModeDesc")}
                      </span>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={reducedBlur}
                    onChange={(e) => setReducedBlur(e.target.checked)}
                    className="h-5 w-5 rounded-md accent-orange-500 cursor-pointer"
                  />
                </div>

                {/* Concurrency Setting */}
                <label className="flex items-center justify-between rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.03]">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {translate(lang, "concurrency")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={settings?.concurrency ?? 1}
                    onChange={(e) =>
                      updateSettings({
                        concurrency: Math.max(1, Math.min(32, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-20 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-center font-bold outline-none dark:border-white/10 dark:bg-black/30"
                  />
                </label>

                {/* App Version Info inside Settings */}
                {version && (
                  <div className="flex items-center justify-between px-2 pt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    <span>{translate(lang, "appTitle")}</span>
                    <span className="font-mono font-semibold">v{version}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                >
                  {translate(lang, "cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void persistSettings();
                    setOpen(false);
                  }}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/20 hover:brightness-105 active:scale-95"
                >
                  {translate(lang, "saveSettings")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Update Dialog Portal */}
      {updateOpen && updateAvailable && latest && (
        <UpdateModal
          lang={lang}
          currentVersion={version}
          latest={latest}
          onClose={() => setUpdateOpen(false)}
        />
      )}
    </header>
  );
}
