/**
 * Leading + throttled + trailing gain applier (004-boost-slider-debounce US1).
 *
 * Dragging the boost slider emits a gain request per tick; applying every
 * one restarts the engine each time (Android: IPC fan-out + enhancer
 * reconvergence = audible chop). This helper applies the first request
 * immediately (zero added latency for taps/toggles), coalesces the burst
 * into at most one intermediate apply per interval carrying the latest
 * value (smooth glide), and always flushes the final value afterwards.
 * See `contracts/gain-glide.contract.md`.
 */
export interface GainGlider {
  request(percent: number): void;
  cancel(): void;
}

export function createGainGlider(
  apply: (percent: number) => void,
  intervalMs = 150,
): GainGlider {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: number | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const armWindow = () => {
    clearTimer();
    timer = setTimeout(onWindowLapse, intervalMs);
  };

  const onWindowLapse = () => {
    timer = null;
    if (pending !== null) {
      const latest = pending;
      pending = null;
      apply(latest);
      // Keep gliding while the burst continues; the window closes on the
      // first lapse with nothing pending (final value already flushed).
      armWindow();
    }
  };

  return {
    request(percent: number): void {
      if (!Number.isFinite(percent)) return;
      if (timer === null) {
        apply(percent);
        armWindow();
      } else {
        pending = percent;
      }
    },
    cancel(): void {
      clearTimer();
      pending = null;
    },
  };
}
