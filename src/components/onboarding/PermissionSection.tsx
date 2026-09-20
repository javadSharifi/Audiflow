import React, { useEffect, useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { isAndroid } from "../../utils/platform";
import { openAppSettings } from "../../utils/tauri";
import { pickDirectories } from "../../utils/dialog";
import { persistCustomFolders } from "../../stores/musicPlayer/persistence";
import { ShieldCheck, Check, FolderOpen, ExternalLink, Loader2 } from "lucide-react";

export interface PermissionSectionProps {
  onSkipSection?: () => void;
}

/**
 * Permission section of onboarding.
 * Constraints per data-model.md:
 * - "granted | denied | permanentlyDenied | skipped | notRequired"
 * - "no permission state blocks onboarding completion or later app use; permanentlyDenied routes the user to OS settings instead of a dead-end retry"
 */
export function PermissionSection({ onSkipSection }: PermissionSectionProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const permissionStatus = useMusicPlayerStore((s) => s.permissionStatus);
  const requestMediaPermission = useMusicPlayerStore((s) => s.requestMediaPermission);

  const [waiting, setWaiting] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [selectedFolderCount, setSelectedFolderCount] = useState(0);

  useEffect(() => {
    if (!isAndroid()) return;
    const onFocus = () => {
      void useMusicPlayerStore.getState().checkPermission();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const isGranted = permissionStatus === "granted" || permissionStatus === "notRequired";
  const isPermanentlyDenied = permissionStatus === "permanentlyDenied";

  const handleGrant = async () => {
    if (waiting) return;
    setWaiting(true);
    try {
      await requestMediaPermission();
    } catch (err) {
      console.warn("Permission request failed:", err);
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

  const handlePickFolders = async () => {
    try {
      const picked = await pickDirectories();
      if (picked.length > 0) {
        persistCustomFolders(picked);
        setSelectedFolderCount(picked.length);
      }
    } catch (err) {
      console.warn("Folder picking failed:", err);
    }
  };

  const handleSkip = () => {
    setSkipped(true);
    onSkipSection?.();
  };

  return (
    <section
      className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#0F1523]/75 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.09),inset_0_-1px_1px_0_rgba(0,0,0,0.4)] hover:border-slate-300 dark:hover:border-white/15 transition-all"
      data-purpose="permissions-card"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/5 border border-orange-500/30 flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0 shadow-inner">
            <ShieldCheck className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                {translate(lang, "onboardingSectionPermissions")}
              </h2>
              {translate(lang, "onboardingBadgeRequired") ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20">
                  {translate(lang, "onboardingBadgeRequired")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {isGranted ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-[11px] font-semibold shadow-[0_0_20px_-3px_rgba(16,185,129,0.35)] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span>{translate(lang, "onboardingPermGranted")}</span>
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        ) : (
          !skipped && (
            <div className="flex items-center gap-1.5 shrink-0">
              {isAndroid() ? (
                isPermanentlyDenied ? (
                  <button
                    type="button"
                    onClick={handleOpenSettings}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 transition-all hover:brightness-105 active:scale-[0.985] cursor-pointer shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{translate(lang, "onboardingPermOpenSettings")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGrant}
                    disabled={waiting}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 transition-all hover:brightness-105 active:scale-[0.985] disabled:cursor-wait disabled:opacity-70 cursor-pointer shrink-0"
                  >
                    {waiting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    <span>{translate(lang, "onboardingPermGrant")}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handlePickFolders}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-slate-600 transition-colors hover:border-slate-900/20 active:scale-[0.985] dark:border-white/10 dark:bg-black/40 dark:text-slate-300 dark:hover:border-white/20 cursor-pointer shrink-0"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>
                    {selectedFolderCount > 0
                      ? `${selectedFolderCount} ${translate(lang, "onboardingPermDesktopSelect")}`
                      : translate(lang, "onboardingPermDesktopSelect")}
                  </span>
                </button>
              )}

              {/* Skip button visually hidden */}
              <button
                type="button"
                onClick={handleSkip}
                className="sr-only"
              >
                {translate(lang, "onboardingPermSkip")}
              </button>
            </div>
          )
        )}
      </div>
    </section>
  );
}
