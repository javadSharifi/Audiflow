import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";
import { ShieldAlert } from "lucide-react";

export function TranscribeConsentSheet({ onAccept }: { onAccept: () => void }): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const setShowConsent = useTranscribeStore((s) => s.setShowConsent);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-bold">{translate(lang, "txConsentTitle" as never)}</h2>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {translate(lang, "txConsentBody" as never)}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setShowConsent(false)}
            className="flex-1 rounded-xl border border-black/10 py-2.5 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:text-zinc-300"
          >
            {translate(lang, "txConsentLater" as never)}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 active:scale-[0.98]"
          >
            {translate(lang, "txConsentAccept" as never)}
          </button>
        </div>
      </div>
    </div>
  );
}
