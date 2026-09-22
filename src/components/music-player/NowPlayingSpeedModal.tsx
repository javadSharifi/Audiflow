import { Gauge, RotateCcw, X } from "lucide-react";
import { translate, type Lang } from "../../i18n";

const SPEED_PRESETS = [0.5, 1.0, 1.5, 2.0, 2.5];

export interface NowPlayingSpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  playbackRate: number;
  onSelectRate: (rate: number) => void;
  lang: Lang;
}

export function NowPlayingSpeedModal({
  isOpen,
  onClose,
  playbackRate,
  onSelectRate,
  lang,
}: NowPlayingSpeedModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-lg mx-auto rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 shadow-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-orange-500" />
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "playbackSpeed")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectRate(1.0)}
              title={translate(lang, "resetSpeed")}
              className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-black/[0.05] hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{translate(lang, "reset")}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Speed Presets Grid (0.5x, 1x, 1.5x, 2x, 2.5x) */}
        <div className="grid grid-cols-5 gap-2">
          {SPEED_PRESETS.map((preset) => {
            const isSelected = playbackRate === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onSelectRate(preset);
                  onClose();
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                    : "bg-black/[0.04] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-orange-500/10"
                }`}
              >
                {preset}x
              </button>
            );
          })}
        </div>

        {/* Slider for continuous speed tuning (Strictly LTR) */}
        <div dir="ltr" className="flex flex-col gap-1.5 pt-1">
          <div className="flex justify-between text-xs font-medium text-zinc-500">
            <span>0.5x</span>
            <span className="font-bold text-orange-500">{playbackRate}x</span>
            <span>2.5x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={playbackRate}
            onChange={(e) => onSelectRate(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-black/10 dark:bg-white/15 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
      </div>
    </div>
  );
}
