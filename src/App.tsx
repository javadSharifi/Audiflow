import { useCallback, useEffect, useRef, useState } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { DropZone } from "./components/DropZone";
import { FileList } from "./components/FileList";
import { OptionsPanel } from "./components/OptionsPanel";
import { JobsPanel } from "./components/JobsPanel";
import { MusicPlayerView } from "./components/music-player/MusicPlayerView";
import { PermissionGate } from "./components/music-player/PermissionGate";
import { Toasts } from "./components/Toasts";
import { useAppStore } from "./stores/useAppStore";
import { useMusicPlayerStore } from "./stores/useMusicPlayerStore";
import { translate } from "./i18n";
import { useTheme, useDirection } from "./hooks/useTheme";
import { openPath } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { isLossy } from "./types";
import { isAndroid } from "./utils/platform";
import * as api from "./utils/tauri";
import { useNativeDragDrop } from "./hooks/useNativeDragDrop";
import { handleIncomingFiles } from "./utils/openWith";
import { ANDROID_BACK_EVENT, wasBackConsumed } from "./utils/androidBack";
import { Loader2, Play } from "lucide-react";
import type { QueueItem } from "./types";

function StartBar(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const files = useAppStore((s) => s.files);
  const options = useAppStore((s) => s.options);
  const jobs = useAppStore((s) => s.jobs);
  const starting = useAppStore((s) => s.starting);
  const startQueue = useAppStore((s) => s.startQueue);
  const pushToast = useAppStore((s) => s.pushToast);

  const validCount = files.filter((f) => !f.error && f.hasAudio).length;
  const busy = Array.from(jobs.values()).some((j) =>
    ["waiting", "processing"].includes(j.status),
  );

  const disabled =
    validCount === 0 ||
    busy ||
    starting ||
    (isLossy(options.format) && options.quality === "custom" && !options.customBitrateKbps) ||
    (options.splitEnabled &&
      (options.splitDurationSecs === null ||
        !Number.isFinite(options.splitDurationSecs) ||
        options.splitDurationSecs <= 0)) ||
    (options.outputMode === "custom_folder" && !options.customOutputDir);

  const onStart = () => {
    if (disabled) return;
    if (validCount < files.length) pushToast("warning", "errSomeFilesInvalid");
    void startQueue();
  };

  return (
    <button
      onClick={onStart}
      disabled={disabled}
      data-testid="start-conversion"
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:brightness-105 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    >
      {busy || starting ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
          <span>{translate(lang, "statusProcessing")}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Play className="h-4 w-4 fill-current" strokeWidth={0} />
          <span>{translate(lang, "startConversion")}</span>
        </span>
      )}
    </button>
  );
}

export default function App(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const activeTool = useAppStore((s) => s.activeTool);
  const files = useAppStore((s) => s.files);
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

  // Until boot settles, render nothing: the static #boot-splash (correct
  // dir/theme from the blocking boot script) covers the screen instead of a
  // half-painted LTR layout.
  if (!bootReady) return <></>;

  return (
    <div className="relative flex h-screen max-w-full flex-col overflow-hidden overflow-x-hidden bg-zinc-100/90 text-zinc-900 select-none dark:bg-[#09090b] dark:text-zinc-100">
      <HeaderBar />

      <main
        className={`relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-x-hidden px-4 pt-4 md:gap-5 md:px-6 min-h-0 ${
          isConverter
            ? `overflow-y-auto ${files.length > 0 ? "pb-36" : "pb-24"} py-5`
            : "overflow-hidden pb-4"
        }`}
      >
        {isConverter ? (
          <>
            {files.length === 0 && <DropZone />}
            <FileList />
            <OptionsPanel />
            <JobsPanel />
          </>
        ) : (
          <MusicPlayerView />
        )}
      </main>

      {/* Converter Start Bar */}
      {isConverter && files.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/[0.06] bg-white/95 backdrop-blur-md px-4 py-3 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900/95 md:px-6">
          <div className="mx-auto w-full max-w-4xl">
            <StartBar />
          </div>
        </div>
      )}

      <Toasts />

      {/* First-launch permission gate (Android, denied + empty library) */}
      {showGate && <PermissionGate onSkip={skipGate} />}
    </div>
  );
}
