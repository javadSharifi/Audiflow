import React, { useState } from "react";
import { SectionShell } from "../../../../components/SectionShell";
import { formatBytes } from "../../../../utils/format";
import { translate, type Lang } from "../../../../i18n";

interface ResultSectionProps {
  lang: Lang;
  outputPath: string | null;
  outputName: string | null;
  dirPath: string | null;
  outputSizeBytes: number | null;
  originalSizeBytes: number | null;
  showOpenFolder: boolean;
  audioUrl: string | null;
  onOpenFolder: () => void;
  onShare: () => void;
  onCopyPath: () => void;
}

export function ResultSection(props: ResultSectionProps): React.JSX.Element {
  const { lang, outputPath, outputName, dirPath, outputSizeBytes, originalSizeBytes } = props;
  const [copied, setCopied] = useState(false);
  const done = outputPath != null && outputSizeBytes != null;

  let delta: string | null = null;
  if (done && originalSizeBytes != null) {
    const diff = outputSizeBytes - originalSizeBytes;
    if (diff === 0) {
      delta = translate(lang, "resultSameSize");
    } else if (diff < 0) {
      delta = translate(lang, "resultSmaller", { amount: formatBytes(-diff) });
    } else {
      delta = translate(lang, "resultLarger", { amount: formatBytes(diff) });
    }
  }

  const handleCopy = () => {
    props.onCopyPath();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SectionShell step={4} titleKey="sectionResultTitle" lang={lang} testId="booster-section-result" state={done ? "done" : "empty"}>
      {!done ? (
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {translate(lang, "resultEmpty")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-500/10 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-lg">
              ✓
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {outputName}
              </span>
              <span className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {translate(lang, "resultLocation")}: <span className="font-bold">{dirPath}</span>
              </span>
              <span className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {translate(lang, "resultSize")}: <span className="font-bold">{formatBytes(outputSizeBytes)}</span>
                {delta ? <span> · {delta}</span> : null}
              </span>
            </div>
          </div>

          {props.audioUrl && (
            <audio controls src={props.audioUrl} className="w-full" aria-label={translate(lang, "resultPlay")} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {props.showOpenFolder && (
              <button
                type="button"
                onClick={props.onOpenFolder}
                className="rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1] active:scale-95 transition-all"
              >
                {translate(lang, "openOutputFolder")}
              </button>
            )}
            <button
              type="button"
              onClick={props.onShare}
              className="rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1] active:scale-95 transition-all"
            >
              {translate(lang, "resultShare")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1] active:scale-95 transition-all"
            >
              {copied ? translate(lang, "resultCopied") : translate(lang, "resultCopyPath")}
            </button>
          </div>
        </div>
      )}
    </SectionShell>
  );
}
