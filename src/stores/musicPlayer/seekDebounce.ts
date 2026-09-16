/**
 * Trailing seek coalescing for scrub bursts (003-volume-boost-accuracy US2).
 *
 * A fast scrub emits a seek per pointer movement; sending every one to the
 * native player stacks overlapping decoder discontinuities that the booster
 * amplifies into sustained crackle. This helper applies the first request
 * immediately (zero added latency for isolated seeks) and coalesces any
 * further requests inside the window into a single trailing apply of the
 * final position. See `contracts/seek-debounce.contract.md`.
 */
export interface SeekDebouncer {
  request(targetSecs: number): void;
  cancel(): void;
}

export function createSeekDebouncer(
  apply: (targetSecs: number) => void,
  windowMs = 1000,
): SeekDebouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: number | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    request(targetSecs: number): void {
      if (!Number.isFinite(targetSecs)) return;
      if (timer === null) {
        apply(targetSecs);
        timer = setTimeout(() => {
          timer = null;
          if (pending !== null) {
            const finalTarget = pending;
            pending = null;
            apply(finalTarget);
          }
        }, windowMs);
      } else {
        pending = targetSecs;
      }
    },
    cancel(): void {
      clearTimer();
      pending = null;
    },
  };
}
