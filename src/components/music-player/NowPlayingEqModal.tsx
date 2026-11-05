import React from "react";
import { X, SlidersHorizontal, RefreshCw } from "lucide-react";
import { translate, type Lang } from "../../i18n";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { EQ_PRESETS, type EqPreset } from "../../stores/musicPlayer/audioEngine";
import { isAndroid } from "../../utils/platform";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
}

export function NowPlayingEqModal({ isOpen, onClose, lang }: Props): React.JSX.Element | null {
  const eqEnabled = useMusicPlayerStore((s) => s.eqEnabled);
  const eqPreset = useMusicPlayerStore((s) => s.eqPreset);
  const setEqEnabled = useMusicPlayerStore((s) => s.setEqEnabled);
  const setEqPreset = useMusicPlayerStore((s) => s.setEqPreset);

  if (!isOpen) return null;

  const disabled = isAndroid();

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-lg mx-auto rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 shadow-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-orange-500" />
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "equalizer")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {disabled ? (
          <p className="text-xs text-zinc-400 text-center py-4">
            {translate(lang, "equalizerDesktopOnly")}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEqEnabled(!eqEnabled)}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
                eqEnabled
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                  : "bg-black/[0.04] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <span>{translate(lang, "enableEqualizer")}</span>
              <span className="text-[10px] font-mono">{eqEnabled ? "ON" : "OFF"}</span>
            </button>

            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(EQ_PRESETS) as EqPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={!eqEnabled}
                  onClick={() => setEqPreset(preset)}
                  className={`py-2 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer disabled:opacity-40 ${
                    eqPreset === preset
                      ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                      : "bg-black/[0.04] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-orange-500/10"
                  }`}
                >
                  {translate(lang, `eq_${preset}` as never)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setEqPreset("flat");
                setEqEnabled(false);
              }}
              className="flex items-center justify-center gap-1.5 self-start h-7 px-2.5 rounded-full bg-black/[0.05] hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer active:scale-95"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{translate(lang, "reset")}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
