import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  fetchLatestRelease,
  isNewerVersion,
  type GithubReleaseInfo,
} from "../utils/githubUpdate";

const CACHE_KEY = "audiflow:update-cache";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // revalidate at most once a day

interface UpdateCache {
  checkedAt: number;
  release: GithubReleaseInfo | null;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readCache(): UpdateCache | null {
  try {
    const raw = storage()?.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

export interface GithubUpdateState {
  currentVersion: string;
  latest: GithubReleaseInfo | null;
  updateAvailable: boolean;
}

/**
 * Check GitHub for a newer release on mount, then revalidate every 24h.
 * A fresh localStorage cache is shown instantly; everything fails soft
 * (offline-first: no update UI when the check can't run).
 */
export function useGithubUpdate(): GithubUpdateState {
  const [currentVersion, setCurrentVersion] = useState("");
  const [latest, setLatest] = useState<GithubReleaseInfo | null>(() => readCache()?.release ?? null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const runCheck = async () => {
      const [version, release] = await Promise.all([
        getVersion().catch(() => ""),
        fetchLatestRelease(controller.signal),
      ]);
      if (cancelled) return;
      if (version) setCurrentVersion(version);
      if (release) {
        setLatest(release);
        try {
          storage()?.setItem(CACHE_KEY, JSON.stringify({ checkedAt: Date.now(), release } satisfies UpdateCache));
        } catch { /* best-effort: ignore */ }
      }
    };

    getVersion()
      .then((v) => {
        if (!cancelled) setCurrentVersion(v);
      })
      .catch(() => {});

    const cache = readCache();
    if (!cache || Date.now() - cache.checkedAt > CHECK_INTERVAL_MS) {
      void runCheck();
    }
    const timer = window.setInterval(() => {
      void runCheck();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const updateAvailable =
    latest !== null && currentVersion !== "" && isNewerVersion(latest.version, currentVersion);

  return { currentVersion, latest, updateAvailable };
}
