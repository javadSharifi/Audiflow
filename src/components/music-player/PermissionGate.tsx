import { useEffect, useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { openAppSettings } from "../../utils/tauri";
import { isAndroid } from "../../utils/platform";
import { Music2, Loader2, FolderOpen } from "lucide-react";

interface PermissionGateProps {
  onSkip: () => void;
}

/**
 * First-launch gate: when media permission is denied and the library is
 * empty, cover the app with a dedicated screen that asks for access FIRST
 * and only then lets the user in — instead of an empty list plus a banner
 * the user has to discover and tap twice (the native request is
 * fire-and-forget, so the old single check-then-scan always raced it).
 * Self-sufficient: re-checks on focus/visibility so returning from system
 * Settings with a fresh grant auto-scans and dismisses the gate.
 */
export function PermissionGate({ onSkip }: PermissionGateProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const permissionStatus = useMusicPlayerStore((s) => s.permissionStatus);
  const requestMediaPermission = useMusicPlayerStore((s) => s.requestMediaPermission);
  const [waiting, setWaiting] = useState(false);

  // Returning from Settings (any tab, gate still mounted): pick up a fresh
  // grant and scan without requiring another tap.
  useEffect(() => {
    if (!isAndroid()) return;
    let cancelled = false;
    const recover = () => {
      if (document.visibilityState === "hidden") return;
      void (async () => {
        try {
          const store = useMusicPlayerStore.getState();
          await store.checkPermission();
          if (cancelled) return;
          const state = useMusicPlayerStore.getState();
          const granted =
            state.permissionStatus === "granted" ||
            state.permissionStatus === "notRequired";
          if (granted && state.tracks.length === 0 && !state.loading) {
            void state.scanLibrary();
          }
        } catch (err) {
          console.warn("Permission gate recovery check failed:", err);
        }
      })();
    };
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, []);

  const permanentlyDenied = permissionStatus === "permanentlyDenied";

  const handleAllow = async () => {
    if (waiting) return;
    setWaiting(true);
    try {
      // Polls until the system dialog is answered, then auto-scans — the
      // gate unmounts itself once the parent sees granted tracks/status.
      await requestMediaPermission();
    } finally {
      setWaiting(false);
    }
  };

  const handleOpenSettings = () => {
    try {
      openAppSettings();
    } catch (err) {
      console.warn("Open settings failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-100/95 p-6 backdrop-blur-md select-none dark:bg-[#09090b]/95 animate-in fade-in duration-200">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-black/[0.06] bg-white/80 p-8 text-center shadow-2xl dark:border-white/[0.08] dark:bg-zinc-900/80">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/30">
          <Music2 className="h-9 w-9 text-white" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "permGateTitle")}
          </h1>
          <p className="text-[13px] font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
            {translate(lang, "permGateDesc")}
          </p>
        </div>
        {permanentlyDenied ? (
          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-105 active:scale-[0.985] cursor-pointer"
          >
            <FolderOpen className="h-4 w-4" />
            <span>{translate(lang, "openSettings")}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAllow}
            disabled={waiting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-105 active:scale-[0.985] disabled:cursor-wait disabled:opacity-70 cursor-pointer"
          >
            {waiting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{translate(lang, "permGateWaiting")}</span>
              </>
            ) : (
              <span>{translate(lang, "grantPermission")}</span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400 cursor-pointer"
        >
          {translate(lang, "permGateSkip")}
        </button>
      </div>
    </div>
  );
}
