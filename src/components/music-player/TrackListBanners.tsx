import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { openAppSettings } from "../../utils/tauri";
import { ShieldAlert, BellOff, X } from "lucide-react";

export interface TrackListBannersProps {
  isPermissionDenied: boolean;
  permissionStatus: string | null;
  notifBlocked: boolean;
  notifDismissed: boolean;
  hasTracks: boolean;
  onRequestPermission: () => Promise<void>;
  onDismissNotif: () => void;
}

export function TrackListBanners({
  isPermissionDenied,
  permissionStatus,
  notifBlocked,
  notifDismissed,
  hasTracks,
  onRequestPermission,
  onDismissNotif,
}: TrackListBannersProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);

  const handleOpenSettings = async () => {
    try {
      await openAppSettings();
    } catch (err) {
      console.warn("Open settings failed:", err);
    }
  };

  return (
    <>
      {/* Permission Warning Banner */}
      {isPermissionDenied && (
        <div className="shrink-0 flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-bold">{translate(lang, "musicPermissionTitle")}</span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                {translate(lang, "musicPermissionDesc")}
              </span>
            </div>
          </div>
          {permissionStatus === "permanentlyDenied" ? (
            <button
              type="button"
              onClick={handleOpenSettings}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-all shrink-0 cursor-pointer shadow-sm"
            >
              {translate(lang, "openSettings")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onRequestPermission()}
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold transition-all shrink-0 cursor-pointer shadow-sm"
            >
              {translate(lang, "grantPermission")}
            </button>
          )}
        </div>
      )}

      {/* Notification Guidance Banner */}
      {notifBlocked && !notifDismissed && hasTracks && (
        <div className="shrink-0 flex items-center justify-between gap-3 p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-900 dark:text-sky-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <BellOff className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold">{translate(lang, "notifBannerTitle")}</span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                {translate(lang, "notifBannerDesc")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenSettings}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-sm"
            >
              {translate(lang, "openSettings")}
            </button>
            <button
              type="button"
              onClick={onDismissNotif}
              title={translate(lang, "close")}
              aria-label={translate(lang, "close")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
