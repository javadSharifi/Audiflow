import { useCallback, useRef, useState } from "react";
import { clampTime } from "./geometry";

export interface UseWaveformAudioOptions {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  srcUrl: string | null;
  duration: number;
  selStart: number;
  selEnd: number;
  scrubOffset?: number;
  onAudioError?: () => void;
  resetOnEnd?: "start" | "end" | "none";
}

export function useWaveformAudio(options: UseWaveformAudioOptions) {
  const {
    audioRef,
    srcUrl,
    duration,
    selStart,
    selEnd,
    scrubOffset = 0.05,
    onAudioError,
    resetOnEnd = "none",
  } = options;

  const [playing, setPlaying] = useState(false);

  const previewStartRef = useRef<number | null>(null);
  const previewEndRef = useRef<number | null>(null);
  const hasEnteredRangeRef = useRef(false);

  const audition = useCallback(
    (t: number) => {
      const a = audioRef.current;
      if (!a || !srcUrl || duration <= 0) return;
      previewStartRef.current = null;
      previewEndRef.current = null;
      hasEnteredRangeRef.current = false;
      try {
        a.currentTime = Math.max(0, clampTime(t, duration) - scrubOffset);
      } catch {
        /* ignore */
      }
      if (a.paused) {
        void a.play().catch(() => {});
      }
    },
    [audioRef, duration, scrubOffset, srcUrl],
  );

  const stopAudition = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) {
      a.pause();
    }
    previewEndRef.current = null;
    previewStartRef.current = null;
    hasEnteredRangeRef.current = false;
  }, [audioRef]);

  const playRange = useCallback(
    (from: number, to: number) => {
      const a = audioRef.current;
      if (!a || !srcUrl) return;

      const effDur =
        Number.isFinite(a.duration) && a.duration > 0
          ? Math.min(duration, a.duration)
          : duration;

      const cleanFrom = Math.max(0, Math.min(effDur, from));
      const cleanTo = Math.max(cleanFrom + 0.05, Math.min(effDur, to));
      if (cleanTo - cleanFrom <= 0.01) return;

      previewStartRef.current = cleanFrom;
      previewEndRef.current = cleanTo;
      hasEnteredRangeRef.current = false;

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
    [audioRef, duration, srcUrl],
  );

  const playSelection = useCallback(() => {
    const a = audioRef.current;
    if (!a || !srcUrl) return;
    if (!a.paused) {
      a.pause();
      setPlaying(false);
      return;
    }
    playRange(selStart, selEnd);
  }, [audioRef, playRange, selEnd, selStart, srcUrl]);

  const onAudioTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (!a || a.paused || a.seeking) return;

    const targetStart = previewStartRef.current;
    const targetEnd = previewEndRef.current ?? selEnd;

    if (targetStart != null && !hasEnteredRangeRef.current) {
      if (Math.abs(a.currentTime - targetStart) <= 0.6) {
        hasEnteredRangeRef.current = true;
      } else {
        return;
      }
    }

    if (a.currentTime >= targetEnd) {
      a.pause();
      if (resetOnEnd === "start") {
        try {
          a.currentTime = selStart;
        } catch {
          /* ignore */
        }
      } else if (resetOnEnd === "end") {
        try {
          a.currentTime = targetEnd;
        } catch {
          /* ignore */
        }
      }
      previewEndRef.current = null;
      previewStartRef.current = null;
      hasEnteredRangeRef.current = false;
      setPlaying(false);
    }
  }, [audioRef, resetOnEnd, selEnd, selStart]);

  const onAudioEnded = useCallback(() => {
    setPlaying(false);
    previewStartRef.current = null;
    previewEndRef.current = null;
    hasEnteredRangeRef.current = false;
  }, []);

  const handleAudioError = useCallback(() => {
    setPlaying(false);
    previewStartRef.current = null;
    previewEndRef.current = null;
    hasEnteredRangeRef.current = false;
    onAudioError?.();
  }, [onAudioError]);

  return {
    playing,
    setPlaying,
    audition,
    stopAudition,
    playRange,
    playSelection,
    onAudioTimeUpdate,
    onAudioEnded,
    handleAudioError,
    previewStartRef,
    previewEndRef,
    hasEnteredRangeRef,
  };
}
