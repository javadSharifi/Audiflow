/**
 * Open an external https URL in the system browser. Uses the Tauri opener
 * plugin when available (dynamic import so unit-test mocks of
 * `@tauri-apps/plugin-opener` that only stub `openPath` keep working),
 * falling back to `window.open` otherwise.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const mod = (await import("@tauri-apps/plugin-opener")) as unknown as {
      openUrl?: (u: string) => Promise<void>;
    };
    if (typeof mod.openUrl === "function") {
      await mod.openUrl(url);
      return;
    }
  } catch { /* best-effort: ignore */ }
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch { /* best-effort: ignore */ }
}
