import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { formatTimecode, parseTimeInput } from "../../utils/format";
import { isAndroid } from "../../utils/platform";
import { Sparkles } from "lucide-react";
import type { AudioTrackInfo } from "../../types";
import {
  WaveformCanvas,
  formatClock,
  applySelectionBound,
  useWaveformAudio,
  useWaveformInteraction,
  useWaveformLoader,
} from "../waveform";
import { RingtoneModalHeader } from "./RingtoneModalHeader";
import { RingtonePresetsBar } from "./RingtonePresetsBar";
import { RingtoneSteppersBar } from "./RingtoneSteppersBar";
import { RingtoneConfirmActions } from "./RingtoneConfirmActions";

interface SetRingtoneModalProps {
  track: AudioTrackInfo;
  onClose: () => void;
}

export function SetRingtoneModal({ track, onClose }: SetRingtoneModalProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const pushToast = useAppStore((s) => s.pushToast);
  const setRingtone = useMusicPlayerStore((s) => s.setRingtone);
  const pauseGlobalTrack = useMusicPlayerStore((s) => s.pauseTrack);

  const wrapRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const initialDuration = Math.max(5, track.durationSecs || 180);
  const [selStart, setSelStart] = useState<number>(0);
  const [selEnd, setSelEnd] = useState<number>(Math.min(30, initialDuration));
  const [isSetting, setIsSetting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    pauseGlobalTrack();
  }, [pauseGlobalTrack]);

  // ---- Audio Source & Waveform Loading ------------------------------------
  const trackPath = track.path || track.uri;
  const { peaks, waveErr, srcUrl, setSrcUrl, duration } = useWaveformLoader({
    path: trackPath,
    durationSecs: initialDuration,
    syntheticFallback: true,
  });

  // ---- Audio Audition & Selection Playback --------------------------------
  const {
    playing,
    audition,
    stopAudition,
    playSelection,
    onAudioTimeUpdate,
    onAudioEnded,
    handleAudioError,
  } = useWaveformAudio({
    audioRef,
    srcUrl,
    duration,
    selStart,
    selEnd,
    scrubOffset: 0.05,
    resetOnEnd: "start",
    onAudioError: () => setSrcUrl(null),
  });

  useEffect(() => stopAudition, [stopAudition]);

  // ---- Pointer Interactions & Dragging -----------------------------------
  const applyBound = useCallback(
    (which: "start" | "end", t: number) => {
      const bounds = applySelectionBound(which, t, selStart, selEnd, duration, 0.5);
      if (which === "start") {
        setSelStart(bounds.start);
        if (audioRef.current) {
          try {
            audioRef.current.currentTime = bounds.start;
          } catch {
            /* ignore */
          }
        }
      } else {
        setSelEnd(bounds.end);
      }
    },
    [duration, selEnd, selStart],
  );

  const onDragEnd = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      try {
        audioRef.current.currentTime = selStart;
      } catch {
        /* ignore */
      }
    }
  }, [selStart]);

  const {
    draggingRef,
    onPointerDown,
    onPointerMove,
    endDrag,
  } = useWaveformInteraction({
    wrapRef,
    duration,
    peaks,
    selStart,
    selEnd,
    hasSelection: true,
    hitRadiusPx: 24,
    onApplyBound: applyBound,
    onAudition: audition,
    onStopAudition: stopAudition,
    onPlaySelection: playSelection,
    onDragEnd,
  });

  // ---- Presets & Steppers ------------------------------------------------
  const handleApplyPreset = (presetSecs: number) => {
    stopAudition();
    setSelStart(0);
    setSelEnd(Math.min(duration, presetSecs));
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  };

  const adjustBound = (field: "start" | "end", delta: number) => {
    applyBound(field, (field === "start" ? selStart : selEnd) + delta);
  };

  const commitText = (field: "start" | "end", raw: string) => {
    const secs = parseTimeInput(raw);
    if (secs == null) {
      pushToast("error", translate(lang, "errTrimInvalid"));
      return;
    }
    applyBound(field, secs);
  };

  // ---- Ringtone Export & Confirm Action ----------------------------------
  const handleConfirmSetRingtone = async () => {
    if (!isAndroid()) {
      pushToast("info", translate(lang, "ringtoneMobileOnly"));
      onClose();
      return;
    }

    setIsSetting(true);
    try {
      stopAudition();
      await setRingtone(track);
      setIsSuccess(true);
      pushToast("info", translate(lang, "ringtoneSetSuccess"));
      setTimeout(() => onClose(), 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "PERMISSION_REQUIRED") {
        pushToast("warning", translate(lang, "ringtonePermissionRequired"));
      } else {
        console.warn("Set ringtone failed:", msg);
      }
    } finally {
      setIsSetting(false);
    }
  };

  const selLen = Math.max(0, selEnd - selStart);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white/95 dark:bg-zinc-900/95 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-2xl p-4 sm:p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-250 ease-out overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* 1. Header (Title + Track Info + Close) */}
        <RingtoneModalHeader track={track} onClose={onClose} />

        {/* 2. Quick Presets (Segmented Pill Bar) */}
        <RingtonePresetsBar
          duration={duration}
          selStart={selStart}
          selEnd={selEnd}
          onApplyPreset={handleApplyPreset}
          onFullPreset={() => handleApplyPreset(duration)}
        />

        {/* 3. Waveform Canvas Surface with Handles */}
        <div className="relative flex flex-col gap-1.5">
          <WaveformCanvas
            wrapRef={wrapRef}
            peaks={peaks}
            waveErr={waveErr}
            duration={duration}
            selStart={selStart}
            selEnd={selEnd}
            audioRef={audioRef}
            playing={playing}
            draggingRef={draggingRef}
            canvasHeight={120}
            gripStyle="pill-lines"
            className="bg-black/[0.04] dark:bg-black/50 shadow-inner"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="absolute top-2 left-3 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-amber-400 border border-amber-400/20 pointer-events-none">
              {formatClock(selStart)}
            </div>
            <div className="absolute top-2 right-3 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-amber-400 border border-amber-400/20 pointer-events-none">
              {formatClock(selEnd)}
            </div>
          </WaveformCanvas>
        </div>

        {/* 4. Fine-Tuning Steppers & Large Preview Button */}
        <RingtoneSteppersBar
          duration={duration}
          selStart={selStart}
          selEnd={selEnd}
          playing={playing}
          canPlay={Boolean(srcUrl)}
          onAdjustBound={adjustBound}
          onCommitText={commitText}
          onTogglePlay={playSelection}
        />

        {/* Selected Duration Banner */}
        <div className="flex items-center justify-between text-xs px-1 text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{translate(lang, "selectedDuration")}:</span>
            <span className="font-mono text-xs">{formatTimecode(selLen)}</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">
            {formatClock(selStart)} → {formatClock(selEnd)} ({formatClock(duration)})
          </span>
        </div>

        {/* 5. Bottom Confirm Actions */}
        <RingtoneConfirmActions
          isSetting={isSetting}
          isSuccess={isSuccess}
          onClose={onClose}
          onConfirm={handleConfirmSetRingtone}
        />

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
    </div>,
    document.body,
  );
}
