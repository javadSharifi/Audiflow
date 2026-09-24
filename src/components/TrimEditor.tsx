import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import { parseTimeInput } from "../utils/format";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { InputFile } from "../types";
import {
  WaveformCanvas,
  WaveformAccessibleHandles,
  useWaveformAudio,
  useWaveformInteraction,
  useWaveformLoader,
  applySelectionBound,
} from "./waveform";
import { TrimTimeSummary } from "./TrimTimeSummary";

export function TrimEditor({ file }: { file: InputFile }): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const setTrim = useAppStore((s) => s.setTrim);
  const pushToast = useAppStore((s) => s.pushToast);
  const updateFileMeta = useAppStore((s) => s.updateFileMeta);

  const wrapRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [opStatus, setOpStatus] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const selStart = file.trimStartSecs ?? null;
  const selEnd = file.trimEndSecs ?? null;
  const hasSelection = selStart != null || selEnd != null;

  // ---- Waveform & Audio Source Loading -----------------------------------
  const { peaks, waveErr, srcUrl, setSrcUrl, duration } = useWaveformLoader({
    path: file.path,
    durationSecs: file.durationSecs,
    onDurationProbed: (probedDur) => {
      updateFileMeta(file.path, { durationSecs: probedDur });
    },
  });

  const effectiveStart = selStart ?? 0;
  const effectiveEnd = selEnd ?? duration;

  // ---- Audio Audition & Selection Playback --------------------------------
  const {
    playing,
    audition,
    stopAudition,
    playRange,
    playSelection,
    onAudioTimeUpdate,
    onAudioEnded,
    handleAudioError,
  } = useWaveformAudio({
    audioRef,
    srcUrl,
    duration,
    selStart: effectiveStart,
    selEnd: effectiveEnd,
    scrubOffset: 0.08,
    resetOnEnd: "end",
    onAudioError: () => setSrcUrl(null),
  });

  useEffect(() => stopAudition, [stopAudition, file.path]);

  // ---- Drag & Pointer Interaction ----------------------------------------
  const applyBound = useCallback(
    (which: "start" | "end", t: number) => {
      const bounds = applySelectionBound(which, t, effectiveStart, effectiveEnd, duration, 0.05);
      if (which === "start") {
        setTrim(file.path, "trimStartSecs", bounds.start);
      } else {
        setTrim(file.path, "trimEndSecs", bounds.end);
      }
    },
    [duration, effectiveEnd, effectiveStart, file.path, setTrim],
  );

  const {
    draggingRef,
    onPointerDown,
    onPointerMove,
    endDrag,
  } = useWaveformInteraction({
    wrapRef,
    duration,
    peaks,
    selStart: effectiveStart,
    selEnd: effectiveEnd,
    hasSelection,
    hitRadiusPx: 22,
    onApplyBound: applyBound,
    onAudition: audition,
    onStopAudition: stopAudition,
    onPlaySelection: playSelection,
  });

  // ---- Actions & Steppers ------------------------------------------------
  const previewFirst5 = useCallback(() => {
    const a = audioRef.current;
    const effDur = a && Number.isFinite(a.duration) && a.duration > 0 ? Math.min(duration, a.duration) : duration;
    playRange(effectiveStart, Math.min(effectiveStart + 5, selEnd ?? effDur));
  }, [duration, effectiveStart, playRange, selEnd]);

  const previewLast5 = useCallback(() => {
    const a = audioRef.current;
    const effDur = a && Number.isFinite(a.duration) && a.duration > 0 ? Math.min(duration, a.duration) : duration;
    const end = selEnd ?? effDur;
    playRange(Math.max(end - 5, effectiveStart), end);
  }, [duration, effectiveStart, playRange, selEnd]);

  const clearTrim = useCallback(() => {
    setTrim(file.path, "trimStartSecs", null);
    setTrim(file.path, "trimEndSecs", null);
    stopAudition();
    setOpStatus({ kind: "success", msg: translate(lang, "trimStatusCleared") });
  }, [file.path, lang, setTrim, stopAudition]);

  const stepBound = useCallback(
    (which: "start" | "end", delta: number) => {
      const cur = which === "start" ? effectiveStart : effectiveEnd;
      applyBound(which, cur + delta);
      setOpStatus({ kind: "success", msg: translate(lang, "trimStatusApplied") });
    },
    [applyBound, effectiveEnd, effectiveStart, lang],
  );

  const grabHandle = useCallback(
    (which: "start" | "end") => {
      if (peaks == null || duration <= 0) return;
      draggingRef.current = which;
      audition(which === "start" ? effectiveStart : effectiveEnd);
    },
    [audition, draggingRef, duration, effectiveEnd, effectiveStart, peaks],
  );

  const commitText = (field: "trimStartSecs" | "trimEndSecs", raw: string) => {
    if (raw.trim() === "") {
      setTrim(file.path, field, null);
      setOpStatus({ kind: "success", msg: translate(lang, "trimStatusCleared") });
      return;
    }
    const secs = parseTimeInput(raw);
    if (secs == null) {
      pushToast("error", "errTrimInvalid");
      setOpStatus({ kind: "error", msg: translate(lang, "errTrimInvalid") });
      return;
    }
    applyBound(field === "trimStartSecs" ? "start" : "end", secs);
    setOpStatus({ kind: "success", msg: translate(lang, "trimStatusApplied") });
  };

  if (!file.hasAudio) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section: tools ── */}
      <div className="flex flex-col gap-2">
        <button
          onClick={playSelection}
          disabled={!srcUrl}
          data-testid={`trim-play-${file.name}`}
          className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-orange-500"
          aria-label={translate(lang, "trimPlay")}
          title={srcUrl ? undefined : translate(lang, "trimPreviewUnavailable")}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5 shrink-0 fill-current" strokeWidth={0} />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0 fill-current" strokeWidth={0} />
          )}
          <span className="truncate">{translate(lang, "trimPlay")}</span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          {duration >= 5.05 && (
            <>
              <button
                onClick={previewFirst5}
                disabled={!srcUrl}
                data-testid={`trim-cut-first-${file.name}`}
                className="glass-card flex min-h-[44px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 py-2.5 text-xs font-semibold text-zinc-700 transition-all hover:border-orange-400 hover:text-orange-600 active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#CBD5E1]"
                title={translate(lang, "trimCutFirst5Tip")}
              >
                <Play className="h-3 w-3 shrink-0 fill-current" strokeWidth={0} />
                <span className="truncate">{translate(lang, "trimCutFirst5")}</span>
              </button>
              <button
                onClick={previewLast5}
                disabled={!srcUrl}
                data-testid={`trim-cut-last-${file.name}`}
                className="glass-card flex min-h-[44px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 py-2.5 text-xs font-semibold text-zinc-700 transition-all hover:border-orange-400 hover:text-orange-600 active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#CBD5E1]"
                title={translate(lang, "trimCutLast5Tip")}
              >
                <Play className="h-3 w-3 shrink-0 fill-current" strokeWidth={0} />
                <span className="truncate">{translate(lang, "trimCutLast5")}</span>
              </button>
            </>
          )}

          {hasSelection ? (
            <button
              onClick={clearTrim}
              data-testid={`trim-clear-${file.name}`}
              className={`${duration >= 5.05 ? "" : "col-span-3"} flex min-h-[44px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-black/10 bg-transparent px-2 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-slate-400 active:scale-95 focus-visible:outline-2 focus-visible:outline-orange-500 dark:border-white/15 dark:text-[#CBD5E1]`}
            >
              <RotateCcw className="h-3 w-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate">{translate(lang, "trimClear")}</span>
            </button>
          ) : duration < 5.05 ? null : (
            <span className="flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-dashed border-black/10 px-2 py-2.5 text-[11px] text-slate-500 dark:border-white/10 dark:text-[#CBD5E1]">
              {translate(lang, "trimFullFile")}
            </span>
          )}
        </div>
      </div>

      {/* ── Section: waveform ── */}
      <WaveformCanvas
        wrapRef={wrapRef}
        peaks={peaks}
        waveErr={waveErr}
        duration={duration}
        selStart={effectiveStart}
        selEnd={effectiveEnd}
        audioRef={audioRef}
        playing={playing}
        draggingRef={draggingRef}
        canvasHeight={104}
        gripStyle="pill-dots"
        testId={`trim-editor-${file.name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <WaveformAccessibleHandles
          duration={duration}
          selStart={effectiveStart}
          selEnd={effectiveEnd}
          onGrab={grabHandle}
          onStep={stepBound}
        />
      </WaveformCanvas>

      <p className="text-center text-[11px] font-medium text-slate-500 dark:text-zinc-400">
        {translate(lang, "trimWaveformHint")}
      </p>

      {/* ── Section: summary ── */}
      <TrimTimeSummary
        filePath={file.path}
        fileName={file.name}
        duration={duration}
        selStart={selStart}
        selEnd={selEnd}
        onCommitText={commitText}
      />

      {opStatus && (
        <div
          role={opStatus.kind === "error" ? "alert" : "status"}
          aria-live={opStatus.kind === "error" ? "assertive" : "polite"}
          className={`text-xs font-medium ${opStatus.kind === "error" ? "text-red-500" : "text-slate-600 dark:text-[#CBD5E1]"}`}
        >
          {opStatus.msg}
        </div>
      )}

      {srcUrl && (
        <audio
          ref={audioRef}
          src={srcUrl}
          preload="auto"
          onTimeUpdate={onAudioTimeUpdate}
          onEnded={onAudioEnded}
          onError={handleAudioError}
        />
      )}
    </div>
  );
}
