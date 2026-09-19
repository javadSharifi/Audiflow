import React, { useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { isAndroid } from "../../utils/platform";
import { openAppSettings } from "../../utils/tauri";
import { pickDirectories } from "../../utils/dialog";
import { persistCustomFolders } from "../../stores/musicPlayer/persistence";
import { ShieldCheck, CheckCircle2, FolderOpen, ExternalLink, Loader2 } from "lucide-react";

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
    <div className="flex flex-col gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-zinc-900/80 p-2.5 sm:p-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
            <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "onboardingSectionPermissions")}
            </h2>
            <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400">
              {translate(lang, "onboardingSectionPermissionsDesc")}
            </p>
          </div>
        </div>

        {isGranted && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>{translate(lang, "onboardingPermGranted")}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isGranted && !skipped && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 sm:pt-2">
          {isAndroid() ? (
            isPermanentlyDenied ? (
              <button
                type="button"
                onClick={handleOpenSettings}
                className="flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 transition-all hover:brightness-105 active:scale-[0.985] cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{translate(lang, "onboardingPermOpenSettings")}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGrant}
                disabled={waiting}
                className="flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 transition-all hover:brightness-105 active:scale-[0.985] disabled:cursor-wait disabled:opacity-70 cursor-pointer"
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
              className="flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-zinc-200/80 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-zinc-800 transition-colors hover:bg-zinc-300 active:scale-[0.985] dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>
                {selectedFolderCount > 0
                  ? `${selectedFolderCount} ${translate(lang, "onboardingPermDesktopSelect")}`
                  : translate(lang, "onboardingPermDesktopSelect")}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSkip}
            className="px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
          >
            {translate(lang, "onboardingPermSkip")}
          </button>
        </div>
      )}

      {skipped && !isGranted && (
        <div className="pt-1 text-xs text-zinc-400 italic dark:text-zinc-500">
          {translate(lang, "onboardingPermSkip")}
        </div>
      )}
    </div>
  );
}
