import React from "react";
import { TrackCover } from "./TrackCover";
import { Bell, X } from "lucide-react";
import { translate } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";
import type { AudioTrackInfo } from "../../types";

export interface RingtoneModalHeaderProps {
  track: AudioTrackInfo;
  onClose: () => void;
}

export function RingtoneModalHeader({
  track,
  onClose,
}: RingtoneModalHeaderProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  return (
    <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
      <div className="flex items-center gap-3 min-w-0">
        <TrackCover track={track} size="sm" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-orange-500" />
            <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
              {translate(lang, "setAsRingtoneTitle")}
            </h2>
          </div>
          <span className="text-[11px] text-zinc-400 truncate">
            {track.title || track.name} • {track.artist || "Unknown Artist"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/15 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
