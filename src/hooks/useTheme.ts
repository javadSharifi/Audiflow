import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";

export type Resolved = "light" | "dark";

/** Synchronously paints the resolved theme onto <html>. */
export function applyResolvedTheme(resolved: Resolved): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function resolveTheme(pref: "light" | "dark" | "system"): Resolved {
  if (pref !== "system") return pref;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

/** Applies the theme to <html> and reacts to OS changes in system mode. */
export function useTheme(): void {
  const theme = useAppStore((s) => s.theme);
  const reducedBlur = useAppStore((s) => s.reducedBlur);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("perf-mode", reducedBlur);
    }
  }, [reducedBlur]);

  useEffect(() => {
    const apply = () => {
      applyResolvedTheme(resolveTheme(theme));
    };
    apply();
    if (theme !== "system") return;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    }
  }, [theme]);
}

/** Keeps <html lang> in sync with UI language. Layout stays locked to LTR
 *  by design — only strings localize, styling never mirrors. */
export function useDirection(lang: "en" | "fa"): void {
  useEffect(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = lang;
  }, [lang]);
}
