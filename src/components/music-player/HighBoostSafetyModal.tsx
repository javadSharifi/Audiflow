import { AlertTriangle } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

export interface HighBoostSafetyModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HighBoostSafetyModal({
  isOpen,
  onConfirm,
  onCancel,
}: HighBoostSafetyModalProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/15 p-5 shadow-2xl flex flex-col gap-4 text-center animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 shadow-md">
          <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "highBoostModalTitle")}
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {translate(lang, "highBoostModalDesc")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors active:scale-95 cursor-pointer"
          >
            {translate(lang, "highBoostCancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition-all active:scale-95 cursor-pointer"
          >
            {translate(lang, "highBoostConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
