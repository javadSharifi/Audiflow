import { Globe, ArrowDownToLine } from "lucide-react";
import { useDownloaderStore } from "../../stores/useDownloaderStore";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { isAndroid, isMobile } from "../../utils/platform";

export function InternetSearchButton(): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const setIsOpen = useDownloaderStore((s) => s.setIsOpen);
  const downloads = useDownloaderStore((s) => s.downloads);

  if (isAndroid() || isMobile()) {
    return null;
  }

  const activeDownloadsCount = Object.values(downloads).filter(
    (d) => d.status === "downloading" || d.status === "preparing" || d.status === "queued" || d.status === "processing",
  ).length;

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      title={translate(lang, "internetSearchTitle")}
      aria-label={translate(lang, "internetSearchTitle")}
      className="relative hidden sm:flex h-11 shrink-0 items-center gap-2 px-3.5 rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-400 dark:hover:bg-orange-500/20 text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
    >
      <Globe className="h-4 w-4 shrink-0 text-orange-500" />
      <span className="hidden sm:inline">{translate(lang, "internetSearch")}</span>

      {activeDownloadsCount > 0 && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold animate-pulse">
          <ArrowDownToLine className="h-2.5 w-2.5" />
          <span>{activeDownloadsCount}</span>
        </span>
      )}
    </button>
  );
}
