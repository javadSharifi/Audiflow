import { useMemo } from "react";
import { Check, RotateCcw } from "lucide-react";
import { WizardResultList } from "./WizardResultList";
import { translate, type Lang } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

interface WizardResultStepProps {
  lang: Lang;
  onRestart: () => void;
}

export function WizardResultStep({ lang, onRestart }: WizardResultStepProps): React.JSX.Element {
  const jobs = useAppStore((s) => s.jobs);

  const { done, total } = useMemo(() => {
    const list = Array.from(jobs.values());
    return {
      done: list.filter((j) => j.status === "completed").length,
      total: list.length,
    };
  }, [jobs]);

  return (
    <div className="flex flex-col gap-4" data-testid="wizard-step-4">
      <div className="glass-panel flex items-center gap-3 rounded-3xl p-4 text-center shadow-sm sm:justify-center sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <div className="flex flex-col items-start gap-0.5 sm:items-center">
          <h2 className="text-base font-black tracking-tight text-zinc-900 dark:text-white">
            {translate(lang, "wizardDoneTitle")}
          </h2>
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {translate(lang, "wizardDoneSub", { done: String(done), total: String(total) })}
          </p>
        </div>
      </div>

      <WizardResultList lang={lang} />

      <button
        type="button"
        onClick={onRestart}
        data-testid="wizard-restart"
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:brightness-105 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.99]"
      >
        <RotateCcw className="h-4 w-4" />
        <span>{translate(lang, "wizardRestart")}</span>
      </button>
    </div>
  );
}
