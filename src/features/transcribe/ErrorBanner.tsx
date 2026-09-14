import { useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { GeminiErrorKind } from "../../types";

const KIND_TO_KEY: Record<string, string> = {
  RegionNotSupported: "transcribeErrorRegion",
  AccountFlagged: "transcribeErrorFlagged",
  InvalidKey: "transcribeErrorInvalidKey",
  MissingKey: "transcribeErrorMissingKey",
  QuotaExceeded: "transcribeErrorQuota",
  ServerError: "transcribeErrorServer",
  Unknown: "transcribeErrorUnknown",
};

export function ErrorBanner({
  kind,
  message,
  technical,
}: {
  kind: GeminiErrorKind | null;
  message: string | null;
  technical?: string | null;
}): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const [showTech, setShowTech] = useState(false);
  if (!kind && !message) return null;
  const key = (kind && KIND_TO_KEY[kind.kind]) || "transcribeErrorUnknown";
  const detail = kind && kind.kind === "QuotaExceeded" ? kind.detail : null;

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-xs dark:bg-red-500/10">
      <p className="font-semibold text-red-600 dark:text-red-400">
        {translate(lang, key as never)}
      </p>
      {detail && (detail.metric || detail.value) ? (
        <p className="mt-1 font-mono text-[11px] text-red-500/90 dark:text-red-400/90" dir="ltr">
          {detail.metric} {detail.value}
        </p>
      ) : null}
      {kind && kind.kind === "RegionNotSupported" ? (
        <p className="mt-1 leading-relaxed text-red-500/90 dark:text-red-400/90">
          {translate(lang, "transcribeErrorRegionVpn" as never)}
        </p>
      ) : null}
      {message ? (
        <p className="mt-1 text-zinc-500 dark:text-zinc-400" dir="auto">
          {message}
        </p>
      ) : null}
      {technical ? (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowTech((v) => !v)}
            className="font-medium text-zinc-500 underline underline-offset-2 dark:text-zinc-400"
          >
            {translate(lang, "txTechnical" as never)}
          </button>
          {showTech ? (
            <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-black/5 p-2 font-mono text-[10px] whitespace-pre-wrap dark:bg-white/5" dir="ltr">
              {technical}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
