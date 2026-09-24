import type { WaveformRenderOptions } from "./types";
import { timeToPixel } from "./geometry";

/**
 * Renders the interactive waveform onto an HTML5 canvas element with DPR scaling.
 */
export function renderWaveform(
  canvas: HTMLCanvasElement,
  options: WaveformRenderOptions,
): void {
  const {
    peaks,
    duration,
    selStart,
    selEnd,
    playTime,
    canvasHeight = 104,
    gripStyle = "pill-dots",
  } = options;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const w = canvas.clientWidth;
  if (w === 0) return;

  const targetWidth = Math.round(w * dpr);
  const targetHeight = Math.round(canvasHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, canvasHeight);

  const xOf = (t: number) => timeToPixel(t, duration, w);
  const mid = canvasHeight / 2;
  const sX = selStart != null ? xOf(selStart) : 0;
  const eX = selEnd != null ? xOf(selEnd) : w;
  const lo = Math.min(sX, eX);
  const hi = Math.max(sX, eX);

  // 1. Shaded regions outside selection
  if (gripStyle === "pill-dots") {
    ctx.fillStyle = "rgba(10, 10, 15, 0.35)";
  } else {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  }
  ctx.fillRect(0, 0, lo, canvasHeight);
  ctx.fillRect(hi, 0, w - hi, canvasHeight);

  // 2. Active selection background highlight
  const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  if (gripStyle === "pill-dots") {
    grad.addColorStop(0, "rgba(249, 115, 22, 0.18)");
    grad.addColorStop(1, "rgba(249, 115, 22, 0.04)");
  } else {
    grad.addColorStop(0, "rgba(249, 115, 22, 0.3)");
    grad.addColorStop(0.5, "rgba(249, 115, 22, 0.12)");
    grad.addColorStop(1, "rgba(249, 115, 22, 0.25)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(lo, 0, hi - lo, canvasHeight);

  // 3. Waveform bars
  const n = peaks.length;
  if (n > 0 && w > 0) {
    const barW = w / n;
    const padding = gripStyle === "pill-dots" ? 10 : 14;
    const hMax = mid - padding;
    const minHeight = gripStyle === "pill-dots" ? 2.5 : 3;
    const minWidth = gripStyle === "pill-dots" ? 1.5 : 1.8;
    const maxRadius = gripStyle === "pill-dots" ? 2 : 2.5;

    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * barW;
      const inside = cx >= lo && cx <= hi;
      const [mn, mx] = peaks[i];
      const yTop = mid - Math.abs(mx) * hMax;
      const yBot = mid + Math.abs(mn) * hMax;
      const barHeight = Math.max(yBot - yTop, minHeight);

      if (inside) {
        if (gripStyle === "pill-dots") {
          ctx.fillStyle = "#f97316";
        } else {
          const barGrad = ctx.createLinearGradient(0, yTop, 0, yBot);
          barGrad.addColorStop(0, "#fb923c");
          barGrad.addColorStop(0.5, "#f97316");
          barGrad.addColorStop(1, "#ea580c");
          ctx.fillStyle = barGrad;
        }
      } else {
        ctx.fillStyle = gripStyle === "pill-dots" ? "rgba(150, 150, 165, 0.35)" : "rgba(140, 140, 160, 0.3)";
      }

      const bw = Math.max(barW * 0.75, minWidth);
      ctx.beginPath();
      const r = Math.min(bw / 2, maxRadius);
      if (ctx.roundRect) {
        ctx.roundRect(cx - bw / 2, yTop, bw, barHeight, r);
      } else {
        ctx.rect(cx - bw / 2, yTop, bw, barHeight);
      }
      ctx.fill();
    }
  }

  // 4. Draggable boundary handles
  const drawHandle = (x: number, isLeft: boolean) => {
    // Vertical line
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();

    if (gripStyle === "pill-dots") {
      // Top circle knob
      ctx.fillStyle = "#f97316";
      ctx.shadowColor = "rgba(249, 115, 22, 0.45)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, 10, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Pill grip
      const gripW = 10;
      const gripH = 34;
      const gripX = isLeft ? x - gripW + 1 : x - 1;
      const gripY = mid - gripH / 2;

      ctx.fillStyle = "#f97316";
      ctx.shadowColor = "rgba(249, 115, 22, 0.4)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(gripX, gripY, gripW, gripH, 5);
      } else {
        ctx.rect(gripX, gripY, gripW, gripH);
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // 3 vertical dots
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 3; i++) {
        const dy = gripY + gripH / 2 - 6 + i * 6;
        ctx.beginPath();
        ctx.arc(gripX + gripW / 2, dy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Ringtone modal style: luminous pill grip with 2 lines
      ctx.shadowColor = "rgba(249, 115, 22, 0.6)";
      ctx.shadowBlur = 10;

      const gripW = 12;
      const gripH = 40;
      const gripX = isLeft ? x - gripW + 1 : x - 1;
      const gripY = mid - gripH / 2;

      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(gripX, gripY, gripW, gripH, 6);
      } else {
        ctx.rect(gripX, gripY, gripW, gripH);
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // 2 vertical lines
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(gripX + gripW / 2 - 1.5, gripY + 11, 1.5, gripH - 22);
      ctx.fillRect(gripX + gripW / 2 + 0.5, gripY + 11, 1.5, gripH - 22);
    }
  };

  drawHandle(lo, true);
  drawHandle(hi, false);

  // 5. Laser playhead line & top indicator triangle
  if (playTime != null && duration > 0) {
    const px = xOf(playTime);
    const triangleW = gripStyle === "pill-dots" ? 5 : 6;
    const triangleH = gripStyle === "pill-dots" ? 7 : 8;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = gripStyle === "pill-dots" ? 2 : 2.5;
    ctx.shadowColor = gripStyle === "pill-dots" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = gripStyle === "pill-dots" ? 4 : 6;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvasHeight);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(px - triangleW, 0);
    ctx.lineTo(px + triangleW, 0);
    ctx.lineTo(px, triangleH);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
