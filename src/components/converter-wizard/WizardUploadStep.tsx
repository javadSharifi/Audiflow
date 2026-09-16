import { ArrowLeft, ArrowRight, FolderUp } from "lucide-react";
import { DropZone } from "../DropZone";
import { FileList } from "../FileList";
import { translate, type Lang } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

interface WizardUploadStepProps {
  lang: Lang;
  onNext: () => void;
}

export function WizardUploadStep({ lang, onNext }: WizardUploadStepProps): React.JSX.Element {
  const files = useAppStore((s) => s.files);
  const validCount = files.filter((f) => !f.error && f.hasAudio).length;
  const canNext = validCount > 0;
  const Arrow = lang === "fa" ? ArrowLeft : ArrowRight;

  return (
    <div className="flex flex-col gap-4" data-testid="wizard-step-1">
      {files.length === 0 ? (
        <DropZone />
      ) : (
        <div className="glass-panel flex flex-col gap-3 rounded-3xl p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              <FolderUp className="h-4 w-4 text-orange-500" />
              {translate(lang, "wizardStepUpload")}
            </h2>
            <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {validCount}/{files.length}
            </span>
          </div>
          <FileList />
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        data-testid="wizard-next"
        title={!canNext ? translate(lang, "wizardAddFilesFirst") : undefined}
        className="group flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:brightness-105 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        <span>{translate(lang, "wizardNext")}</span>
        <Arrow className="h-4 w-4" />
      </button>
      {!canNext && (
        <p className="text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          {translate(lang, "wizardAddFilesFirst")}
        </p>
      )}
    </div>
  );
}
