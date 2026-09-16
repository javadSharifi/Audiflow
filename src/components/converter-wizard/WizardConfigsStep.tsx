import { ArrowLeft, ArrowRight, Loader2, Play } from "lucide-react";
import { OptionsPanel } from "../OptionsPanel";
import { translate, type Lang } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";
import { isLossy } from "../../types";

export function useConvertDisabled(): boolean {
  const files = useAppStore((s) => s.files);
  const options = useAppStore((s) => s.options);
  const jobs = useAppStore((s) => s.jobs);
  const starting = useAppStore((s) => s.starting);

  const validCount = files.filter((f) => !f.error && f.hasAudio).length;
  const busy = Array.from(jobs.values()).some((j) => ["waiting", "processing"].includes(j.status));

  return (
    validCount === 0 ||
    busy ||
    starting ||
    (isLossy(options.format) && options.quality === "custom" && !options.customBitrateKbps) ||
    (options.splitEnabled &&
      (options.splitDurationSecs === null ||
        !Number.isFinite(options.splitDurationSecs) ||
        options.splitDurationSecs <= 0)) ||
    (options.outputMode === "custom_folder" && !options.customOutputDir)
  );
}

interface WizardConfigsStepProps {
  lang: Lang;
  onBack: () => void;
  onConvert: () => void;
}

export function WizardConfigsStep({ lang, onBack, onConvert }: WizardConfigsStepProps): React.JSX.Element {
  const starting = useAppStore((s) => s.starting);
  const disabled = useConvertDisabled();
  const BackArrow = lang === "fa" ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col gap-4" data-testid="wizard-step-2">
      <OptionsPanel />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          data-testid="wizard-back"
          className="flex h-[52px] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-5 text-sm font-bold text-zinc-600 transition-all duration-200 hover:bg-black/[0.03] active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.05]"
        >
          <BackArrow className="h-4 w-4" />
          <span>{translate(lang, "wizardBack")}</span>
        </button>
        <button
          type="button"
          onClick={onConvert}
          disabled={disabled}
          data-testid="wizard-convert"
          className="flex h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:brightness-105 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" strokeWidth={0} />
          )}
          <span>{translate(lang, "wizardConvertCta")}</span>
        </button>
      </div>
    </div>
  );
}
