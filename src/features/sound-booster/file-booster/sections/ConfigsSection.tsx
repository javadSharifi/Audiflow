import React from "react";
import { SectionShell } from "../../../../components/SectionShell";
import { PresetSelector } from "../PresetSelector";
import { GainSlider } from "../GainSlider";
import { ABPreview } from "../ABPreview";
import { translate, type Lang } from "../../../../i18n";
import type {
  AbPreviewResult,
  AudioFormat,
  BoosterPreset,
} from "../../../../types";
import type { FileBoosterState } from "../../shared/boosterTypes";

interface ConfigsSectionProps {
  lang: Lang;
  file: FileBoosterState["file"];
  preset: BoosterPreset;
  manualGainPercent: number;
  format: AudioFormat;
  preview: AbPreviewResult | null;
  activeAudition: "original" | "boosted" | null;
  isPlaying: boolean;
  currentTime: number;
  isPreviewGenerating: boolean;
  previewError: string | null;
  isExporting: boolean;
  onPreset: (preset: BoosterPreset) => void;
  onGain: (percent: number) => void;
  onFormat: (format: AudioFormat) => void;
  onAudition: (audition: "original" | "boosted") => void;
  onTogglePlay: () => void;
  onSeek: (timeSecs: number) => void;
  onExport: () => void;
}

const FORMATS: AudioFormat[] = ["mp3", "m4a", "wav", "aac", "flac", "opus"];

export function ConfigsSection(props: ConfigsSectionProps): React.JSX.Element {
  const { lang, file, preset, manualGainPercent, format, isExporting } = props;
  const locked = !file || isExporting;
  const state = !file ? "disabled" : isExporting ? "locked" : "ready";

  return (
    <SectionShell step={2} titleKey="sectionConfigsTitle" lang={lang} testId="booster-section-configs" state={state}>
      <div className="flex flex-col gap-4">
        {!file && (
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            {translate(lang, "uploadFirstHint")}
          </p>
        )}

        <PresetSelector activePreset={preset} onSelectPreset={props.onPreset} disabled={locked} />

        {preset === "manual" && (
          <GainSlider gainPercent={manualGainPercent} onChangeGain={props.onGain} disabled={locked} />
        )}

        <ABPreview
          preview={props.preview}
          activeAudition={props.activeAudition}
          onSelectAudition={props.onAudition}
          isPlaying={props.isPlaying}
          onTogglePlay={props.onTogglePlay}
          isLoading={props.isPreviewGenerating}
          currentTime={props.currentTime}
          duration={props.preview?.snippetDurationSecs || 12}
          onSeek={props.onSeek}
          error={props.previewError}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {translate(lang, "format")}
          </span>
          <div className="flex gap-1.5">
            {FORMATS.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => props.onFormat(fmt)}
                disabled={isExporting}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-black uppercase transition-all active:scale-95 ${
                  format === fmt
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                    : "bg-black/[0.04] text-zinc-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1]"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!file || isExporting}
          onClick={props.onExport}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-orange-500/25 transition-all duration-200 hover:brightness-105 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>⚡</span>
          <span>
            {isExporting ? translate(lang, "statusProcessing") : translate(lang, "exportBoostedAudio")}
          </span>
        </button>
      </div>
    </SectionShell>
  );
}
