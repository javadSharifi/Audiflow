import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { Music2, Disc3, Heart, Flame } from "lucide-react";
import { ConvertSongIcon } from "./ConvertSongIcon";

export type PlayerTab = "songs" | "album" | "like" | "boost";

export interface TabItem {
  id: PlayerTab | "converter";
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const PLAYER_TABS: TabItem[] = [
  { id: "album", labelKey: "playerNavAlbums", icon: Disc3 },
  { id: "like", labelKey: "playerNavLiked", icon: Heart },
  { id: "songs", labelKey: "playerNavSongs", icon: Music2 },
  { id: "boost", labelKey: "playerNavBoost", icon: Flame },
  { id: "converter", labelKey: "toolConverter", icon: ConvertSongIcon },
];

interface MusicPlayerNavProps {
  activeTab: PlayerTab;
  onSelectTab: (tab: PlayerTab) => void;
}

export function MusicPlayerNav({ activeTab, onSelectTab }: MusicPlayerNavProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  return (
    <nav
      aria-label="Music Player Navigation"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] w-fit max-w-[calc(100vw-1.5rem)] sm:max-w-xl lg:max-w-2xl px-1 select-none"
    >
      {/* Floating Glossy iOS Dock Container */}
      <div className="flex items-center w-fit gap-1 p-1.5 rounded-full overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] transition-all duration-300">
        {PLAYER_TABS.map((tab) => {
          const isActive =
            tab.id === "converter" ? activeTool === "converter" : activeTool === "player" && activeTab === tab.id;
          const Icon = tab.icon;
          const label = translate(lang, tab.labelKey);

          const handleClick = () => {
            if (tab.id === "converter") {
              setActiveTool("converter");
              return;
            }
            setActiveTool("player");
            onSelectTab(tab.id);
          };

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={handleClick}
              title={label}
              className={`relative flex items-center justify-center h-10 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-95 min-w-0 overflow-hidden ${
                isActive
                  ? "flex-none w-auto max-w-[45%] gap-2 px-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 font-bold"
                  : "flex-none w-10 gap-0 px-0 sm:flex-auto sm:w-auto sm:gap-1.5 sm:px-2.5 text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                  isActive ? "scale-110" : ""
                }`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span
                className={
                  isActive
                    ? "text-[11px] sm:text-xs tracking-tight whitespace-nowrap truncate min-w-0"
                    : "hidden sm:inline text-[11px] sm:text-xs tracking-tight whitespace-nowrap truncate min-w-0"
                }
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
