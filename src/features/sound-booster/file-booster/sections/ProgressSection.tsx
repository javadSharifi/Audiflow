import React from "react";
import { SectionShell } from "../../../../components/SectionShell";
import { translate, type Lang } from "../../../../i18n";

interface ProgressSectionProps {
  lang: Lang;
  isExporting: boolean;
  progress: number | null;
  speed: string | null;
  error: string | null;
}

export function ProgressSection({ lang, isExporting, progress, speed, error }: ProgressSectionProps): React.JSX.Element {
  const state = error ? "error" : isExporting ? "running" : progress == null ? "idle" : "done";
  const percent = Math.max(0, Math.min(100, Math.round(progress ?? 0)));

  return (
    <SectionShell step={3} titleKey="sectionProgressTitle" lang={lang} testId="booster-section-progress" state={state}>
      {state === "idle" && (
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {translate(lang, "progressIdle")}
        </p>
      )}

      {(state === "running" || state === "done") && (
        <div className="flex flex-col gap-2 rounded-2xl bg-orange-500/10 p-3.5 text-xs dark:bg-orange-500/20">
          <div className="flex items-center justify-between font-bold text-orange-700 dark:text-orange-300">
            <span>{translate(lang, "statusProcessing")}...</span>
            <span>
              {`${percent}%`}
              {speed ? ` (${speed})` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${percent}%` }}
              className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 transition-all duration-200"
            />
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-2xl bg-red-500/10 p-3.5 text-xs font-bold text-red-600 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}
    </SectionShell>
  );
}
