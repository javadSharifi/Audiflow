import React, { useEffect, useRef } from "react";
import type { DragTarget, WaveformGripStyle, WaveformPeak } from "./types";
import { renderWaveform } from "./renderer";
import { formatTimecode } from "../../utils/format";
import { translate } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

export interface WaveformCanvasProps {
  peaks: WaveformPeak[] | null;
  waveErr?: boolean;
  duration: number;
  selStart: number;
  selEnd: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  playing?: boolean;
  draggingRef?: React.RefObject<DragTarget | null>;
  canvasHeight?: number;
  gripStyle?: WaveformGripStyle;
  wrapRef?: React.RefObject<HTMLDivElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  className?: string;
  testId?: string;
  ariaLabel?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

export function WaveformCanvas({
  peaks,
  waveErr = false,
  duration,
  selStart,
  selEnd,
  audioRef,
  playing = false,
  draggingRef,
  canvasHeight = 104,
  gripStyle = "pill-dots",
  wrapRef,
  canvasRef: externalCanvasRef,
  className = "",
  testId,
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  children,
}: WaveformCanvasProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const playTimeRef = useRef<number | null>(null);

  const selLen = Math.max(0, selEnd - selStart);
  const defaultAriaLabel = `${translate(lang, "trimTitle")} ${formatTimecode(selStart)} – ${formatTimecode(selEnd)}`;

  useEffect(() => {
    const paint = () => {
      const canvas = canvasRef.current;
      if (!canvas || !peaks) return;
      const a = audioRef?.current;
      const scrubbing = draggingRef?.current != null;
      playTimeRef.current = a && !a.paused ? a.currentTime : a && scrubbing ? a.currentTime : null;

      renderWaveform(canvas, {
        peaks,
        duration,
        selStart,
        selEnd,
        playTime: playTimeRef.current,
        canvasHeight,
        gripStyle,
      });
    };

    paint();
    if (typeof window === "undefined") return;

    if (!playing) {
      const onResize = () => paint();
      window.addEventListener("resize", onResize);
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("resize", onResize);
        }
      };
    }
    let raf = 0;
    const loop = () => {
      paint();
      if (typeof window !== "undefined") {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (typeof window !== "undefined") {
        cancelAnimationFrame(raf);
      }
    };
  }, [audioRef, canvasHeight, canvasRef, draggingRef, duration, gripStyle, peaks, playing, selEnd, selStart]);

  return (
    <div
      ref={wrapRef}
      className={`relative touch-none overflow-hidden rounded-2xl border border-black/5 bg-black/[0.04] p-1.5 select-none dark:border-white/5 dark:bg-[#0F0F23] ${
        peaks ? "cursor-ew-resize" : ""
      } ${className}`}
      style={{ height: canvasHeight + 12, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      data-testid={testId}
      role="slider"
      aria-label={ariaLabel || defaultAriaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={Math.round(selLen * 10) / 10}
      aria-valuetext={`${formatTimecode(selStart)} – ${formatTimecode(selEnd)}`}
    >
      <canvas ref={canvasRef} className="h-full w-full touch-none rounded-xl" />

      {/* Custom overlays (floating tags, accessible buttons, etc.) */}
      {children}

      {/* Loading Skeleton */}
      {!peaks && !waveErr && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-medium text-slate-500 dark:text-[#CBD5E1]"
        >
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="h-4 w-1 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-orange-500/60" />
            <span className="h-6 w-1 animate-[pulse_1s_ease-in-out_0.2s_infinite] rounded-full bg-orange-500/80" />
            <span className="h-8 w-1 animate-[pulse_1s_ease-in-out_0.4s_infinite] rounded-full bg-orange-500" />
            <span className="h-5 w-1 animate-[pulse_1s_ease-in-out_0.6s_infinite] rounded-full bg-orange-500/70" />
            <span className="h-3 w-1 animate-[pulse_1s_ease-in-out_0.8s_infinite] rounded-full bg-orange-500/50" />
          </div>
          <span className="animate-pulse">{translate(lang, "trimLoading")}</span>
        </div>
      )}

      {/* Error Alert */}
      {waveErr && (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-red-400"
        >
          {translate(lang, "trimWaveError")}
        </div>
      )}
    </div>
  );
}
