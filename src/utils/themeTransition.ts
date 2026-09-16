/**
 * Circular-reveal theme switching built on the View Transitions API.
 *
 * The new theme expands as a circle from the toggle click point
 * (`clip-path: circle()`, see `src/index.css`). Only `clip-path` animates,
 * so the transition stays GPU-cheap (~300ms, minimal lag feel).
 *
 * Clarify decisions encoded here: instant fallback where the API is missing
 * (Q2=A) and no `prefers-reduced-motion` opt-out (Q3=C) — the reveal always
 * runs when the API is available.
 */

export const THEME_REVEAL_DURATION_MS = 300;

interface ViewTransitionLike {
  readonly finished: Promise<void>;
}

type StartViewTransitionFn = (update: () => void | Promise<void>) => ViewTransitionLike;

let inFlight: ViewTransitionLike | null = null;

function getStarter(): StartViewTransitionFn | null {
  if (typeof document === "undefined") return null;
  const candidate = (document as unknown as Record<string, unknown>).startViewTransition;
  if (typeof candidate !== "function") return null;
  return candidate as StartViewTransitionFn;
}

/** Farthest-corner distance so the circle always covers the whole viewport. */
export function computeRevealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

/** Click point, falling back to the invoker's center for keyboard activation. */
export function revealOrigin(event: {
  clientX: number;
  clientY: number;
  currentTarget: unknown;
}): { x: number; y: number } {
  if (event.clientX !== 0 || event.clientY !== 0) {
    return { x: event.clientX, y: event.clientY };
  }
  if (typeof HTMLElement !== "undefined" && event.currentTarget instanceof HTMLElement) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  if (typeof window !== "undefined") {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  return { x: 0, y: 0 };
}

/**
 * Runs `apply` inside a circular-reveal transition expanding from (x, y).
 * Falls back to an instant apply when the API is unavailable or a transition
 * is already running — rapid toggles never queue, the state always wins.
 */
export function revealThemeChange(x: number, y: number, apply: () => void): void {
  if (typeof document === "undefined") {
    apply();
    return;
  }
  const starter = getStarter();
  if (!starter || inFlight) {
    apply();
    return;
  }
  const root = document.documentElement;
  root.style.setProperty("--reveal-x", `${x}px`);
  root.style.setProperty("--reveal-y", `${y}px`);
  root.style.setProperty(
    "--reveal-r",
    `${computeRevealRadius(x, y, window.innerWidth, window.innerHeight)}px`,
  );
  try {
    const transition = starter(() => {
      apply();
    });
    inFlight = transition;
    const clear = () => {
      if (inFlight === transition) inFlight = null;
    };
    transition.finished.then(clear, clear);
  } catch {
    inFlight = null;
    apply();
  }
}

/** Test-only reset for the in-flight guard. */
export function __resetThemeTransitionForTests(): void {
  inFlight = null;
}
