import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { MusicSortOption } from "../../types";
import {
  ArrowUpDown,
  Check,
  Sparkles,
  Clock,
  Heart,
  ArrowDownAZ,
} from "lucide-react";

export interface SortItem {
  id: MusicSortOption;
  labelKey: "sortNewest" | "sortOldest" | "sortLiked" | "sortAlphabetical";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const SORT_OPTIONS: SortItem[] = [
  { id: "newest", labelKey: "sortNewest", icon: Sparkles },
  { id: "oldest", labelKey: "sortOldest", icon: Clock },
  { id: "liked", labelKey: "sortLiked", icon: Heart },
  { id: "title", labelKey: "sortAlphabetical", icon: ArrowDownAZ },
];

export interface TrackSortDropdownProps {
  sortBy: MusicSortOption;
  onSelectSort: (sort: MusicSortOption) => void;
}

export function TrackSortDropdown({
  sortBy,
  onSelectSort,
}: TrackSortDropdownProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    if (sortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sortOpen]);

  const currentOption = SORT_OPTIONS.find((s) => s.id === sortBy) || SORT_OPTIONS[0];

  return (
    <div className="relative" ref={sortRef}>
      <button
        type="button"
        onClick={() => setSortOpen(!sortOpen)}
        title={translate(lang, "sortByTitle")}
        aria-label={translate(lang, "sortByTitle")}
        className={`flex h-11 items-center gap-1.5 px-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-xs font-semibold shadow-sm active:scale-95 ${
          sortOpen
            ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
            : "border-black/[0.08] bg-white/80 text-zinc-700 hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
      >
        <ArrowUpDown className="h-4 w-4" strokeWidth={2.2} />
        <span className="hidden sm:inline">
          {translate(lang, currentOption.labelKey)}
        </span>
      </button>

      {sortOpen && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 top-12 z-50 min-w-[200px] rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {translate(lang, "sortByTitle")}
          </div>
          <div className="flex flex-col gap-0.5">
            {SORT_OPTIONS.map((item) => {
              const ItemIcon = item.icon;
              const isSelected = sortBy === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectSort(item.id);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-zinc-700 hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ItemIcon className="h-3.5 w-3.5" />
                    <span>{translate(lang, item.labelKey)}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
