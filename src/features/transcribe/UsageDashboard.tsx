import { openExternalUrl } from "../../utils/externalUrl";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { UsageStats } from "../../types";
import { Gauge, ExternalLink } from "lucide-react";

function formatMinutes(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "0";
  return m < 10 ? m.toFixed(1) : Math.round(m).toString();
}

function formatDate(unixSecs: number, lang: string): string {
  try {
    return new Date(unixSecs * 1000).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(unixSecs);
  }
}

export function UsageDashboard({ usage }: { usage: UsageStats | null }): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  if (!usage) return <></>;
  const quota = usage.lastObservedQuota;
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-zinc-400" />
        <h3 className="text-xs font-bold">{translate(lang, "txUsageTitle" as never)}</h3>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {translate(lang, "txUsageToday" as never, { minutes: formatMinutes(usage.sentMinutesToday) })}
      </p>
      {quota ? (
        <p className="mt-1.5 rounded-xl bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-700 dark:text-amber-300" dir="ltr">
          {quota.metric} {quota.value}
          <span className="mt-0.5 block font-sans text-[10px] opacity-80">
            {translate(lang, "txUsageObservedAt" as never, { date: formatDate(quota.discoveredAt, lang) })}
          </span>
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          {translate(lang, "txUsageNoQuota" as never)}
        </p>
      )}
      <button
        type="button"
        onClick={() => void openExternalUrl("https://aistudio.google.com/rate-limit")}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400"
      >
        <ExternalLink className="h-3 w-3" />
        {translate(lang, "txUsageOpenLimits" as never)}
      </button>
    </div>
  );
}
