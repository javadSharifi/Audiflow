import { createPortal } from "react-dom";
import type React from "react";
import { X, Radio } from "lucide-react";
import { LiveDubbingPanel } from "./LiveDubbingPanel";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

interface LiveDubbingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LiveDubbingModal({ isOpen, onClose }: LiveDubbingModalProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const dubbingState = useAppStore((s) => s.dubbingState);

  if (!isOpen) return null;

  const isActive = dubbingState !== "idle" && dubbingState !== "error";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex h-[92vh] w-full max-w-2xl flex-col rounded-3xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-zinc-800 dark:bg-zinc-950/95 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3.5 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isActive
                ? "bg-teal-500 text-white shadow-md shadow-teal-500/30"
                : "bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400"
            }`}>
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {translate(lang, "liveDubbingTitle")}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {translate(lang, "liveDubbingSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden">
          <LiveDubbingPanel />
        </div>
      </div>
    </div>,
    document.body,
  );
}
