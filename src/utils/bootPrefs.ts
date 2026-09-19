import type { Lang } from "../i18n";

export type BootTheme = "light" | "dark" | "system";

export interface BootPrefs {
  language: Lang;
  theme: BootTheme;
}

/** Synchronous cache read by the blocking boot script in index.html. */
export const BOOT_PREFS_KEY = "ac:ui-prefs";

export function readBootPrefs(): BootPrefs | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(BOOT_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BootPrefs>;
    const language = parsed.language === "en" || parsed.language === "fa" ? parsed.language : null;
    const theme =
      parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
        ? parsed.theme
        : null;
    if (!language || !theme) return null;
    return { language, theme };
  } catch {
    return null;
  }
}

export function writeBootPrefs(prefs: BootPrefs): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(BOOT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable or full — boot falls back to fa/rtl defaults */
  }
}

/** Persistent first-run flag (localStorage: must survive restarts). */
export const FIRST_RUN_DONE_KEY = "ac:first-run-done";
export const REDUCED_BLUR_KEY = "ac:reduced-blur";
export const TRACKS_CACHE_KEY = "player-tracks-cache-v1";

export function isFirstRunDone(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(FIRST_RUN_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstRunDone(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FIRST_RUN_DONE_KEY, "1");
  } catch { /* best-effort: ignore */ }
}

/**
 * Checks whether onboarding has completed or if prior-use evidence exists.
 * Constraints per data-model.md:
 * - "written only via confirm or global skip; never written by section-level interaction or permission grant/deny"
 * - "absent → complete (confirm/skip, or silent grandfathering on upgrade with prior-use evidence)"
 *
 * Returns true if onboarding should be skipped/bypassed (completed or grandfathered).
 * Returns false if the start page must be displayed on fresh install.
 */
export function checkAndGrandfatherFirstRun(): boolean {
  if (isFirstRunDone()) {
    return true;
  }
  try {
    if (typeof localStorage === "undefined") return false;
    const hasUiPrefs = localStorage.getItem(BOOT_PREFS_KEY) !== null;
    const hasReducedBlur = localStorage.getItem(REDUCED_BLUR_KEY) !== null;
    let hasCachedTracks = false;
    const rawTracks = localStorage.getItem(TRACKS_CACHE_KEY);
    if (rawTracks) {
      try {
        const parsed = JSON.parse(rawTracks);
        hasCachedTracks = Array.isArray(parsed) && parsed.length > 0;
      } catch {
        hasCachedTracks = false;
      }
    }

    if (hasUiPrefs || hasReducedBlur || hasCachedTracks) {
      markFirstRunDone();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

