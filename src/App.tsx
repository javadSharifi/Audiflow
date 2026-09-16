import { useCallback, useEffect, useRef, useState } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { MusicPlayerView } from "./components/music-player/MusicPlayerView";
import { MusicPlayerNav, type PlayerTab } from "./components/music-player/MusicPlayerNav";
import { KeepAlivePane } from "./components/music-player/KeepAlivePane";
import { PermissionGate } from "./components/music-player/PermissionGate";
import {
  FirstRunFoldersGate,
  isFirstRunDone,
  markFirstRunDone,
} from "./components/music-player/FirstRunFoldersGate";
import { Toasts } from "./components/Toasts";
import { useAppStore } from "./stores/useAppStore";
import { useMusicPlayerStore } from "./stores/useMusicPlayerStore";
import { translate } from "./i18n";
import { useTheme, useDirection } from "./hooks/useTheme";
import { openPath } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { isAndroid } from "./utils/platform";
import * as api from "./utils/tauri";
import { useNativeDragDrop } from "./hooks/useNativeDragDrop";
import { handleIncomingFiles } from "./utils/openWith";
import { ANDROID_BACK_EVENT, wasBackConsumed } from "./utils/androidBack";
import type { QueueItem } from "./types";
import { ConverterWizard } from "./components/converter-wizard/ConverterWizard";

