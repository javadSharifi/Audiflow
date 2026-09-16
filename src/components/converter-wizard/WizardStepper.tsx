import { Check } from "lucide-react";
import { translate, type Lang } from "../../i18n";

export type WizardStep = 1 | 2 | 3 | 4;

const STEP_KEYS = ["wizardStepUpload", "wizardStepConfigs", "wizardStepProgress", "wizardStepResult"] as const;

interface WizardStepperProps {
  step: WizardStep;
  maxVisited: WizardStep;
  busy: boolean;
  lang: Lang;
  onGo: (step: WizardStep) => void;
}

export function WizardStepper({ step, maxVisited, busy, lang, onGo }: WizardStepperProps): React.JSX.Element {
  return (
    <ol
      data-testid="wizard-stepper"
      className="glass-panel flex flex-col items-stretch gap-1 rounded-3xl px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-2 sm:px-5"
      aria-label="wizard progress"
    >
      {/* Mobile: current step only — badge + full label, never truncated */}
      <li className="flex items-center gap-2 sm:hidden" aria-current="step">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-xs font-bold text-white shadow-md shadow-orange-500/30">
          <span className="tabular-nums">{step}</span>
        </span>
        <span className="text-xs font-bold text-zinc-900 dark:text-white">
          {translate(lang, STEP_KEYS[step - 1])}
        </span>
      </li>
      {STEP_KEYS.map((key, i) => {
        const n = (i + 1) as WizardStep;
        const done = n < step || (n <= maxVisited && step === 4 && n < 4);
        const current = n === step;
        const clickable = n <= maxVisited && n <= 2 && !busy;
        return (
          <li key={key} className="hidden min-w-0 flex-1 items-center gap-1 sm:flex sm:gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onGo(n)}
              data-testid={`wizard-goto-${n}`}
              aria-current={current ? "step" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-1.5 py-1.5 transition-colors duration-200 sm:px-2.5 ${
                clickable ? "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06]" : "cursor-default"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                  current
                    ? "bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/30"
                    : done
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-black/[0.05] text-zinc-400 dark:bg-white/[0.07] dark:text-zinc-500"
                }`}
              >
                {done && !current ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="tabular-nums">{n}</span>}
              </span>
              <span
                className={`truncate text-[11px] font-bold sm:text-xs ${
                  current
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {translate(lang, key)}
              </span>
            </button>
            {n < 4 && (
              <span
                aria-hidden
                className={`h-px w-2 shrink-0 rounded-full sm:w-4 ${n < step ? "bg-emerald-500/60" : "bg-black/10 dark:bg-white/10"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
