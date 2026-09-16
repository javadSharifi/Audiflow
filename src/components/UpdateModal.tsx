import { createPortal } from "react-dom";
import { ArrowRight, Download, Rocket, Sparkles, X } from "lucide-react";
import { translate, type Lang } from "../i18n";
import type { GithubReleaseInfo } from "../utils/githubUpdate";
import { openExternalUrl } from "../utils/externalUrl";

interface UpdateModalProps {
  lang: Lang;
  currentVersion: string;
  latest: GithubReleaseInfo;
  onClose: () => void;
}

/**
 * Celebratory "new version available" dialog. Rendered only when a newer
 * GitHub release was detected; the primary action deep-links to the
 * release page in the system browser.
 */
export function UpdateModal({ lang, currentVersion, latest, onClose }: UpdateModalProps): React.JSX.Element {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={translate(lang, "updateTitle")}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-md overflow-hidden rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Celebratory hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 px-6 pt-6 pb-8 text-center text-white">
          <div className="pointer-events-none absolute -top-10 -start-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -end-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
          <button
            type="button"
            onClick={onClose}
            aria-label={translate(lang, "close")}
            className="absolute top-3 end-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg shadow-black/10 ring-1 ring-white/40 backdrop-blur-sm">
            <Rocket className="h-8 w-8" strokeWidth={2.2} />
            <span className="absolute -top-1 -end-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-orange-500 shadow">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          </div>
          <h2 className="relative mt-4 text-lg font-extrabold tracking-tight">
            {translate(lang, "updateTitle")}
          </h2>
          <p className="relative mt-1 text-xs font-medium text-white/85">
            {translate(lang, "updateDesc", { latest: `v${latest.version}`, current: currentVersion ? `v${currentVersion}` : "…" })}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {/* Version pills */}
          <div className="flex items-center justify-center gap-2 text-xs font-bold" dir="ltr">
            <span className="rounded-full border border-black/10 bg-black/[0.04] px-3 py-1.5 font-mono text-zinc-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-400">
              v{currentVersion || "…"}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-orange-500 rtl:rotate-180" />
            <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 font-mono text-white shadow-md shadow-orange-500/30">
              v{latest.version}
            </span>
          </div>

          {/* Release notes */}
          {latest.notes && (
            <div className="rounded-2xl bg-black/[0.03] p-3.5 dark:bg-white/[0.03]">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                {translate(lang, "updateNotes")}
              </p>
              <p className="max-h-36 overflow-y-auto text-xs leading-6 whitespace-pre-line text-zinc-600 dark:text-zinc-300">
                {latest.notes.length > 600 ? `${latest.notes.slice(0, 600)}…` : latest.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              {translate(lang, "updateLater")}
            </button>
            <button
              type="button"
              onClick={() => {
                void openExternalUrl(latest.url);
                onClose();
              }}
              className="flex flex-[2] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:brightness-105 hover:shadow-lg hover:shadow-orange-500/30 active:scale-95"
            >
              <Download className="h-4 w-4" strokeWidth={2.4} />
              {translate(lang, "updateDownload")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
