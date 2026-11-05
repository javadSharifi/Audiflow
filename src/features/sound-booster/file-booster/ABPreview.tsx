import React, { useRef, useState, useEffect, useCallback } from "react";
import { Volume1, Volume2, Play, Pause, AlertTriangle, Loader2 } from "lucide-react";
import type { AbPreviewResult } from "../../../types";
import { translate } from "../../../i18n";
import { useAppStore } from "../../../stores/useAppStore";
import { formatTimecode } from "../../../utils/format";
import * as api from "../../../utils/tauri";

export interface ABPreviewProps {
  preview: AbPreviewResult | null;
  activeAudition?: "original" | "boosted";
  onSelectAudition?: (mode: "original" | "boosted") => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  isLoading?: boolean;
  currentTime?: number;
  duration?: number;
  onSeek?: (timeSecs: number) => void;
  error?: string | null;
}

interface WaveformVisualizerProps {
  peaks: ([(number | null), (number | null)])[];
  isBoosted: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek?: (timeSecs: number) => void;
}

function WaveformVisualizer({
  peaks,
  isBoosted,
  isPlaying,
  currentTime,
  duration,
  onSeek,
}: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const safeDuration = duration > 0 ? duration : 15;
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  // Sample 48 smooth bars for detailed visual waveform
  const count = 48;
  const step = peaks.length > 0 ? Math.max(1, Math.floor(peaks.length / count)) : 1;
  const sampled = peaks.length > 0
    ? peaks.filter((_, i) => i % step === 0).slice(0, count)
    : Array(count).fill([0.2, 0.2]);

  const handlePointerSeek = useCallback(
    (clientX: number) => {
      if (!containerRef.current || !onSeek) return;
      const rect = containerRef.current.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(frac * safeDuration);
    },
    [onSeek, safeDuration],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerSeek(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPct(frac * 100);

    if (e.buttons === 1) {
      handlePointerSeek(e.clientX);
    }
  };

  return (
    <div
      dir="ltr"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverPct(null)}
      className="group relative flex h-10 w-full cursor-pointer select-none items-center justify-between gap-[2px] rounded-xl bg-black/[0.04] px-2 py-1 transition-colors hover:bg-black/[0.07] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
      title="Click or drag to seek"
    >
      {/* Waveform Bars */}
      {sampled.map((peak, idx) => {
        const min = peak[0] ?? 0;
        const max = peak[1] ?? 0;
        const amp = Math.max(Math.abs(min), Math.abs(max));
        const heightPct = Math.max(14, Math.min(100, Math.round(amp * 100)));
        const barPosPct = (idx / (count - 1)) * 100;
        const isPassed = barPosPct <= progressPct;

        return (
          <div
            key={idx}
            style={{ height: `${heightPct}%` }}
            className={`w-[3px] rounded-full transition-all duration-75 ${
              isPassed
                ? isBoosted
                  ? "bg-gradient-to-t from-orange-600 to-amber-400 dark:from-orange-500 dark:to-amber-300 shadow-[0_0_6px_rgba(249,115,22,0.4)]"
                  : "bg-zinc-700 dark:bg-zinc-200"
                : isBoosted
                ? "bg-orange-500/25 dark:bg-orange-400/20"
                : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
        );
      })}

      {/* Real-time Playhead Indicator */}
      <div
        className={`pointer-events-none absolute top-1 bottom-1 w-0.5 rounded-full bg-white transition-[left] duration-75 ${
          isPlaying ? "shadow-[0_0_10px_rgba(255,255,255,1)]" : "shadow-[0_0_4px_rgba(255,255,255,0.6)]"
        }`}
        style={{ left: `${progressPct}%` }}
      >
        <div
          className={`absolute -top-1 -left-[3px] h-2 w-2 rounded-full bg-white shadow-sm ${
            isPlaying ? "scale-110" : "scale-100"
          } transition-transform`}
        />
      </div>

      {/* Hover scrubber ghost line */}
      {hoverPct !== null && (
        <div
          className="pointer-events-none absolute top-1 bottom-1 w-px bg-orange-400/60"
          style={{ left: `${hoverPct}%` }}
        />
      )}
    </div>
  );
}

export function ABPreview({
  preview,
  activeAudition: controlledAudition,
  onSelectAudition,
  isPlaying: controlledIsPlaying,
  onTogglePlay,
  isLoading = false,
  currentTime: controlledCurrentTime,
  duration,
  onSeek: controlledOnSeek,
  error,
}: ABPreviewProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Internal state for self-contained, robust DOM-driven audio
  const [internalAudition, setInternalAudition] = useState<"original" | "boosted">("boosted");
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const activeAudition = controlledAudition ?? internalAudition;
  const isBoosted = activeAudition === "boosted";
  const isPlaying = controlledIsPlaying !== undefined ? controlledIsPlaying : internalIsPlaying;
  const currentTime = controlledCurrentTime !== undefined ? controlledCurrentTime : internalCurrentTime;

  const effectiveDuration = preview?.snippetDurationSecs || duration || 15;

  const handleSelectAudition = (mode: "original" | "boosted") => {
    setInternalAudition(mode);
    onSelectAudition?.(mode);
  };

  // Convert current path to streamable asset URL
  useEffect(() => {
    if (!preview) {
      setAudioSrc(null);
      setInternalIsPlaying(false);
      setInternalCurrentTime(0);
      return;
    }

    const path = isBoosted ? preview.boostedPath : preview.originalPath;
    let cancelled = false;

    void api.fileToAssetUrl(path).then((url) => {
      if (cancelled) return;
      const audio = audioRef.current;
      if (audio && audio.src !== url) {
        const wasPlaying = !audio.paused && audio.currentTime > 0;
        const prevTime = audio.currentTime || 0;

        setAudioSrc(url);

        // Preserve current playhead position across A/B toggles
        if (wasPlaying) {
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.currentTime = prevTime;
              audioRef.current.play().catch(() => setInternalIsPlaying(false));
            }
          }, 50);
        }
      } else if (!audioSrc) {
        setAudioSrc(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [preview, isBoosted, audioSrc]);

  // Audio Play/Pause Toggle
  const handleTogglePlay = () => {
    if (onTogglePlay) {
      onTogglePlay();
      return;
    }

    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (!audio.paused) {
      audio.pause();
      setInternalIsPlaying(false);
    } else {
      if (audio.currentTime >= effectiveDuration - 0.1) {
        audio.currentTime = 0;
        setInternalCurrentTime(0);
      }
      audio
        .play()
        .then(() => setInternalIsPlaying(true))
        .catch(() => setInternalIsPlaying(false));
    }
  };

  // Waveform seek handler
  const handleSeek = (timeSecs: number) => {
    const clamped = Math.max(0, Math.min(effectiveDuration, timeSecs));
    setInternalCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    controlledOnSeek?.(clamped);
  };

  return (
    <div
      dir="ltr"
      className="flex flex-col gap-3 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
    >
      {/* Hidden DOM Audio element ensures continuous playback and lifecycle attachment on mobile & desktop */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          onPlay={() => setInternalIsPlaying(true)}
          onPause={() => setInternalIsPlaying(false)}
          onEnded={() => {
            setInternalIsPlaying(false);
            setInternalCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              const cur = audioRef.current.currentTime || 0;
              setInternalCurrentTime(cur);
              if (cur >= effectiveDuration) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                setInternalCurrentTime(0);
                setInternalIsPlaying(false);
              }
            }
          }}
          onError={() => {
            setInternalIsPlaying(false);
          }}
        />
      )}

      {/* Top Header: Segmented A/B Switcher */}
      <div className="flex items-center gap-1.5 rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.05]" dir="ltr">
        {/* Original Button */}
        <button
          type="button"
          onClick={() => handleSelectAudition("original")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all duration-200 ${
            !isBoosted
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Volume1 className="h-4 w-4" strokeWidth={2.2} />
          <span>{translate(lang, "auditionOriginal")}</span>
        </button>

        {/* Boosted Button */}
        <button
          type="button"
          onClick={() => handleSelectAudition("boosted")}
          className={`group relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all duration-200 ${
            isBoosted
              ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-current" />
          ) : (
            <Volume2 className="h-4 w-4" strokeWidth={2.2} />
          )}

          <span>{translate(lang, "auditionBoosted")}</span>

          {isBoosted && isPlaying && !isLoading && (
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          )}
        </button>
      </div>

      {/* Error Banner if any */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-2.5 text-[11px] font-medium text-red-600 dark:text-red-400" dir="ltr">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Main Player Row: Play Button & Waveform strictly aligned on the exact same horizontal line */}
      <div className="flex flex-col gap-1.5" dir="ltr">
        <div className="flex items-center gap-2.5">
          {/* Play/Pause Button (exact same h-10 as WaveformVisualizer) */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={!audioSrc}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-40 ${
              isPlaying
                ? "bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-500/20"
                : "bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            }`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
            ) : (
              <Play className="h-4 w-4 fill-current ms-0.5" strokeWidth={0} />
            )}
          </button>

          {/* Waveform Visualizer on the exact same line */}
          <div className="flex-1 min-w-0">
            <WaveformVisualizer
              peaks={
                preview
                  ? isBoosted
                    ? preview.boostedPeaks
                    : preview.originalPeaks
                  : []
              }
              isBoosted={isBoosted}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={effectiveDuration}
              onSeek={handleSeek}
            />
          </div>
        </div>

        {/* Timecode & Status Footer placed below the player row */}
        <div className="flex items-center justify-between px-1 text-[10px] font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
          <span className="text-zinc-600 dark:text-zinc-300 font-bold">
            {formatTimecode(currentTime)} / {formatTimecode(effectiveDuration)}
          </span>

          {isLoading ? (
            <span className="flex items-center gap-1 text-orange-500 font-bold animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>در حال به‌روزرسانی…</span>
            </span>
          ) : preview?.analysis?.suggestedGainDb ? (
            <span className="text-[9.5px]">
              گین پیشنهادی: +{preview.analysis.suggestedGainDb.toFixed(1)} dB
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
