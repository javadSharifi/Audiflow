/**
 * GitHub release check helpers (pure, Tauri-free so they're unit-testable).
 *
 * The app has no Tauri updater plugin — releases ship as store/bundle
 * artifacts via `.github/workflows/release.yml` — so the frontend polls the
 * public GitHub Releases API and deep-links to the release page.
 */

export const GITHUB_REPO = "javadSharifi/Audiflow";
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GithubReleaseInfo {
  version: string;
  name: string;
  url: string;
  notes: string;
  assets?: GithubReleaseAsset[];
}

interface GithubReleaseApiResponse {
  tag_name?: string;
  name?: string;
  html_url?: string;
  body?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
    size?: number;
  }>;
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
    const tagName = data.tag_name;
    const assets: GithubReleaseAsset[] = (data.assets || [])
      .filter((a): a is { name: string; browser_download_url: string; size?: number } => Boolean(a.name && a.browser_download_url))
      .map((a) => ({
        name: a.name,
        browser_download_url: a.browser_download_url,
        size: a.size ?? 0,
      }));

    return {
      version: normalizeVersion(tagName),
      name: data.name?.trim() || tagName,
      url: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
      notes: data.body?.trim() || "",
      assets,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the direct download URL for the current operating system
 * from the release assets (APK for Android, DMG for macOS, EXE for Windows, DEB/AppImage for Linux).
 * Falls back to the release HTML page if no matching asset is found.
 */
export function resolvePlatformDownloadUrl(
  release: GithubReleaseInfo,
  platform: { isAndroid: boolean; isMacOS: boolean; isWindows: boolean }
): string {
  const assets = release.assets || [];
  if (assets.length === 0) return release.url;

  if (platform.isAndroid) {
    const apk = assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
    if (apk) return apk.browser_download_url;
  } else if (platform.isMacOS) {
    const dmg = assets.find((a) => a.name.toLowerCase().endsWith(".dmg"));
    if (dmg) return dmg.browser_download_url;
  } else if (platform.isWindows) {
    const exe = assets.find((a) => a.name.toLowerCase().endsWith(".exe"));
    if (exe) return exe.browser_download_url;
  } else {
    // Linux
    const linux = assets.find(
      (a) =>
        a.name.toLowerCase().endsWith(".appimage") ||
        a.name.toLowerCase().endsWith(".deb")
    );
    if (linux) return linux.browser_download_url;
  }

  return release.url;
}
