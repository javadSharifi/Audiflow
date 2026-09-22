import React from "react";
import type { AudioTrackInfo } from "../../types";
import { TrackCover } from "./TrackCover";
import { trackIdentity } from "../../utils/artwork";
import type { TransitionState } from "./useNowPlayingGestures";

export interface NowPlayingArtworkCarouselProps {
  currentTrack: (Partial<AudioTrackInfo> & {
    id?: string | null;
    uri?: string | null;
    path?: string | null;
    title?: string | null;
    name?: string;
    artist?: string | null;
    coverUrl?: string | null;
  }) | null;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  swipeX?: number;
  cardRotation?: number;
  cardOpacity?: number;
  transitionState?: TransitionState;
  className?: string;
}

export function NowPlayingArtworkCarousel({
  currentTrack,
  cardRef,
  swipeX = 0,
  cardRotation = 0,
  cardOpacity = 1,
  transitionState = "idle",
  className = "",
}: NowPlayingArtworkCarouselProps): React.JSX.Element {
  const isTransitioning =
    transitionState === "sliding-next" ||
    transitionState === "sliding-prev" ||
    transitionState === "snapping";

  const transformStyle: React.CSSProperties = {
    transform: `translateX(${swipeX}px) rotate(${cardRotation}deg)`,
    opacity: cardOpacity,
    transition: isTransitioning
      ? "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 220ms ease-out"
      : undefined,
    willChange: "transform, opacity",
    touchAction: "pan-y",
  };

  return (
    <div className={`relative z-10 flex-1 min-h-0 my-2 flex items-center justify-center select-none ${className}`}>
      <div
        ref={cardRef}
        data-testid="now-playing-artwork-carousel"
        style={transformStyle}
        className="relative aspect-square max-h-full max-w-[280px] sm:max-w-[320px] w-full rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-zinc-800 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        {currentTrack ? (
          <TrackCover
            key={trackIdentity(currentTrack)}
            track={currentTrack}
            size="full"
            className="rounded-3xl pointer-events-none"
          />
        ) : null}
      </div>
    </div>
  );
}
