import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FolderUp, Film, X } from "lucide-react";
import { DropZone } from "../DropZone";
import { FileList } from "../FileList";
import { translate, type Lang } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";
import { isAndroid } from "../../utils/platform";
import { getVideoPermissionStatus, requestVideoPermissions, openAppSettings } from "../../utils/tauri";

interface WizardUploadStepProps {
  lang: Lang;
  onNext: () => void;
}

export function WizardUploadStep({ lang, onNext }: WizardUploadStepProps): React.JSX.Element {
  const files = useAppStore((s) => s.files);
  const validCount = files.filter((f) => !f.error && f.hasAudio).length;
  const canNext = validCount > 0;
  const Arrow = lang === "fa" ? ArrowLeft : ArrowRight;

  const [videoPermStatus, setVideoPermStatus] = useState<string>("granted");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAndroid()) return;
    const check = () => {
      void getVideoPermissionStatus().then(setVideoPermStatus);
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const handleRequestPerm = async () => {
    if (videoPermStatus === "permanentlyDenied") {
      try {
        openAppSettings();
      } catch (err) {
        console.warn("Open settings failed:", err);
      }
      return;
    }
    requestVideoPermissions();
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 800));
      const s = await getVideoPermissionStatus();
      setVideoPermStatus(s);
      if (s === "granted") break;
    }
  };

  const showBanner =
    isAndroid() &&
    (videoPermStatus === "denied" || videoPermStatus === "permanentlyDenied") &&
    !dismissed;

  return (
    <div className="flex flex-col gap-4" data-testid="wizard-step-1">
      {showBanner && (
        <div
          role="region"
          aria-label={translate(lang, "converterVideoPermBanner")}
          className="shrink-0 flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-950 dark:text-amber-100 shadow-sm transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Film className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold leading-relaxed">
              {translate(lang, "converterVideoPermBanner")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleRequestPerm()}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
            >
              {videoPermStatus === "permanentlyDenied"
                ? translate(lang, "onboardingPermOpenSettings")
                : translate(lang, "converterVideoPermAction")}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
