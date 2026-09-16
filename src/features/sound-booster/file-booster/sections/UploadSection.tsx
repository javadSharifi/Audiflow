import React from "react";
import { SectionShell } from "../../../../components/SectionShell";
import { formatBytes, formatDuration } from "../../../../utils/format";
import { translate, type Lang } from "../../../../i18n";
import type { FileBoosterState } from "../../shared/boosterTypes";

interface UploadSectionProps {
  lang: Lang;
  file: FileBoosterState["file"];
  isExporting: boolean;
  onPick: () => void;
  onClear: () => void;
}

export function UploadSection({ lang, file, isExporting, onPick, onClear }: UploadSectionProps): React.JSX.Element {
  return (
    <SectionShell step={1} titleKey="sectionUploadTitle" lang={lang} testId="booster-section-upload" state={file ? "ready" : "empty"}>
      <div className="flex flex-col gap-3">
        {!file ? (
          <div
            onClick={isExporting ? undefined : onPick}
            className="group relative flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-orange-500/25 bg-gradient-to-b from-orange-500/[0.04] to-transparent p-6 text-center shadow-sm transition-all duration-300 hover:border-orange-500/60 hover:bg-orange-500/[0.08] dark:border-orange-500/30 dark:hover:border-orange-500/70"
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500/20 via-amber-500/20 to-orange-500/30 text-2xl text-orange-600 shadow-md shadow-orange-500/10 transition-transform duration-300 group-hover:scale-110 dark:text-orange-400">
              ⚡
            </div>
            <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "selectBoosterFile")}
            </span>
            <span className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {translate(lang, "supportedFormatsDesc")}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-3xl border border-black/[0.08] bg-white/85 p-4 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/85">
            <div className="flex items-center gap-3.5 overflow-hidden">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500/20 to-amber-500/20 text-xl text-orange-600 shadow-sm dark:text-orange-400">
                🎵
              </div>
              <div className="flex flex-col truncate">
                <span className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {file.name}
                </span>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {formatDuration(file.durationSecs)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPick}
                disabled={isExporting}
                className="rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1] active:scale-95 transition-all"
              >
                {translate(lang, "changeFile")}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={isExporting}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-500/20 active:scale-95 transition-all"
                title={translate(lang, "removeFile")}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <p className="text-xs leading-5 font-medium text-zinc-500 dark:text-zinc-400">
          {translate(lang, "uploadExplainer")}
        </p>
      </div>
    </SectionShell>
  );
}
