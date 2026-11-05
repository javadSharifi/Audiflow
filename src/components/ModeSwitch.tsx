import React from "react";
import { RefreshCw, Disc3 } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import type { AppMode } from "../types";

interface ModeSwitchProps {
  className?: string;
  size?: "sm" | "md";
}

export function ModeSwitch({ className = "", size = "md" }: ModeSwitchProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const appMode = useAppStore((s) => s.appMode);
  const setAppMode = useAppStore((s) => s.setAppMode);

  const isPlayer = appMode === "player";

  const handleToggle = (checked: boolean) => {
    const nextMode: AppMode = checked ? "player" : "converter";
    setAppMode(nextMode);
  };

  const isFa = lang === "fa";

  return (
    <div
      className={`app-mode-switch-track relative flex items-center select-none ${
        isPlayer ? "is-player" : ""
      } ${size === "sm" ? "h-[34px] p-1 text-[11px]" : "h-[38px] p-1 text-xs"} ${className}`}
      dir={isFa ? "rtl" : "ltr"}
      title={isPlayer ? translate(lang, "switchToConverter") : translate(lang, "switchToPlayer")}
    >
      {/* Hidden Accessible Switch Input matching user specification */}
      <input
        type="checkbox"
        role="switch"
        aria-checked={isPlayer}
        aria-label={translate(lang, "playerTitle")}
        checked={isPlayer}
        onChange={(e) => handleToggle(e.target.checked)}
        className="day-night app-mode-input-switch cursor-pointer"
        data-testid="app-mode-switch"
      />

      {/* Sliding Pill Knob */}
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none shadow-md ${
          isPlayer
            ? isFa
              ? "right-[calc(50%+2px)] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-purple-500/30 dark:shadow-purple-900/50"
              : "left-[calc(50%+2px)] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-purple-500/30 dark:shadow-purple-900/50"
            : isFa
              ? "right-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 shadow-orange-500/30 dark:shadow-orange-950/40"
              : "left-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 shadow-orange-500/30 dark:shadow-orange-950/40"
        }`}
      >
        {/* Subtle glossy top highlight inside knob */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 via-transparent to-black/10 pointer-events-none" />
      </div>

      {/* Converter Label */}
      <div
        className={`relative z-1 flex-1 flex items-center justify-center gap-1.5 px-3 py-1 font-bold transition-all duration-200 pointer-events-none ${
          !isPlayer
            ? "text-white drop-shadow-sm font-extrabold"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <RefreshCw
          className={`transition-transform duration-300 ${size === "sm" ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} ${
            !isPlayer ? "scale-105" : "opacity-70"
          }`}
          strokeWidth={2.4}
        />
        <span className="truncate tracking-tight">{translate(lang, "modeConverter")}</span>
      </div>

      {/* Music Player Label */}
      <div
        className={`relative z-1 flex-1 flex items-center justify-center gap-1.5 px-3 py-1 font-bold transition-all duration-200 pointer-events-none ${
          isPlayer
            ? "text-white drop-shadow-sm font-extrabold"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <Disc3
          className={`transition-transform duration-300 ${size === "sm" ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} ${
            isPlayer ? "scale-110 animate-spin-slow" : "opacity-70"
          }`}
          strokeWidth={2.4}
        />
        <span className="truncate tracking-tight">{translate(lang, "modePlayer")}</span>
      </div>
    </div>
  );
}
