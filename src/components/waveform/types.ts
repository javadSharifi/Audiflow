export type DragTarget = "start" | "end" | null;

export type WaveformPeak = [number, number];

export type WaveformGripStyle = "pill-dots" | "pill-lines";

export interface WaveformRenderOptions {
  peaks: WaveformPeak[];
  duration: number;
  selStart: number | null;
  selEnd: number | null;
  playTime: number | null;
  canvasHeight?: number;
  gripStyle?: WaveformGripStyle;
}

export interface SelectionBounds {
  start: number;
  end: number;
}