export default function App(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const addPaths = useAppStore((s) => s.addPaths);
  const loadSettings = useAppStore((s) => s.loadSettings);
  const initEventListeners = useAppStore((s) => s.initEventListeners);

  // First-launch permission gate: while media access is denied and the
  // library is empty, a dedicated screen asks for access BEFORE entering
  // the app. Skipping is session-scoped (converter stays usable via the
  // in-list banner); a fresh grant auto-scans and dismisses the gate.
  const permStatus = useMusicPlayerStore((s) => s.permissionStatus);
  const libTracksEmpty = useMusicPlayerStore((s) => s.tracks.length === 0);
  const libHasScanned = useMusicPlayerStore((s) => s.hasScanned);
  const libLoading = useMusicPlayerStore((s) => s.loading);
  const [gateSkipped, setGateSkipped] = useState(() => {
    try {
      return sessionStorage.getItem("ac:perm-gate-skipped") === "1";
    } catch {
      return false;
    }
  });
  const skipGate = useCallback(() => {
    try {
      sessionStorage.setItem("ac:perm-gate-skipped", "1");
    } catch {}
    setGateSkipped(true);
  }, []);
  // Gate on the settled scan (not the boot race): showing it mid-scan would
  // flash it away seconds later, like the old banner-flash bug.
  const showGate =
    isAndroid() &&
    (permStatus === "denied" || permStatus === "permanentlyDenied") &&
    libTracksEmpty &&
    libHasScanned &&
    !libLoading &&
    !gateSkipped;
  const gateRef = useRef({ show: false, skip: () => {} });
  gateRef.current = { show: showGate, skip: skipGate };

  // Desktop first-run folders gate: on a fresh install (persistent flag
  // unset, empty library) let the user pick scan folders BEFORE the boot
  // scan, so each macOS folder-access prompt arrives with context. Android
  // keeps its own PermissionGate flow. The boot scan below is deferred while
  // the gate is up; onDone/onSkip run the scan instead (single call —
  // scanLibrary replaces tracks, and the gate already persisted customFolders).
  const [firstRunDone, setFirstRunDone] = useState(() => isFirstRunDone());
  const showFirstRun = !firstRunDone && !isAndroid() && libTracksEmpty;
  const handleFirstRunDone = useCallback((dirs: string[]) => {
    markFirstRunDone();
    setFirstRunDone(true);
    void useMusicPlayerStore
      .getState()
      .scanLibrary(dirs.length > 0 ? dirs : undefined)
      .catch(() => {});
  }, []);
  const handleFirstRunSkip = useCallback(() => {
    markFirstRunDone();
    setFirstRunDone(true);
    void useMusicPlayerStore.getState().scanLibrary().catch(() => {});
  }, []);

  // Android hardware back: exit selection → double-press to exit with a
  // toast on first press. The music player is a top-level destination like
  // the converter: back never navigates player → converter.
  const lastBackPress = useRef(0);
  useEffect(() => {
    if (!isAndroid()) return;
    const onAndroidBack = () => {
      if (wasBackConsumed()) return;
      const appState = useAppStore.getState();
      const musicState = useMusicPlayerStore.getState();

      if (musicState.isSelectionMode) {
        musicState.exitSelectionMode();
        return;
      }
      if (musicState.fullscreenOpen) {
        // Safety net (NowPlayingView normally consumes this first).
        musicState.setFullscreenOpen(false);
        return;
      }
      if (gateRef.current.show) {
        // Back on the permission gate = "later": enter the app, the
        // in-list banner keeps offering the grant.
        gateRef.current.skip();
        return;
      }
      // No player → converter navigation: music and converter are both
      // top-level destinations sharing the same double-press-to-exit flow.

      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        lastBackPress.current = 0;
        void api.exitApp();
        return;
      }
      lastBackPress.current = now;
      appState.pushToast("info", "pressBackAgainToExit");
    };
    window.addEventListener(ANDROID_BACK_EVENT, onAndroidBack as EventListener);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, onAndroidBack as EventListener);
  }, []);

  // Handle files opened via Open With, file association, or share sheet (cross-platform)
  useEffect(() => {
    let unlistenOpenFiles: (() => void) | null = null;
    void listen<string[]>("open-files", (e) => {
      if (e.payload && e.payload.length > 0) {
        void handleIncomingFiles(e.payload);
      }
    }).then((fn) => (unlistenOpenFiles = fn));

    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ paths?: string[] }>;
      const paths = customEvent.detail?.paths;
      if (paths && paths.length > 0) {
        void handleIncomingFiles(paths);
      }
    };

    const handleShared = (e: Event) => {
      const customEvent = e as CustomEvent<{ uri?: string }>;
      const uri = customEvent.detail?.uri;
      if (uri) {
        void handleIncomingFiles([uri]);
      }
    };

    window.addEventListener("ac:open-files", handleCustomOpen);
    window.addEventListener("ac:shared-media", handleShared);

    // Drain any cold-start files received before listeners mounted
    void api.getPendingOpenFiles().then((pending) => {
      if (pending && pending.length > 0) {
        void handleIncomingFiles(pending);
      }
    });

    return () => {
      unlistenOpenFiles?.();
      window.removeEventListener("ac:open-files", handleCustomOpen);
      window.removeEventListener("ac:shared-media", handleShared);
    };
  }, []);

  // Window-wide native drop
  const handleNativeDrop = useCallback(
    (paths: string[]) => {
      addPaths(paths);
    },
    [addPaths],
  );

  useNativeDragDrop(handleNativeDrop);

  // Cold-start gate: the static #boot-splash in index.html (already painted
  // with the correct dir/theme by the blocking boot script) stays visible
  // until settings + the initial library state settle — so the user never
  // sees an LTR flash or an empty list. Failsafe timeout guarantees the app
  // always appears even if a backend call hangs.
  const [bootReady, setBootReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const finishBoot = () => {
      if (cancelled) return;
      // The failsafe timer can outlive the JS environment (e.g. test
      // teardown) — never touch window/document blindly from it.
      if (typeof window === "undefined" || typeof document === "undefined") return;
      try {
        document.getElementById("boot-splash")?.remove();
      } catch {}
      setBootReady(true);
    };
    const boot = async () => {
      // Theme class is owned SOLELY by useTheme() (single writer). Writing it
      // here too caused double style recalc per settings load; Rhythm similarly
      // keeps one remembered color-scheme source to avoid recomposition storms.
      try {
        await loadSettings();
      } catch {}
      if (cancelled) return;
      // Library: cached tracks (if any) are already in the store and render
      // instantly — refresh them in the background. Only a truly empty
      // library blocks the splash on a live scan.
      try {
        const music = useMusicPlayerStore.getState();
        await music.checkPermission().catch(() => {});
        if (cancelled) return;
        // First-run gate pending: leave the initial scan to its
        // onDone/onSkip handlers (they scan once with the user selection).
        if (!isFirstRunDone() && !isAndroid() && useMusicPlayerStore.getState().tracks.length === 0) {
          finishBoot();
          return;
        }
        const cached = useMusicPlayerStore.getState().tracks.length;
        if (cached > 0) {
          void useMusicPlayerStore.getState().scanLibrary().catch(() => {});
        } else {
          await useMusicPlayerStore.getState().scanLibrary().catch(() => {});
        }
      } catch {}
      finishBoot();
    };
    const failsafe =
      typeof window !== "undefined" ? window.setTimeout(finishBoot, 8000) : 0;
    const clearFailsafe = () => {
      try {
        if (typeof window !== "undefined") window.clearTimeout(failsafe);
      } catch {}
    };
    void boot().finally(clearFailsafe);
    return () => {
      cancelled = true;
      clearFailsafe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    void initEventListeners().then((fn) => (cleanup = fn));

    let unlistenIdle: (() => void) | null = null;
    void listen<boolean>("queue-idle", () => {
      if (isAndroid()) return;
      const { settings, jobs } = useAppStore.getState();
      if (!settings?.autoOpenOutputFolder) return;
      const done = Array.from(jobs.values()).find(
        (j: QueueItem) => j.status === "completed" && j.outputs.length > 0,
      );
      if (done) {
        const dir = done.outputs[0].replace(/[\\/][^\\/]+$/, "");
        void openPath(dir);
      }
    }).then((fn) => (unlistenIdle = fn));

    return () => {
      cleanup?.();
      unlistenIdle?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronize document title with active tool
  useEffect(() => {
    document.title =
      activeTool === "player"
        ? translate(lang, "musicPlayerTitle")
        : translate(lang, "appTitle");
  }, [activeTool, lang]);

  useTheme();
  useDirection(lang);

  const isConverter = activeTool === "converter";
  const fullscreenOpen = useMusicPlayerStore((s) => s.fullscreenOpen);
  const [playerTab, setPlayerTab] = useState<PlayerTab>("songs");

  const handleSelectPlayerTab = useCallback(
    (tab: PlayerTab) => {
      setActiveTool("player");
      setPlayerTab(tab);
      useMusicPlayerStore.getState().setFullscreenOpen(false);
    },
    [setActiveTool],
  );

  // Until boot settles, render nothing: the static #boot-splash (correct
  // dir/theme from the blocking boot script) covers the screen instead of a
  // half-painted LTR layout.
  if (!bootReady) return <></>;

  return (
    <div className="relative flex h-screen max-w-full flex-col overflow-hidden overflow-x-hidden bg-zinc-100/90 text-zinc-900 select-none dark:bg-[#09090b] dark:text-zinc-100">
      <HeaderBar />

      <main className="relative z-10 flex w-full flex-1 flex-col min-h-0 overflow-hidden">
        <KeepAlivePane active={isConverter} lazy={false}>
          <ConverterWizard />
        </KeepAlivePane>
        <KeepAlivePane active={!isConverter} lazy={false}>
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col min-h-0 overflow-hidden px-4 pt-4 md:px-6 pb-4">
            <MusicPlayerView activeTab={playerTab} onSelectTab={handleSelectPlayerTab} />
          </div>
        </KeepAlivePane>
      </main>

      {/* Unified bottom navigation (converter + player tabs), hidden in
          fullscreen so sheets sit on top without nav bleeding through */}
      {!fullscreenOpen && (
        <MusicPlayerNav activeTab={playerTab} onSelectTab={handleSelectPlayerTab} />
      )}

      <Toasts />

      {/* First-launch permission gate (Android, denied + empty library) */}
      {showGate && <PermissionGate onSkip={skipGate} />}

      {/* First-run folders gate (desktop, unset flag + empty library) */}
      {showFirstRun && (
        <FirstRunFoldersGate onDone={handleFirstRunDone} onSkip={handleFirstRunSkip} />
      )}
    </div>
  );
}
