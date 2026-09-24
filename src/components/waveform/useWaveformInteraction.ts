import { useCallback, useRef } from "react";
import type { DragTarget, WaveformPeak } from "./types";
import { hitTestHandle, timeFromClientX } from "./geometry";

function buzz(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* vibrate unsupported — ignore */
  }
}

export interface UseWaveformInteractionOptions {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  peaks: WaveformPeak[] | null;
  selStart: number;
  selEnd: number;
  hitRadiusPx?: number;
  hasSelection?: boolean;
  onApplyBound: (which: "start" | "end", targetTime: number) => void;
  onAudition: (time: number) => void;
  onStopAudition: () => void;
  onPlaySelection: () => void;
  onDragEnd?: () => void;
}

export function useWaveformInteraction(options: UseWaveformInteractionOptions) {
  const {
    wrapRef,
    duration,
    peaks,
    selStart,
    selEnd,
    hitRadiusPx = 24,
    hasSelection = true,
    onApplyBound,
    onAudition,
    onStopAudition,
    onPlaySelection,
    onDragEnd,
  } = options;

  const draggingRef = useRef<DragTarget>(null);

  const timeFromEvent = useCallback(
    (clientX: number): number => {
      const wrap = wrapRef.current;
      if (!wrap || duration <= 0) return 0;
      return timeFromClientX(clientX, wrap.getBoundingClientRect(), duration);
    },
    [duration, wrapRef],
  );

  const hitTest = useCallback(
    (clientX: number): DragTarget => {
      const wrap = wrapRef.current;
      if (!wrap || duration <= 0) return null;
      return hitTestHandle(
        clientX,
        wrap.getBoundingClientRect(),
        duration,
        selStart,
        selEnd,
        hitRadiusPx,
      );
    },
    [duration, hitRadiusPx, selEnd, selStart, wrapRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (peaks == null || duration <= 0) return;
      e.preventDefault();
      const target = hitTest(e.clientX);
      const t = timeFromEvent(e.clientX);

      if (target) {
        draggingRef.current = target;
        buzz(10);
        e.currentTarget.setPointerCapture(e.pointerId);
        onAudition(t);
        return;
      }

      // Click inside an existing selection → audition/toggle it.
      if (hasSelection && t > selStart && t < selEnd) {
        onPlaySelection();
        return;
      }

      // Click outside → snap the nearer bound here and drag it.
      const distToStart = Math.abs(t - selStart);
      const distToEnd = Math.abs(t - selEnd);
      const which: "start" | "end" = distToEnd < distToStart ? "end" : "start";
      onApplyBound(which, t);
      draggingRef.current = which;
      buzz(10);
      e.currentTarget.setPointerCapture(e.pointerId);
      onAudition(t);
    },
    [
      duration,
      hasSelection,
      hitTest,
      onApplyBound,
      onAudition,
      onPlaySelection,
      peaks,
      selEnd,
      selStart,
      timeFromEvent,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = draggingRef.current;
      if (!target) return;
      const t = timeFromEvent(e.clientX);
      onApplyBound(target, t);
      onAudition(t);
    },
    [onApplyBound, onAudition, timeFromEvent],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      onStopAudition();
      onDragEnd?.();
    },
    [onDragEnd, onStopAudition],
  );

  return {
    draggingRef,
    timeFromEvent,
    hitTest,
    onPointerDown,
    onPointerMove,
    endDrag,
  };
}
