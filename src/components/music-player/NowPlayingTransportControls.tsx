import { useState, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { translate, type Lang } from "../../i18n";

export interface NowPlayingTransportControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  lang: Lang;
}

export function NowPlayingTransportControls({
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPreviousTrack,
  lang,
}: NowPlayingTransportControlsProps): React.JSX.Element {
  const [ripples, setRipples] = useState<number[]>([]);
  const rippleId = useRef(0);

  const handlePlayPress = () => {
    rippleId.current += 1;
    const id = rippleId.current;
    setRipples((prev) => [...prev.slice(-2), id]);
    onTogglePlay();
  };

  const removeRipple = (id: number) => {
    setRipples((prev) => prev.filter((r) => r !== id));
  };

  return (
    <div
      dir="ltr"
      data-no-gesture
      data-testid="transport-controls"
      className="relative z-10 flex items-center justify-center gap-6 sm:gap-8 pt-3 pb-8 shrink-0 overflow-visible"
    >
      <button
        type="button"
        onClick={onPreviousTrack}
        title={translate(lang, "previousSong")}
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer active:scale-90"
      >
        <SkipBack className="h-6 w-6 stroke-[2]" />
      </button>

      <div className="relative flex items-center justify-center overflow-visible p-2">
        {isPlaying && (
          <div className="absolute inset-0 rounded-full bg-orange-500/25 blur-xl animate-[breathe_2.6s_ease-in-out_infinite] pointer-events-none" />
        )}
        {ripples.map((id) => (
          <span
            key={id}
            onAnimationEnd={() => removeRipple(id)}
            className="absolute inset-2 rounded-full border-2 border-orange-400/70 animate-[play-ripple_0.6s_ease-out_forwards] pointer-events-none"
          />
        ))}

        <button
          type="button"
          onClick={handlePlayPress}
          title={translate(lang, isPlaying ? "pauseSong" : "playSong")}
          className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-400 text-white shadow-lg transition-transform duration-200 cursor-pointer active:scale-90 hover:scale-105 ${
            isPlaying
              ? "shadow-orange-500/30 animate-[breathe_2.6s_ease-in-out_infinite]"
              : "shadow-orange-500/15"
          }`}
        >
          <span key={isPlaying ? "pause" : "play"} className="flex animate-[icon-pop_0.25s_ease-out]">
            {isPlaying ? (
              <Pause className="h-7 w-7 fill-white" />
            ) : (
              <Play className="h-7 w-7 fill-white translate-x-0.5" />
            )}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onNextTrack}
        title={translate(lang, "nextSong")}
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer active:scale-90"
      >
        <SkipForward className="h-6 w-6 stroke-[2]" />
      </button>
    </div>
  );
}
