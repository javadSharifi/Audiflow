import type { DragTarget, SelectionBounds } from "./types";

/**
 * Clamps a time value to [0, duration].
 */
export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, time));
}

/**
 * Converts a chronological time to pixel x position across width.
 */
export function timeToPixel(time: number, duration: number, width: number): number {
  if (duration <= 0 || width <= 0) return 0;
  const frac = Math.min(1, Math.max(0, time / duration));
  return frac * width;
}

/**
 * Converts a pixel offset to chronological time.
 */
export function pixelToTime(pixelX: number, width: number, duration: number): number {
  if (width <= 0 || duration <= 0) return 0;
  const frac = pixelX / width;
  return clampTime(frac * duration, duration);
}

/**
 * Converts a clientX pointer coordinate to chronological time relative to container bounds.
 */
export function timeFromClientX(
  clientX: number,
  rect: { left: number; width: number },
  duration: number,
): number {
  return pixelToTime(clientX - rect.left, rect.width, duration);
}

/**
 * Determines whether a click at clientX hits the start or end handle within hitRadiusPx.
 */
export function hitTestHandle(
  clientX: number,
  rect: { left: number; width: number },
  duration: number,
  selStart: number,
  selEnd: number,
  hitRadiusPx: number,
): DragTarget {
  if (rect.width <= 0 || duration <= 0) return null;
  const px = clientX - rect.left;
  const sx = timeToPixel(selStart, duration, rect.width);
  const ex = timeToPixel(selEnd, duration, rect.width);
  const ds = Math.abs(px - sx);
  const de = Math.abs(px - ex);

  if (ds < hitRadiusPx && ds <= de) return "start";
  if (de < hitRadiusPx && de < ds) return "end";
  return null;
}

/**
 * Clamps and updates start or end selection while maintaining minimum separation distance.
 */
export function applySelectionBound(
  which: "start" | "end",
  targetTime: number,
  selStart: number,
  selEnd: number,
  duration: number,
  minDistance = 0.05,
): SelectionBounds {
  const clamped = clampTime(targetTime, duration);
  if (which === "start") {
    const maxStart = Math.max(0, selEnd - minDistance);
    return {
      start: clampTime(Math.min(clamped, maxStart), duration),
      end: selEnd,
    };
  } else {
    const minEnd = Math.min(duration, selStart + minDistance);
    return {
      start: selStart,
      end: clampTime(Math.max(clamped, minEnd), duration),
    };
  }
}

/**
 * Formats seconds into mm:ss clock string for handle tags.
 */
export function formatClock(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}
