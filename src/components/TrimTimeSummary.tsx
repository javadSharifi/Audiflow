import React from "react";
import { formatTimecode } from "../utils/format";
import { translate } from "../i18n";
import { useAppStore } from "../stores/useAppStore";

export interface TrimTimeSummaryProps {
  filePath: string;
  fileName: string;
  duration: number;
  selStart: number | null;
  selEnd: number | null;
  onCommitText: (field: "trimStartSecs" | "trimEndSecs", raw: string) => void;
}

export function TrimTimeSummary({
  filePath,
  fileName,
  duration,
  selStart,
  selEnd,
  onCommitText,
}: TrimTimeSummaryProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  const effectiveStart = selStart ?? 0;
  const effectiveEnd = selEnd ?? duration;
  const selLen = Math.max(0, effectiveEnd - effectiveStart);

  return (
    <div
      dir={lang === "fa" ? "rtl" : "ltr"}
      className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs"
    >
      <span className="font-semibold text-slate-600 dark:text-[#CBD5E1]">
        {translate(lang, "trimFrom")}
      </span>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`trim-start-${filePath}`}
          className="text-[11px] font-semibold text-slate-600 dark:text-[#CBD5E1]"
        >
          {translate(lang, "trimStart")}
        </label>
        <input
          id={`trim-start-${filePath}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          defaultValue={selStart != null ? formatTimecode(selStart) : ""}
          key={`s-${filePath}-${selStart ?? "none"}`}
          placeholder="00:00.0"
          aria-label={`${translate(lang, "trimStart")} ${formatTimecode(effectiveStart)}`}
          data-testid={`trim-start-text-${fileName}`}
          onBlur={(e) => onCommitText("trimStartSecs", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="glass-pill h-11 min-h-[44px] w-24 rounded-xl px-2.5 text-center text-sm font-semibold tabular-nums text-zinc-800 outline-none focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#F8FAFC]"
        />
      </div>

      <span className="font-semibold text-slate-600 dark:text-[#CBD5E1]">
        {translate(lang, "trimTo")}
      </span>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`trim-end-${filePath}`}
          className="text-[11px] font-semibold text-slate-600 dark:text-[#CBD5E1]"
        >
          {translate(lang, "trimEnd")}
        </label>
        <input
          id={`trim-end-${filePath}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          defaultValue={selEnd != null ? formatTimecode(selEnd) : ""}
          key={`e-${filePath}-${selEnd ?? "none"}`}
          placeholder={formatTimecode(duration)}
          aria-label={`${translate(lang, "trimEnd")} ${formatTimecode(effectiveEnd)}`}
          data-testid={`trim-end-text-${fileName}`}
          onBlur={(e) => onCommitText("trimEndSecs", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="glass-pill h-11 min-h-[44px] w-24 rounded-xl px-2.5 text-center text-sm font-semibold tabular-nums text-zinc-800 outline-none focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#F8FAFC]"
        />
      </div>

      <p
        aria-live="polite"
        className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-[#CBD5E1]"
      >
        <span>{translate(lang, "trimSelectedDuration")}: </span>
        <span>{formatTimecode(selLen)}</span>
        <span className="font-normal opacity-70"> / {formatTimecode(duration)}</span>
      </p>
    </div>
  );
}
