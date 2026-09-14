import { FileAudio, Loader2, X, KeyRound } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribe } from "./hooks/useTranscribe";
import { OnboardingCard } from "./OnboardingCard";
import { LanguageSelect } from "./LanguageSelect";
import { ModeToggle } from "./ModeToggle";
import { DiarizationToggle } from "./DiarizationToggle";
import { TimestampToggle } from "./TimestampToggle";
import { FastModeToggle } from "./FastModeToggle";
import { CustomVocabularyInput } from "./CustomVocabularyInput";
import { TranscribeConsentSheet } from "./TranscribeConsentSheet";
import { TranscriptResultView } from "./TranscriptResultView";
import { UsageDashboard } from "./UsageDashboard";
import { ErrorBanner } from "./ErrorBanner";

const STATUS_KEY: Record<string, string> = {
  waiting: "statusWaiting",
  preprocessing: "txStatusPreprocessing",
  uploading: "txStatusUploading",
  transcribing: "txStatusTranscribing",
};

function fmtDur(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscribePage(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const t = useTranscribe();
  const busy =
    t.jobStatus === "waiting" ||
    t.jobStatus === "preprocessing" ||
    t.jobStatus === "uploading" ||
    t.jobStatus === "transcribing";

  if (t.hasKey === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!t.hasKey) {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-5 pb-24">
        <OnboardingCard onVerify={t.verifyAndSave} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-5 pb-24">
      {/* File picker */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
        {t.file ? (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <FileAudio className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold" dir="auto">{t.file.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-400" dir="ltr">
                {fmtDur(t.file.durationSecs)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => t.pickFile()}
              className="shrink-0 rounded-xl border border-black/10 px-3 py-1.5 text-[11px] font-semibold dark:border-white/10"
            >
              {translate(lang, "txChangeFile" as never)}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void t.pickFile()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-black/15 py-8 text-zinc-500 dark:border-white/15 dark:text-zinc-400"
          >
            <FileAudio className="h-7 w-7" />
            <span className="text-xs font-semibold">{translate(lang, "txPickFile" as never)}</span>
          </button>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-4 rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
        <LanguageSelect />
        <ModeToggle />
        <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />
        <DiarizationToggle />
        <TimestampToggle />
        <FastModeToggle />
        <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />
        <CustomVocabularyInput />
      </div>

      {/* Start / progress */}
      {t.jobStatus && t.jobStatus !== "completed" ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-semibold">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> : null}
              {translate(lang, (STATUS_KEY[t.jobStatus] ?? "statusProcessing") as never)}
              {t.jobPercent != null ? (
                <span className="font-mono text-[11px] text-zinc-400" dir="ltr">
                  {Math.round(t.jobPercent)}%
                </span>
              ) : null}
            </span>
            {busy ? (
              <button
                type="button"
                onClick={t.cancel}
                className="inline-flex items-center gap-1 rounded-xl border border-black/10 px-3 py-1.5 text-[11px] font-semibold dark:border-white/10"
              >
                <X className="h-3 w-3" />
                {translate(lang, "cancel")}
              </button>
            ) : null}
          </div>
          {t.jobPercent != null ? (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, t.jobPercent))}%` }}
              />
            </div>
          ) : null}
          {!busy && t.jobStatus === "failed" ? (
            <div className="mt-3">
              <ErrorBanner kind={t.jobErrorKind} message={t.jobErrorMessage} technical={t.jobTechnical} />
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={!t.file || busy}
          onClick={() => void t.start()}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-105 active:scale-[0.985] disabled:opacity-40"
        >
          {translate(lang, "txStart" as never)}
        </button>
      )}

      {/* Result */}
      {t.result ? (
        <TranscriptResultView result={t.result} onCopy={t.copyTranscript} onExport={(f) => void t.exportAs(f)} />
      ) : null}

      <UsageDashboard usage={t.usage} />

      <button
        type="button"
        onClick={() => void t.clearKey()}
        className="mx-auto inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <KeyRound className="h-3 w-3" />
        {translate(lang, "txRemoveKey" as never)}
      </button>

      {t.showConsent ? <TranscribeConsentSheet onAccept={() => { t.acceptConsent(); void t.start(); }} /> : null}
    </div>
  );
}
