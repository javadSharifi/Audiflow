import React from "react";
import { formatTimecode } from "../../utils/format";
import { translate } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";
import { Minus, Plus, Play, Pause } from "lucide-react";

export interface RingtoneSteppersBarProps {
  duration: number;
  selStart: number;
  selEnd: number;
  playing: boolean;
  canPlay: boolean;
  onAdjustBound: (field: "start" | "end", delta: number) => void;
  onCommitText: (field: "start" | "end", raw: string) => void;
  onTogglePlay: () => void;
}

export function RingtoneSteppersBar({
  duration,
  selStart,
  selEnd,
  playing,
  canPlay,
  onAdjustBound,
  onCommitText,
  onTogglePlay,
}: RingtoneSteppersBarProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
      {/* Start Adjuster */}
      <div className="flex flex-col items-start gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          {translate(lang, "trimStart")}
        </span>
        <div className="flex items-center gap-1" dir="ltr">
          <button
            type="button"
            onClick={() => onAdjustBound("start", -1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 active:scale-95 cursor-pointer"
            title="-1s"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="text"
            defaultValue={formatTimecode(selStart)}
            key={`s-${selStart}`}
            placeholder="0:00.0"
            onBlur={(e) => onCommitText("start", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-18 h-7 text-center font-mono font-bold text-xs rounded-lg bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={() => onAdjustBound("start", 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 active:scale-95 cursor-pointer"
            title="+1s"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Central Play/Pause Preview Button (Plays from selStart) */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!canPlay}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/35 hover:brightness-105 active:scale-90 transition-all cursor-pointer disabled:opacity-40 ${
            playing ? "ring-4 ring-orange-500/30" : ""
          }`}
          title={translate(lang, "previewRingtone")}
        >
          {playing ? (
            <Pause className="h-5 w-5 fill-current" strokeWidth={0} />
          ) : (
            <Play className="h-5 w-5 fill-current ms-0.5" strokeWidth={0} />
          )}
        </button>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {translate(lang, "previewRingtone")}
        </span>
      </div>

      {/* End Adjuster */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          {translate(lang, "trimEnd")}
        </span>
        <div className="flex items-center gap-1" dir="ltr">
          <button
            type="button"
            onClick={() => onAdjustBound("end", -1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 active:scale-95 cursor-pointer"
            title="-1s"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="text"
            defaultValue={formatTimecode(selEnd)}
            key={`e-${selEnd}`}
            placeholder={formatTimecode(duration)}
            onBlur={(e) => onCommitText("end", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-18 h-7 text-center font-mono font-bold text-xs rounded-lg bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={() => onAdjustBound("end", 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 active:scale-95 cursor-pointer"
            title="+1s"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
