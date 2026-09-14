import { useState } from "react";
import { Copy, Check, FileDown } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore, type ExportFormat } from "./stores/useTranscribeStore";
import type { TranscriptionResult } from "../../types";
import { ErrorBanner } from "./ErrorBanner";

const SPEAKER_STYLES = [
  "bg-orange-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-indigo-500",
];

function speakerColor(speaker: string | null | undefined): string {
  if (!speaker) return "bg-zinc-400";
  let h = 0;
  for (let i = 0; i < speaker.length; i++) h = (h * 31 + speaker.charCodeAt(i)) >>> 0;
  return SPEAKER_STYLES[h % SPEAKER_STYLES.length];
}

export function TranscriptResultView({
  result,
  onCopy,
  onExport,
}: {
  result: TranscriptionResult;
  onCopy: () => Promise<boolean>;
  onExport: (f: ExportFormat) => void;
}): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const exporting = useTranscribeStore((s) => s.exporting);
  const exportedPath = useTranscribeStore((s) => s.exportedPath);
  const exportError = useTranscribeStore((s) => s.exportError);
  const jobErrorKind = useTranscribeStore((s) => s.jobErrorKind);
  const jobErrorMessage = useTranscribeStore((s) => s.jobErrorMessage);
  const jobTechnical = useTranscribeStore((s) => s.jobTechnical);
  const hasTimestamps = result.words != null && result.words.length > 0;
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    if (await onCopy()) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const formats: ExportFormat[] = ["txt", "srt", "vtt"];

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner kind={jobErrorKind} message={jobErrorMessage} technical={jobTechnical} />
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold">{translate(lang, "txResult" as never)}</h3>
          {result.languageDetected ? (
            <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-white/[0.07] dark:text-zinc-400" dir="ltr">
              {result.languageDetected}
            </span>
          ) : null}
        </div>
        <p className="mt-2 max-h-64 overflow-y-auto text-[13px] leading-loose whitespace-pre-wrap" dir="auto">
          {result.fullText}
        </p>
        {hasTimestamps ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            {Array.from(new Set(result.words!.map((w) => w.speaker).filter(Boolean))).map((sp) => (
              <span key={sp as string} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className={`h-2 w-2 rounded-full ${speakerColor(sp)}`} />
                <span dir="ltr" className="font-mono">{sp}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void doCopy()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-1.5 text-[11px] font-semibold dark:border-white/10"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {translate(lang, (copied ? "txCopied" : "txCopy") as never)}
          </button>
          {formats.map((f) => {
            const disabled = f !== "txt" && !hasTimestamps;
            return (
              <button
                key={f}
                type="button"
                disabled={disabled || exporting !== null}
                title={disabled ? translate(lang, "txSrtNeedsTimestamps" as never) : undefined}
                onClick={() => onExport(f)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase disabled:opacity-40 dark:border-white/10"
              >
                <FileDown className="h-3.5 w-3.5" />
                {exporting === f ? "…" : f}
              </button>
            );
          })}
        </div>
        {exportedPath ? (
          <p className="mt-2 truncate text-[11px] text-emerald-600 dark:text-emerald-400" dir="auto">
            ✓ {exportedPath}
          </p>
        ) : null}
        {exportError ? <p className="mt-2 text-[11px] text-red-500" dir="auto">{exportError}</p> : null}
      </div>
    </div>
  );
}
