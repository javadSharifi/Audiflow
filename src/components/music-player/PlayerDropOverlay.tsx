import React from "react";
import { Music } from "lucide-react";
import { translate } from "../../i18n";

export interface PlayerDropOverlayProps {
  isVisible: boolean;
  lang: "en" | "fa";
}

export function PlayerDropOverlay({ isVisible, lang }: PlayerDropOverlayProps): React.JSX.Element | null {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300 dark:bg-black/60"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-orange-500/80 bg-white/95 p-8 text-center shadow-2xl transition-transform dark:bg-zinc-900/95 max-w-sm mx-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500 ring-8 ring-orange-500/10">
          <Music className="h-8 w-8 animate-bounce" strokeWidth={2.4} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "dropToPlay")}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {translate(lang, "dropToPlaySubtitle")}
          </p>
        </div>
      </div>
    </div>
  );
}
