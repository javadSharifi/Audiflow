import { useState } from "react";
import { openExternalUrl } from "../../utils/externalUrl";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";
import { ErrorBanner } from "./ErrorBanner";
import { KeyRound, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";

export function OnboardingCard({ onVerify }: { onVerify: (key: string) => void }): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const verifying = useTranscribeStore((s) => s.verifying);
  const keyErrorKind = useTranscribeStore((s) => s.keyErrorKind);
  const keyErrorMessage = useTranscribeStore((s) => s.keyErrorMessage);
  const keyJustSaved = useTranscribeStore((s) => s.keyJustSaved);
  const [draft, setDraft] = useState("");

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
          <KeyRound className="h-4.5 w-4.5" />
        </span>
        <h2 className="text-sm font-bold">{translate(lang, "txOnboardTitle" as never)}</h2>
      </div>

      <ol className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
        <li>1. {translate(lang, "txOnboardStep1" as never)}</li>
        <li>2. {translate(lang, "txOnboardStep2" as never)}</li>
        <li>3. {translate(lang, "txOnboardStep3" as never)}</li>
      </ol>

      <button
        type="button"
        onClick={() => void openExternalUrl("https://aistudio.google.com/apikey")}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:brightness-105 active:scale-95"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {translate(lang, "txGetFreeKey" as never)}
      </button>

      <div className="mt-4 flex flex-col gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={translate(lang, "txPastePlaceholder" as never)}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-black/10 bg-zinc-50 px-3 py-2.5 font-mono text-xs outline-none placeholder:font-sans focus:border-orange-500 dark:border-white/10 dark:bg-zinc-800"
        />
        <button
          type="button"
          disabled={verifying || draft.trim().length === 0}
          onClick={() => onVerify(draft)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {translate(lang, (verifying ? "txVerifying" : "txVerify") as never)}
        </button>
      </div>

      {keyJustSaved ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {translate(lang, "txKeyReady" as never)}
        </p>
      ) : null}
      <div className="mt-3">
        <ErrorBanner kind={keyErrorKind} message={keyErrorMessage} />
      </div>
    </div>
  );
}
