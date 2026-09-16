import { useMemo } from "react";
import { JobsPanel } from "../JobsPanel";
import { translate, type Lang } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

function Ring({ percent }: { percent: number }): React.JSX.Element {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative h-36 w-36" role="progressbar" aria-valuenow={Math.round(filled)} aria-valuemin={0} aria-valuemax={100} data-testid="wizard-progress-ring">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-black/[0.06] dark:stroke-white/[0.08]" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="url(#wizardRing)"
          strokeDasharray={c}
          strokeDashoffset={c - (c * filled) / 100}
          className="transition-all duration-500"
        />
        <defs>
          <linearGradient id="wizardRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-zinc-900 dark:text-white">{Math.round(filled)}%</span>
      </div>
    </div>
  );
}

export function WizardProgressStep({ lang }: { lang: Lang }): React.JSX.Element {
  const jobs = useAppStore((s) => s.jobs);
  const files = useAppStore((s) => s.files);

  const { overall, currentName } = useMemo(() => {
    const list = Array.from(jobs.values());
    const done = list.filter((j) => j.status === "completed").length;
    const total = list.length;
    const processing = list.find((j) => j.status === "processing") ?? list.find((j) => j.status === "waiting");
    const name = processing
      ? (files.find((f) => f.path === processing.sourcePath)?.name ??
        processing.sourcePath.split(/[\\/]/).pop() ??
        processing.sourcePath)
      : null;
    return { overall: total === 0 ? 0 : Math.round((done / total) * 100), currentName: name };
  }, [jobs, files]);

  return (
    <div className="flex flex-col gap-4" data-testid="wizard-step-3">
      <div className="glass-panel flex flex-col items-center gap-3 rounded-3xl px-5 py-8 text-center shadow-sm">
        <Ring percent={overall} />
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-base font-black tracking-tight text-zinc-900 dark:text-white">
            {translate(lang, "wizardConvertingTitle")}
          </h2>
          {currentName && (
            <p className="max-w-full truncate text-xs font-semibold text-orange-600 dark:text-orange-400" title={currentName}>
              {currentName}
            </p>
          )}
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {translate(lang, "wizardConvertingSub")}
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-4 shadow-sm sm:p-5">
        <JobsPanel bare />
      </div>

      <p className="text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
        {translate(lang, "wizardCancelHint")}
      </p>
    </div>
  );
}
