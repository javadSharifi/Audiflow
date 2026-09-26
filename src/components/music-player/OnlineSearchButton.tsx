import { Globe } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";

export function OnlineSearchButton(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const isOnlineMode = useMusicPlayerStore((s) => s.isOnlineMode);
  const toggleOnlineMode = useMusicPlayerStore((s) => s.toggleOnlineMode);

  return (
    <button
      type="button"
      onClick={() => toggleOnlineMode()}
      title={translate(lang, "onlineSearchButton")}
      aria-label={translate(lang, "onlineSearchButton")}
      className={`flex h-11 px-3 shrink-0 items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer ${
        isOnlineMode
          ? "bg-orange-500 text-white border-orange-500 shadow-orange-500/20"
          : "border-black/[0.08] bg-white/80 text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      <Globe className={`h-4 w-4 ${isOnlineMode ? "text-white animate-pulse" : "text-zinc-500 dark:text-zinc-400"}`} />
      <span className="hidden sm:inline">{translate(lang, "onlineSearchButton")}</span>
    </button>
  );
}
