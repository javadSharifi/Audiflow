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
