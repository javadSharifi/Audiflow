import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import { formatTimecode, parseTimeInput } from "../utils/format";
import { isAndroid, isLinux } from "../utils/platform";
import {
  resolveScopedBlobAudioSrc,
  type BlobAudioHandle,
} from "../stores/musicPlayer/linuxAssetAudio";
import * as api from "../utils/tauri";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { InputFile } from "../types";

/**
 * Interactive trim editor.
 *
 * A canvas draws the file's REAL waveform (decoded by the bundled ffmpeg).
 * Two handles drag to set start/end; while a handle drags (or the selection
 * plays) the audio is auditioned through an <audio> element fed by an
 * asset:// URL — no new JS dependencies, no bundled player library.
 *
 * Interaction model:
 * - drag handles → adjust that bound; audio "scrubs" near the handle edge
 * - click inside selection → play just the selection (stops at its end)
 * - click outside selection → move nearest bound to the clicked time
 */

type DragTarget = "start" | "end" | null;

// 44px touch target → 22px radius around each handle line.
const HANDLE_HIT_PX = 22;
const CANVAS_H = 104;

function buzz(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* vibrate unsupported — ignore */
  }
}

interface PaintArgs {
  peaks: [number, number][];
  duration: number;
  selStart: number | null;
  selEnd: number | null;
  playTime: number | null;
}

