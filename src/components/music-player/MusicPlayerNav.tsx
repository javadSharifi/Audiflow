import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { Music2, Disc3, Heart, Flame } from "lucide-react";
import { ConvertSongIcon } from "./ConvertSongIcon";
import { NAVIGATION_DOCK_BOTTOM_CLASS } from "./navLayoutConstants";

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
      className={`fixed ${NAVIGATION_DOCK_BOTTOM_CLASS} left-1/2 -translate-x-1/2 z-[55] w-fit max-w-[calc(100vw-1.5rem)] sm:max-w-xl lg:max-w-2xl px-1 select-none`}
    >
      {/* Floating Glossy iOS Dock Container */}
      <div className="flex items-center w-fit gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-full overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] transition-all duration-300">
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
              className={`relative flex items-center justify-center min-h-[48px] h-12 sm:min-h-[52px] sm:h-[52px] rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-95 min-w-0 overflow-hidden ${
                isActive
                  ? "flex-none w-auto max-w-[140px] sm:max-w-[45%] gap-2 px-4 sm:px-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 font-bold"
                  : "flex-none w-12 sm:w-auto sm:flex-auto sm:min-w-[44px] h-12 sm:h-[52px] gap-0 px-0 sm:gap-1.5 sm:px-3 text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon
                className={`h-[22px] w-[22px] shrink-0 transition-transform duration-200 ${
                  isActive ? "scale-105" : ""
                }`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span
                className={
                  isActive
                    ? "inline text-xs tracking-tight whitespace-nowrap truncate min-w-0 font-bold"
                    : "hidden sm:inline text-xs tracking-tight whitespace-nowrap truncate min-w-0"
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
