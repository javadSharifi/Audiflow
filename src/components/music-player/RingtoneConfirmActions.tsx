import React from "react";
import { Bell, Check } from "lucide-react";
import { translate } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";

export interface RingtoneConfirmActionsProps {
  isSetting: boolean;
  isSuccess: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RingtoneConfirmActions({
  isSetting,
  isSuccess,
  onClose,
  onConfirm,
}: RingtoneConfirmActionsProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  return (
    <div className="flex gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2.5 rounded-2xl bg-black/[0.05] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
      >
        {translate(lang, "cancel")}
      </button>

      <button
        type="button"
        disabled={isSetting || isSuccess}
        onClick={onConfirm}
        className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-105 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isSuccess ? (
          <>
            <Check className="h-4 w-4 stroke-[3]" />
            <span>{translate(lang, "ringtoneSetSuccess")}</span>
          </>
        ) : isSetting ? (
          <span>{translate(lang, "ringtoneTrimming")}</span>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            <span>{translate(lang, "confirmSetRingtone")}</span>
          </>
        )}
      </button>
    </div>
  );
}
