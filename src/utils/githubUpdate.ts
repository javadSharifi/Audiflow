/**
 * GitHub release check helpers (pure, Tauri-free so they're unit-testable).
 *
 * The app has no Tauri updater plugin — releases ship as store/bundle
 * artifacts via `.github/workflows/release.yml` — so the frontend polls the
 * public GitHub Releases API and deep-links to the release page.
 */

export const GITHUB_REPO = "javadSharifi/audio-converter";
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface GithubReleaseInfo {
  version: string;
  name: string;
  url: string;
  notes: string;
}

interface GithubReleaseApiResponse {
  tag_name?: string;
  name?: string;
  html_url?: string;
  body?: string;
}

/** Strip leading `v`/`=` and whitespace: `v1.4.4` -> `1.4.4`. */
export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^[v=\s]+/, "");
}

/**
 * True when `latest` is strictly newer than `current`.
 * Compares numeric segments only (`1.4.10` > `1.4.3`); pre-release suffixes
 * (`-beta.1`) are ignored for ordering but a bare release beats its
 * pre-release with the same numbers.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const num = (v: string) => normalizeVersion(v).split("-")[0].split(".").map((p) => Number(p) || 0);
  const l = num(latest);
  const c = num(current);
  const len = Math.max(l.length, c.length);
  for (let i = 0; i < len; i++) {
    const a = l[i] ?? 0;
    const b = c[i] ?? 0;
    if (a !== b) return a > b;
  }
  // Same numbers: a stable release outranks its own pre-release tag.
  const lPre = normalizeVersion(latest).includes("-");
  const cPre = normalizeVersion(current).includes("-");
  return cPre && !lPre;
}

/** Fetch the latest GitHub release. Fail-soft: returns null offline/on error. */
export async function fetchLatestRelease(signal?: AbortSignal): Promise<GithubReleaseInfo | null> {
  try {
    const res = await fetch(LATEST_RELEASE_URL, {
      signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GithubReleaseApiResponse;
    if (!data.tag_name) return null;
    return {
      version: normalizeVersion(data.tag_name),
      name: data.name?.trim() || data.tag_name,
      url: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
      notes: data.body?.trim() || "",
    };
  } catch {
    return null;
  }
}
