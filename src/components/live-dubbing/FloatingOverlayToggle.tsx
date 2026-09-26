import type React from "react";
import { Layers } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

export function FloatingOverlayToggle(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const isOverlayActive = useAppStore((s) => s.isOverlayActive);
  const setIsOverlayActive = useAppStore((s) => s.setIsOverlayActive);

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white/60 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "liveDubbingFloatingOverlay")}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {translate(lang, "liveDubbingFloatingOverlaySub")}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isOverlayActive}
        onClick={() => setIsOverlayActive(!isOverlayActive)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          isOverlayActive ? "bg-teal-500" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isOverlayActive ? (lang === "fa" ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
