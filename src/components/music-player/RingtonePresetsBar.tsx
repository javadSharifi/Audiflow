import React from "react";
import { translate } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

export interface RingtonePresetsBarProps {
  duration: number;
  selStart: number;
  selEnd: number;
  onApplyPreset: (presetSecs: number) => void;
  onFullPreset: () => void;
}

export function RingtonePresetsBar({
  duration,
  selStart,
  selEnd,
  onApplyPreset,
  onFullPreset,
}: RingtonePresetsBarProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  const presets = [15, 30, 45] as const;

  return (
    <div className="flex items-center justify-between gap-1.5 p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
      {presets.map((preset) => {
        const isActive = selStart === 0 && selEnd === Math.min(preset, duration);
        const labelKey = `ringtonePreset${preset}` as const;
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onApplyPreset(preset)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isActive
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                : "text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            {translate(lang, labelKey)}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onFullPreset}
        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
          selStart === 0 && selEnd === duration
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
            : "text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        }`}
      >
        {translate(lang, "ringtoneFull")}
      </button>
    </div>
  );
}
