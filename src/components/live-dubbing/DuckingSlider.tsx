import type React from "react";
import { Volume2 } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

export function DuckingSlider(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const duckingPercent = useAppStore((s) => s.duckingPercent);
  const setDuckingPercent = useAppStore((s) => s.setDuckingPercent);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/60 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "liveDubbingDucking")}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {translate(lang, "liveDubbingDuckingSub")}
            </p>
          </div>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {duckingPercent}%
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-zinc-400">30%</span>
        <input
          type="range"
          min="30"
          max="90"
          step="5"
          value={duckingPercent}
          onChange={(e) => setDuckingPercent(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-teal-500 dark:bg-zinc-700"
          aria-label={translate(lang, "liveDubbingDucking")}
        />
        <span className="text-xs text-zinc-400">90%</span>
      </div>
    </div>
  );
}
