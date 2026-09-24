import React from "react";
import { formatTimecode } from "../../utils/format";
import { translate } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

export interface WaveformAccessibleHandlesProps {
  duration: number;
  selStart: number;
  selEnd: number;
  onGrab: (which: "start" | "end") => void;
  onStep: (which: "start" | "end", delta: number) => void;
}

export function WaveformAccessibleHandles({
  duration,
  selStart,
  selEnd,
  onGrab,
  onStep,
}: WaveformAccessibleHandlesProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);

  if (duration <= 0) return null;

  return (
    <>
      <button
        type="button"
        aria-label={`${translate(lang, "trimHandleStart")}: ${formatTimecode(selStart)}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          onGrab("start");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onStep("start", -1);
          }
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onStep("start", 1);
          }
        }}
        className="absolute top-1/2 min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-orange-500"
        style={{ left: `${((selStart / duration) * 100).toFixed(3)}%`, touchAction: "none" }}
      />
      <button
        type="button"
        aria-label={`${translate(lang, "trimHandleEnd")}: ${formatTimecode(selEnd)}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          onGrab("end");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onStep("end", -1);
          }
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onStep("end", 1);
          }
        }}
        className="absolute top-1/2 min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-orange-500"
        style={{ left: `${((selEnd / duration) * 100).toFixed(3)}%`, touchAction: "none" }}
      />
    </>
  );
}
