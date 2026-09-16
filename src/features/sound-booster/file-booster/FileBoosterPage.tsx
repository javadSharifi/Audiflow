import React, { useEffect, useState } from "react";
import { useFileBooster } from "./hooks/useFileBooster";
import { UploadSection } from "./sections/UploadSection";
import { ConfigsSection } from "./sections/ConfigsSection";
import { ProgressSection } from "./sections/ProgressSection";
import { ResultSection } from "./sections/ResultSection";
import { mimeForOutput } from "../../../utils/format";
import { useAppStore } from "../../../stores/useAppStore";
import { fileToAssetUrl, shareAudioTrack, statMediaPaths } from "../../../utils/tauri";
import { openPath } from "@tauri-apps/plugin-opener";
import { isAndroid } from "../../../utils/platform";

export function FileBoosterPage(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const {
    file,
    preset,
    manualGainPercent,
    format,
    preview,
    activeAudition,
    isPlaying,
    currentTime,
    isPreviewGenerating,
    previewError,
    isExporting,
    exportProgress,
    exportSpeed,
    exportOutputs,
    exportError,
    pickFile,
    clearFile,
    setPreset,
    setManualGainPercent,
    setFormat,
    setActiveAudition,
    togglePlay,
    handleSeek,
    startExport,
  } = useFileBooster();

  const latestOutput = exportOutputs.length > 0 ? exportOutputs[0] : null;
  const [outputSizeBytes, setOutputSizeBytes] = useState<number | null>(null);
  const [outputAudioUrl, setOutputAudioUrl] = useState<string | null>(null);

  // Resolve size + playable URL once per completed export (latest result only)
  useEffect(() => {
    if (!latestOutput) {
      setOutputSizeBytes(null);
      setOutputAudioUrl(null);
      return;
    }
    let cancelled = false;
    void statMediaPaths([latestOutput])
      .then((stats) => {
        if (cancelled || stats.length === 0) return;
        setOutputSizeBytes(stats[0].sizeBytes);
      })
      .catch(() => {
        if (!cancelled) setOutputSizeBytes(null);
      });
    void fileToAssetUrl(latestOutput)
      .then((url) => {
        if (!cancelled) setOutputAudioUrl(url);
      })
      .catch(() => {
        if (!cancelled) setOutputAudioUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [latestOutput]);

  const outputName = latestOutput?.split(/[\\/]/).pop() ?? null;
  const outputDir = latestOutput?.replace(/[\\/][^\\/]+$/, "") ?? null;

  return (
    <div className="flex flex-col gap-4 pb-12">
      <UploadSection lang={lang} file={file} isExporting={isExporting} onPick={pickFile} onClear={clearFile} />

      <ConfigsSection
        lang={lang}
        file={file}
        preset={preset}
        manualGainPercent={manualGainPercent}
        format={format}
        preview={preview}
        activeAudition={activeAudition}
        isPlaying={isPlaying}
        currentTime={currentTime}
        isPreviewGenerating={isPreviewGenerating}
        previewError={previewError}
        isExporting={isExporting}
        onPreset={setPreset}
        onGain={setManualGainPercent}
        onFormat={setFormat}
        onAudition={setActiveAudition}
        onTogglePlay={togglePlay}
        onSeek={handleSeek}
        onExport={startExport}
      />

      <ProgressSection
        lang={lang}
        isExporting={isExporting}
        progress={exportProgress}
        speed={exportSpeed}
        error={exportError}
      />

      <ResultSection
        lang={lang}
        outputPath={latestOutput}
        outputName={outputName}
        dirPath={outputDir}
        outputSizeBytes={outputSizeBytes}
        originalSizeBytes={file?.sizeBytes ?? null}
        showOpenFolder={!isAndroid()}
        audioUrl={outputAudioUrl}
        onOpenFolder={() => {
          if (outputDir) void openPath(outputDir);
        }}
        onShare={() => {
          if (latestOutput && outputName) {
            void shareAudioTrack(latestOutput, outputName, mimeForOutput(latestOutput)).catch(() => {});
          }
        }}
        onCopyPath={() => {
          if (latestOutput && typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(latestOutput).catch(() => {});
          }
        }}
      />
    </div>
  );
}
