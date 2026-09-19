/**
 * Namida-style boot benchmark: phase marks logged once at splash removal.
 *
 * App.tsx marks "app-module" at module scope — AFTER its imports settle —
 * so everything before it (store creation, `loadCachedTracks` JSON parse,
 * artwork-manifest hydration) is captured in that first delta. Zero
 * dependencies, failure-tolerant, invisible unless devtools are open
 * (a Tauri webview console is only visible with devtools attached).
 */
const marks: Array<[string, number]> = [];
let t0 = -1;

export function markBoot(key: string): void {
  try {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (t0 < 0) t0 = now;
    marks.push([key, now]);
  } catch { /* best-effort: ignore */ }
}

/** Log the phase breakdown once boot settles. Never throws. */
export function logBootSummary(): void {
  try {
    if (marks.length === 0) return;
    const lines: string[] = [];
    let prev = t0;
    for (const [key, t] of marks) {
      lines.push(`  ${key}: +${(t - prev).toFixed(1)}ms`);
      prev = t;
    }
    console.info(
      `[boot] ${marks.length} phases, total ${(prev - t0).toFixed(1)}ms\n${lines.join("\n")}`,
    );
  } catch { /* best-effort: ignore */ }
}