function drawWaveform(canvas: HTMLCanvasElement, args: PaintArgs): void {
  const { peaks, duration, selStart, selEnd, playTime } = args;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  if (w === 0) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(CANVAS_H * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, CANVAS_H);

  // x position for a time t (strictly left-to-right chronological).
  const xOf = (t: number) => {
    const frac = duration > 0 ? Math.min(1, Math.max(0, t / duration)) : 0;
    return frac * w;
  };

  const mid = CANVAS_H / 2;
  const sX = selStart != null ? xOf(selStart) : 0;
  const eX = selEnd != null ? xOf(selEnd) : w;
  const lo = Math.min(sX, eX);
  const hi = Math.max(sX, eX);

  // Selected background highlight
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, "rgba(249, 115, 22, 0.18)");
  grad.addColorStop(1, "rgba(249, 115, 22, 0.04)");
  ctx.fillStyle = grad;
  ctx.fillRect(lo, 0, hi - lo, CANVAS_H);

  // Dimmed regions outside selection
  ctx.fillStyle = "rgba(10, 10, 15, 0.35)";
  ctx.fillRect(0, 0, lo, CANVAS_H);
  ctx.fillRect(hi, 0, w - hi, CANVAS_H);

  // Waveform bars
  const n = peaks.length;
  if (n > 0 && w > 0) {
    const barW = w / n;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * barW;
      const inside = cx >= lo && cx <= hi;
      const [mn, mx] = peaks[i];
      const hMax = mid - 10;
      const yTop = mid - Math.abs(mx) * hMax;
      const yBot = mid + Math.abs(mn) * hMax;
      const barHeight = Math.max(yBot - yTop, 2.5);

      ctx.fillStyle = inside ? "#f97316" : "rgba(150, 150, 165, 0.35)";
      const bw = Math.max(barW * 0.75, 1.5);
      
      // Draw rounded capsule bar
      ctx.beginPath();
      const r = Math.min(bw / 2, 2);
      if (ctx.roundRect) {
        ctx.roundRect(cx - bw / 2, yTop, bw, barHeight, r);
      } else {
        ctx.rect(cx - bw / 2, yTop, bw, barHeight);
      }
      ctx.fill();
    }
  }

  // Draw Handle Lines & Grips — high-visibility: top circle knob + pill + dots
  const drawHandle = (x: number, isLeft: boolean) => {
    // Vertical luminous line
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();

    // Top circle knob (clear visual anchor above the handle)
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

    // iOS style handle pill grip at center
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

    // Grip dots (3 vertical dots — clearer than a single line)
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      const dy = gripY + gripH / 2 - 6 + i * 6;
      ctx.beginPath();
      ctx.arc(gripX + gripW / 2, dy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Always draw start and end handles
  drawHandle(lo, true);
  drawHandle(hi, false);

  // Playhead with top triangle indicator
  if (playTime != null && duration > 0) {
    const px = xOf(playTime);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, CANVAS_H);
    ctx.stroke();

    // Top triangle badge
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function TrimEditor({ file }: { file: InputFile }): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const setTrim = useAppStore((s) => s.setTrim);
  const pushToast = useAppStore((s) => s.pushToast);
  const updateFileMeta = useAppStore((s) => s.updateFileMeta);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobHandleRef = useRef<BlobAudioHandle | null>(null);
  const draggingRef = useRef<DragTarget>(null);
  const playTimeRef = useRef<number | null>(null);
  const previewStartRef = useRef<number | null>(null);
  const previewEndRef = useRef<number | null>(null);
  const hasEnteredRangeRef = useRef(false);
  const playSelectionRef = useRef<() => void>(() => {});

  const [peaks, setPeaks] = useState<[number, number][] | null>(null);
  const [waveErr, setWaveErr] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // Operation feedback for screen readers (Loading → Success/Error).
  const [opStatus, setOpStatus] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  // Android: statUri often can't report duration for SAF/document URIs.
  // Probe the staged file for the real duration so the editor stays usable.
  const [probedDur, setProbedDur] = useState(0);

  const duration = probedDur > 0 ? probedDur : file.durationSecs;
  const selStart = file.trimStartSecs ?? null;
  const selEnd = file.trimEndSecs ?? null;
  const hasSelection = selStart != null || selEnd != null;

  const clampT = useCallback(
    (t: number) => Math.min(duration, Math.max(0, t)),
    [duration],
  );

  // ---- Load waveform + playable URL -------------------------------------
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset of waveform state when a new file is loaded
    setPeaks(null);
    setWaveErr(false);
    setSrcUrl(null);
    const prepare = async () => {
      // Android rows hold content URIs; resolve to the (cached) staged local
      // file for both the waveform decode and the audio preview.
      let localPath = file.path;
      if (isAndroid()) {
        try {
          const res = await api.resolveMediaPaths([file.path]);
          localPath = res[0]?.resolved ?? file.path;
        } catch {
          /* fall back to the raw path */
        }
      }
      if (!alive) return;
      // Android: unknown duration (SAF documents) → probe the staged file.
      if (isAndroid() && file.durationSecs <= 0 && localPath !== file.path) {
        try {
          const metas = await api.probeFiles([localPath]);
          const m = metas[0];
          if (m && !m.error && (m.durationSecs ?? 0) > 0) {
            if (alive) {
              setProbedDur(m.durationSecs ?? 0);
              updateFileMeta(file.path, { durationSecs: m.durationSecs ?? 0 });
            }
          }
        } catch {
          /* keep 0 — editor stays inert rather than wrong */
        }
      }
      if (!alive) return;
      api
        .waveformPeaks(localPath, Math.max(200, Math.min(1600, Math.round((probedDur > 0 ? probedDur : duration) * 40))))
        .then((p) => {
          if (alive) setPeaks(p);
        })
        .catch(() => {
          if (alive) setWaveErr(true);
        });
      // A failed resolution leaves the content URI → no playable preview.
      if (isAndroid() && localPath.startsWith("content://")) {
        setSrcUrl(null);
      } else {
        const assetUrl = convertFileSrc(localPath);
        // Linux: WebKitGTK cannot play media from asset:// (WebKit bug
        // 146351) — serve the preview element a scoped blob: URL instead.
        // Scoped (not the player singleton) so this never revokes a
        // background track that is still playing.
        if (!isLinux()) {
          if (alive) setSrcUrl(assetUrl);
        } else {
          const handle = await resolveScopedBlobAudioSrc(assetUrl);
          if (!alive) {
            handle?.revoke();
            return;
          }
          blobHandleRef.current?.revoke();
          blobHandleRef.current = handle;
          setSrcUrl(handle ? handle.url : assetUrl);
        }
      }
    };
    void prepare();
    return () => {
      alive = false;
      blobHandleRef.current?.revoke();
      blobHandleRef.current = null;
    };
  }, [file.path, file.durationSecs, duration, probedDur, updateFileMeta]);

  // ---- Painting (rAF only while needed) -----------------------------------
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const a = audioRef.current;
    const scrubbing = draggingRef.current != null;
    playTimeRef.current =
      a && !a.paused ? a.currentTime : a && scrubbing ? a.currentTime : null;
    drawWaveform(canvas, {
      peaks,
      duration,
      selStart,
      selEnd,
      playTime: playTimeRef.current,
    });
  }, [duration, peaks, selEnd, selStart]);

  useEffect(() => {
    paint(); // immediate repaint on state change
    // Animate the playhead continuously ONLY while audio is playing —
    // an idle editor costs zero CPU.
    if (!playing) {
      const onResize = () => paint();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    let raf = 0;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paint, playing, peaks]);

  // ---- Audition while dragging --------------------------------------------
  /** Play a short snippet starting slightly before the moving edge. */
  const audition = useCallback(
    (t: number) => {
      const a = audioRef.current;
      if (!a || !srcUrl || duration <= 0) return;
      previewStartRef.current = null;
      previewEndRef.current = null;
      hasEnteredRangeRef.current = false;
      try {
        a.currentTime = Math.max(0, clampT(t) - 0.08);
      } catch {
        /* ignore */
      }
      if (a.paused) void a.play().catch(() => {});
    },
    [clampT, duration, srcUrl],
  );

  const stopAudition = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    previewEndRef.current = null;
    previewStartRef.current = null;
    hasEnteredRangeRef.current = false;
  }, []);

  // Stop playback when leaving the editor or switching files.
  useEffect(() => stopAudition, [stopAudition, file.path]);

  // ---- Pointer interaction -----------------------------------------------
  const timeFromEvent = useCallback(
    (clientX: number): number => {
      const wrap = wrapRef.current;
      if (!wrap || duration <= 0) return 0;
      const rect = wrap.getBoundingClientRect();
      const frac = (clientX - rect.left) / rect.width;
      return clampT(frac * duration);
    },
    [clampT, duration],
  );

  /** Which bound is nearest to pixel x? Mirrors drawn handle positions. */
  const hitTest = useCallback(
    (clientX: number): DragTarget => {
      const wrap = wrapRef.current;
      if (!wrap || duration <= 0) return null;
      const rect = wrap.getBoundingClientRect();
      const px = clientX - rect.left;
      const toPx = (t: number) => (t / duration) * rect.width;
      const sx = toPx(selStart ?? 0);
      const ex = toPx(selEnd ?? duration);
      const ds = Math.abs(px - sx);
      const de = Math.abs(px - ex);
      if (ds < HANDLE_HIT_PX && ds <= de) return "start";
      if (de < HANDLE_HIT_PX && de < ds) return "end";
      return null;
    },
    [duration, selEnd, selStart],
  );

  const applyBound = useCallback(
    (which: Exclude<DragTarget, null>, t: number) => {
      let v = clampT(t);
      if (which === "start") {
        const curEnd = selEnd ?? duration;
        v = Math.min(v, curEnd - 0.05);
        v = clampT(v);
        setTrim(file.path, "trimStartSecs", v);
      } else {
        const curStart = selStart ?? 0;
        v = Math.max(v, curStart + 0.05);
        v = clampT(v);
        setTrim(file.path, "trimEndSecs", v);
      }
    },
    [clampT, duration, file.path, selEnd, selStart, setTrim],
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
        audition(t);
        return;
      }

      const curStart = selStart ?? 0;
      const curEnd = selEnd ?? duration;

      // Click inside an existing selection → audition it.
      if (hasSelection && t > curStart && t < curEnd) {
        playSelectionRef.current();
        return;
      }

      // Click outside → snap the NEARER bound here and drag it.
      const distToStart = Math.abs(t - curStart);
      const distToEnd = Math.abs(t - curEnd);
      const which: "start" | "end" = distToEnd < distToStart ? "end" : "start";
      applyBound(which, t);
      draggingRef.current = which;
      e.currentTarget.setPointerCapture(e.pointerId);
      audition(t);
    },
    [
      applyBound,
      audition,
      duration,
      hasSelection,
      hitTest,
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
      applyBound(target, t);
      audition(t);
    },
    [applyBound, audition, timeFromEvent],
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
      stopAudition();
    },
    [stopAudition],
  );

  // ---- Selection & Preview playback ---------------------------------------
  const playPreviewRange = useCallback(
    (from: number, to: number) => {
      const a = audioRef.current;
      if (!a || !srcUrl) return;

      const effDur =
        Number.isFinite(a.duration) && a.duration > 0
          ? Math.min(duration, a.duration)
          : duration;

      const cleanFrom = Math.max(0, Math.min(effDur, from));
      const cleanTo = Math.max(cleanFrom, Math.min(effDur, to));
      if (cleanTo - cleanFrom <= 0.01) return;

      previewStartRef.current = cleanFrom;
      previewEndRef.current = cleanTo;
      hasEnteredRangeRef.current = false;

      // Pause existing playback before seek so playPromise isn't interrupted mid-flight
      if (!a.paused) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
      }

      try {
        a.currentTime = cleanFrom;
      } catch {
        /* ignore */
      }

      // Re-assert target start if browser reset currentTime to 0 on play
      const onPlaying = () => {
        if (Math.abs(a.currentTime - cleanFrom) > 0.4) {
          try {
            a.currentTime = cleanFrom;
          } catch {
            /* ignore */
          }
        }
        a.removeEventListener("playing", onPlaying);
      };
      a.addEventListener("playing", onPlaying);

      const playPromise = a.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setPlaying(true);
            if (Math.abs(a.currentTime - cleanFrom) > 0.4) {
              try {
                a.currentTime = cleanFrom;
              } catch {
                /* ignore */
              }
            }
          })
          .catch((err) => {
            console.warn("Play preview failed:", err);
            setPlaying(false);
            hasEnteredRangeRef.current = false;
            previewStartRef.current = null;
            previewEndRef.current = null;
          });
      }
    },
    [duration, srcUrl],
  );

  const previewFirst5 = useCallback(() => {
    const a = audioRef.current;
    const effDur =
      a && Number.isFinite(a.duration) && a.duration > 0
        ? Math.min(duration, a.duration)
        : duration;
    const start = selStart ?? 0;
    const end = selEnd ?? effDur;
    const targetEnd = Math.min(start + 5, end);
    playPreviewRange(start, targetEnd);
  }, [duration, playPreviewRange, selEnd, selStart]);

  const previewLast5 = useCallback(() => {
    const a = audioRef.current;
    const effDur =
      a && Number.isFinite(a.duration) && a.duration > 0
        ? Math.min(duration, a.duration)
        : duration;
    const start = selStart ?? 0;
    const end = selEnd ?? effDur;
    const targetStart = Math.max(end - 5, start);
    playPreviewRange(targetStart, end);
  }, [duration, playPreviewRange, selEnd, selStart]);

  const playSelection = useCallback(() => {
    const a = audioRef.current;
    if (!a || !srcUrl) return;
    const from = selStart ?? 0;
    const to = selEnd ?? duration;
    if (to - from <= 0.01) return;

    if (!a.paused) {
      a.pause();
      setPlaying(false);
      return;
    }
    playPreviewRange(from, to);
  }, [duration, playPreviewRange, selEnd, selStart, srcUrl]);

  useEffect(() => {
    playSelectionRef.current = playSelection;
  }, [playSelection]);

  // Enforce the selection end during playback.
  const onAudioTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (!a || a.paused || a.seeking) return;

    const targetStart = previewStartRef.current;
    const targetEnd = previewEndRef.current ?? (selEnd ?? duration);

    // If a preview start was requested, ensure the playhead has actually
    // arrived inside the preview window before enforcing targetEnd.
    if (targetStart != null && !hasEnteredRangeRef.current) {
      if (Math.abs(a.currentTime - targetStart) <= 0.6) {
        hasEnteredRangeRef.current = true;
      } else {
        // Audio has not yet arrived at targetStart (e.g. still at old position or seeking).
        return;
      }
    }

    if (draggingRef.current == null && a.currentTime >= targetEnd) {
      a.pause();
      a.currentTime = targetEnd;
      previewEndRef.current = null;
      previewStartRef.current = null;
      hasEnteredRangeRef.current = false;
      setPlaying(false);
    }
  }, [duration, selEnd]);

  const clearTrim = useCallback(() => {
    setTrim(file.path, "trimStartSecs", null);
    setTrim(file.path, "trimEndSecs", null);
    stopAudition();
    setOpStatus({ kind: "success", msg: translate(lang, "trimStatusCleared") });
  }, [file.path, lang, setTrim, stopAudition]);

  /** ±1s nudge for the handle-overlay keyboard arrows (no visible steppers). */
  const stepBound = useCallback(
    (which: "start" | "end", delta: number) => {
      const cur = which === "start" ? (selStart ?? 0) : (selEnd ?? duration);
      applyBound(which, cur + delta);
      buzz(10);
      setOpStatus({ kind: "success", msg: translate(lang, "trimStatusApplied") });
    },
    [applyBound, duration, lang, selEnd, selStart],
  );

  /** Grab a handle from its invisible 44px overlay button (touch + SR). */
  const grabHandle = useCallback(
    (which: "start" | "end") => {
      if (peaks == null || duration <= 0) return;
      draggingRef.current = which;
      buzz(10);
      audition(which === "start" ? (selStart ?? 0) : (selEnd ?? duration));
    },
    [audition, duration, peaks, selEnd, selStart],
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

  const selLen = Math.max(0, (selEnd ?? duration) - (selStart ?? 0));

  return (
    // Flat section (no nested card — the file card is the only card).
    <div className="flex flex-col gap-6">
      {/* ── Section: tools — 1+3 grid, 44px targets, single-line ── */}
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

          {/* Reset: outline gray (red reserved for destructive «clear list») */}
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
      <div
        ref={wrapRef}
        className={`relative touch-none overflow-hidden rounded-2xl border border-black/5 bg-black/[0.04] p-1.5 select-none dark:border-white/5 dark:bg-[#0F0F23] ${peaks ? "cursor-ew-resize" : ""}`}
        style={{ height: CANVAS_H + 12, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid={`trim-editor-${file.name}`}
        role="slider"
        aria-label={`${translate(lang, "trimTitle")} ${formatTimecode(selStart ?? 0)} – ${formatTimecode(selEnd ?? duration)}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 10) / 10}
        aria-valuenow={Math.round(((selEnd ?? duration) - (selStart ?? 0)) * 10) / 10}
        aria-valuetext={`${formatTimecode(selStart ?? 0)} – ${formatTimecode(selEnd ?? duration)}`}
      >
        <canvas ref={canvasRef} className="h-full w-full touch-none rounded-xl" />
        {/* Invisible 44px hit-areas around each handle (touch + screen reader) */}
        {peaks && duration > 0 && (
          <>
            <button
              type="button"
              aria-label={`${translate(lang, "trimHandleStart")}: ${formatTimecode(selStart ?? 0)}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                grabHandle("start");
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  stepBound("start", -1);
                }
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  stepBound("start", 1);
                }
              }}
              className="absolute top-1/2 min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-orange-500"
              style={{ left: `${(((selStart ?? 0) / duration) * 100).toFixed(3)}%`, touchAction: "none" }}
            />
            <button
              type="button"
              aria-label={`${translate(lang, "trimHandleEnd")}: ${formatTimecode(selEnd ?? duration)}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                grabHandle("end");
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  stepBound("end", -1);
                }
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  stepBound("end", 1);
                }
              }}
              className="absolute top-1/2 min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-orange-500"
              style={{ left: `${(((selEnd ?? duration) / duration) * 100).toFixed(3)}%`, touchAction: "none" }}
            />
          </>
        )}
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
        {waveErr && (
          <div
            role="alert"
            className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-red-400"
          >
            {translate(lang, "trimWaveError")}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] font-medium text-slate-500 dark:text-zinc-400">
        {translate(lang, "trimWaveformHint")}
      </p>

      {/* ── Section: summary — compact: از/تا inputs + duration in one line ── */}
      <div
        dir={lang === "fa" ? "rtl" : "ltr"}
        className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs"
      >
        <span className="font-semibold text-slate-600 dark:text-[#CBD5E1]">
          {translate(lang, "trimFrom")}
        </span>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`trim-start-${file.path}`}
            className="text-[11px] font-semibold text-slate-600 dark:text-[#CBD5E1]"
          >
            {translate(lang, "trimStart")}
          </label>
          <input
            id={`trim-start-${file.path}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            defaultValue={selStart != null ? formatTimecode(selStart) : ""}
            key={`s-${file.path}-${selStart ?? "none"}`}
            placeholder="00:00.0"
            aria-label={`${translate(lang, "trimStart")} ${formatTimecode(selStart ?? 0)}`}
            data-testid={`trim-start-text-${file.name}`}
            onBlur={(e) => commitText("trimStartSecs", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="glass-pill h-11 min-h-[44px] w-24 rounded-xl px-2.5 text-center text-sm font-semibold tabular-nums text-zinc-800 outline-none focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#F8FAFC]"
          />
        </div>

        <span className="font-semibold text-slate-600 dark:text-[#CBD5E1]">
          {translate(lang, "trimTo")}
        </span>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`trim-end-${file.path}`}
            className="text-[11px] font-semibold text-slate-600 dark:text-[#CBD5E1]"
          >
            {translate(lang, "trimEnd")}
          </label>
          <input
            id={`trim-end-${file.path}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            defaultValue={selEnd != null ? formatTimecode(selEnd) : ""}
            key={`e-${file.path}-${selEnd ?? "none"}`}
            placeholder={formatTimecode(duration)}
            aria-label={`${translate(lang, "trimEnd")} ${formatTimecode(selEnd ?? duration)}`}
            data-testid={`trim-end-text-${file.name}`}
            onBlur={(e) => commitText("trimEndSecs", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="glass-pill h-11 min-h-[44px] w-24 rounded-xl px-2.5 text-center text-sm font-semibold tabular-nums text-zinc-800 outline-none focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#F8FAFC]"
          />
        </div>

        <p
          aria-live="polite"
          className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-[#CBD5E1]"
        >
          <span>{translate(lang, "trimSelectedDuration")}: </span>
          <span>{formatTimecode(selLen)}</span>
          <span className="font-normal opacity-70"> / {formatTimecode(duration)}</span>
        </p>
      </div>

      {/* Operation feedback — polite success, assertive error */}
      {opStatus && (
        <div
          role={opStatus.kind === "error" ? "alert" : "status"}
          aria-live={opStatus.kind === "error" ? "assertive" : "polite"}
          className={`text-xs font-medium ${opStatus.kind === "error" ? "text-red-500" : "text-slate-600 dark:text-[#CBD5E1]"}`}
        >
          {opStatus.msg}
        </div>
      )}

      {/* Hidden audio element drives audition + selection playback. */}
      {srcUrl && (
        <audio
          ref={audioRef}
          src={srcUrl}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            previewStartRef.current = null;
            previewEndRef.current = null;
            hasEnteredRangeRef.current = false;
          }}
          onTimeUpdate={onAudioTimeUpdate}
          onError={() => {
            // Broken/missing preview (e.g. staged file already deleted):
            // disable playback instead of silently no-op'ing.
            setSrcUrl(null);
            setPlaying(false);
            hasEnteredRangeRef.current = false;
          }}
        />
      )}
    </div>
  );
}
