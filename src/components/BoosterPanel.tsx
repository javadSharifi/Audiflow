import React, { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import { isAndroid } from "../utils/platform";
import { Volume2, Shield, Info } from "lucide-react";

export function BoosterPanel(): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const {
    boosterEnabled,
    boosterLevel,
    boosterEngine,
    boosterLoading,
    enableBooster,
    disableBooster,
    setBoosterLevel,
    syncBoosterStatus,
  } = useAppStore((s) => s);

  useEffect(() => {
    if (!isAndroid()) return;
    syncBoosterStatus();

    // Kotlin dispatches state changes as a DOM CustomEvent via
    // evaluateJavascript — not via the Tauri IPC event bus.
    const onStateChange = () => {
      syncBoosterStatus();
    };
    window.addEventListener("ac:volume-booster-state", onStateChange);
    return () => {
      window.removeEventListener("ac:volume-booster-state", onStateChange);
    };
  }, [syncBoosterStatus]);

  if (!isAndroid()) {
    return null;
  }

  const handleToggle = () => {
    if (boosterEnabled) {
      disableBooster();
    } else {
      enableBooster();
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const level = parseInt(e.target.value, 10);
    setBoosterLevel(level);
  };

  const renderEngineBadge = () => {
    if (boosterEngine === "none" || !boosterEnabled) return null;
    
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
        <Shield className="h-3 w-3" />
        <span>
          {boosterEngine === "loudnessEnhancer" 
            ? translate(lang, "volumeBoosterEngineLE") 
            : translate(lang, "volumeBoosterEngineDP")}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-5 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-orange-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "volumeBoosterTitle")}
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {translate(lang, "volumeBoosterSubtitle")}
          </p>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={boosterLoading}
          className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            boosterEnabled ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-600"
          } ${boosterLoading ? "opacity-50" : ""}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              boosterEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {translate(lang, "volumeBoosterLevel")}
        </span>
        {renderEngineBadge()}
      </div>

      <div className="mb-4">
        <input
          type="range"
          min="0"
          max="100"
          value={boosterLevel}
          onChange={handleSliderChange}
          disabled={!boosterEnabled || boosterLoading}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-orange-500 dark:bg-zinc-800"
        />
        <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400">
          <span>{translate(lang, "volumeBoosterMin")}</span>
          <span>{translate(lang, "volumeBoosterMax")}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-zinc-50 p-3 text-[10px] leading-4 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{translate(lang, "volumeBoosterDisclaimer")}</p>
      </div>
    </div>
  );
}
