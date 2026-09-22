import { ConvertSongIcon } from "./ConvertSongIcon";
import { translate, type Lang } from "../../i18n";
import type { PlaybackMode } from "../../stores/useMusicPlayerStore";
import {
  Repeat,
  Repeat1,
  Shuffle,
  Gauge,
  Flame,
  ListMusic,
} from "lucide-react";

export interface NowPlayingToolbarProps {
  playbackRate: number;
  volumeGainPercent: number;
  playbackMode: PlaybackMode;
  queueOpen: boolean;
  onOpenConverter: () => void;
  onToggleSpeed: () => void;
  onToggleBooster: () => void;
  onCyclePlaybackMode: () => void;
  onToggleQueue: () => void;
  lang: Lang;
}

export function NowPlayingToolbar({
  playbackRate,
  volumeGainPercent,
  playbackMode,
  queueOpen,
  onOpenConverter,
  onToggleSpeed,
  onToggleBooster,
  onCyclePlaybackMode,
  onToggleQueue,
  lang,
}: NowPlayingToolbarProps): React.JSX.Element {
  return (
    <div className="relative z-10 flex items-center justify-between gap-2 py-1.5 shrink-0">
      {/* Left: Converter integration button */}
      <button
        type="button"
        onClick={onOpenConverter}
        title={translate(lang, "openInConverter")}
        aria-label={translate(lang, "openInConverter")}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/25 transition-all cursor-pointer active:scale-90 shadow-sm"
      >
        <ConvertSongIcon className="h-5 w-5" />
      </button>

      {/* Right: Speed, Sound Booster, Repeat, Shuffle, Queue */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Playback Speed Controller */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleSpeed}
            title={translate(lang, "playbackSpeed")}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-90 ${
              playbackRate !== 1.0
                ? "text-orange-600 dark:text-orange-400 bg-orange-500/15 border border-orange-500/30"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            <Gauge className="h-4 w-4" />
          </button>
          {playbackRate !== 1.0 && (
            <span className="absolute -top-1.5 -end-1 px-1 py-0.2 min-w-4 text-center text-[9px] font-extrabold font-mono rounded-full bg-orange-500 text-white leading-tight shadow-sm pointer-events-none">
              {playbackRate}x
            </span>
          )}
        </div>

        {/* Real-time Sound Booster */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleBooster}
            title={translate(lang, "soundBooster")}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-90 ${
              volumeGainPercent > 100
                ? "text-amber-500 bg-amber-500/15 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            <Flame className="h-4 w-4 text-orange-500" />
          </button>
          {volumeGainPercent > 100 && (
            <span className="absolute -top-1.5 -end-1 px-1 py-0.2 min-w-4 text-center text-[9px] font-extrabold font-mono rounded-full bg-amber-500 text-white leading-tight shadow-sm pointer-events-none">
              {volumeGainPercent}%
            </span>
          )}
        </div>

        {/* Playback Mode Toggle */}
        <button
          type="button"
          onClick={onCyclePlaybackMode}
          title={translate(
            lang,
            playbackMode === "shuffle"
              ? "playbackModeShuffle"
              : playbackMode === "repeatAll"
              ? "playbackModeRepeatAll"
              : playbackMode === "repeatOne"
              ? "playbackModeRepeatOne"
              : "playbackModeNormal",
          )}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer active:scale-90 ${
            playbackMode !== "normal"
              ? "text-orange-600 dark:text-orange-400 bg-orange-500/15 border border-orange-500/30"
              : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          {playbackMode === "shuffle" ? (
            <Shuffle className="h-4 w-4" />
          ) : playbackMode === "repeatOne" ? (
            <Repeat1 className="h-4 w-4" />
          ) : (
            <Repeat className="h-4 w-4" />
          )}
        </button>

        {/* Mobile Queue Toggle */}
        <button
          type="button"
          onClick={onToggleQueue}
          title={translate(lang, "queueDrawer")}
          className={`lg:hidden flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer active:scale-90 ${
            queueOpen
              ? "text-orange-600 dark:text-orange-400 bg-orange-500/15 border border-orange-500/30"
              : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          <ListMusic className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
