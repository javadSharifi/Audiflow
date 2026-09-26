import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore, isTrackLiked, playbackModeOf, type PlaybackMode } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { WaveformSeekbar } from "./WaveformSeekbar";
import { TrackOptionsSheet } from "./TrackOptionsSheet";
import { ANDROID_BACK_EVENT, markBackConsumed, wasBackConsumed } from "../../utils/androidBack";
import { isAndroid } from "../../utils/platform";
import { TrackBoosterSheet } from "./TrackBoosterSheet";
import { useNowPlayingGestures } from "./useNowPlayingGestures";
import { NowPlayingArtworkCarousel } from "./NowPlayingArtworkCarousel";
import { NowPlayingToolbar } from "./NowPlayingToolbar";
import { NowPlayingSpeedModal } from "./NowPlayingSpeedModal";
import { NowPlayingMobileQueue } from "./NowPlayingMobileQueue";
import { NowPlayingDesktopQueue } from "./NowPlayingDesktopQueue";
import { NowPlayingTransportControls } from "./NowPlayingTransportControls";
import { TimedLyricsSheet } from "./TimedLyricsSheet";
import { ArrowLeft, MoreHorizontal, Heart } from "lucide-react";

export function NowPlayingView(): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const addPaths = useAppStore((s) => s.addPaths);
  const currentTrack = useMusicPlayerStore((s) => s.currentTrack);
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const currentTime = useMusicPlayerStore((s) => s.currentTime);
  const duration = useMusicPlayerStore((s) => s.duration);
  const currentPlaylist = useMusicPlayerStore((s) => s.currentPlaylist);
  const tracks = useMusicPlayerStore((s) => s.tracks);
  const repeatMode = useMusicPlayerStore((s) => s.repeatMode);
  const shuffleMode = useMusicPlayerStore((s) => s.shuffleMode);
  const playbackMode = playbackModeOf(repeatMode, shuffleMode);
  const playbackRate = useMusicPlayerStore((s) => s.playbackRate);
  const volumeGainPercent = useMusicPlayerStore((s) => s.volumeGainPercent);
  const fullscreenOpen = useMusicPlayerStore((s) => s.fullscreenOpen);
  const setFullscreenOpen = useMusicPlayerStore((s) => s.setFullscreenOpen);
  const playTrack = useMusicPlayerStore((s) => s.playTrack);
  const pauseTrack = useMusicPlayerStore((s) => s.pauseTrack);
  const resumeTrack = useMusicPlayerStore((s) => s.resumeTrack);
  const playNextTrack = useMusicPlayerStore((s) => s.playNextTrack);
  const playPreviousTrack = useMusicPlayerStore((s) => s.playPreviousTrack);
  const seekTo = useMusicPlayerStore((s) => s.seekTo);
  const setPlaybackMode = useMusicPlayerStore((s) => s.setPlaybackMode);
  const setPlaybackRate = useMusicPlayerStore((s) => s.setPlaybackRate);
  const likedPaths = useMusicPlayerStore((s) => s.likedPaths);
  const toggleLike = useMusicPlayerStore((s) => s.toggleLike);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [boosterOpen, setBoosterOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const {
    containerRef, cardRef, dragY, swipeX, cardRotation, cardOpacity,
    isInteracting, transitionState, bindContainer,
  } = useNowPlayingGestures({
    onDismiss: () => setFullscreenOpen(false),
    onNextTrack: () => void playNextTrack(),
    onPreviousTrack: () => void playPreviousTrack(),
    canGoNext: true, canGoPrevious: true,
  });

  const handleTogglePlay = () => (isPlaying ? pauseTrack() : resumeTrack());

  useEffect(() => {
    if (!isAndroid()) return;
    const onBack = () => {
      if (wasBackConsumed() || !fullscreenOpen) return;
      if (optionsOpen || queueOpen || speedOpen || boosterOpen || lyricsOpen) {
        setOptionsOpen(false); setQueueOpen(false); setSpeedOpen(false);
        setBoosterOpen(false); setLyricsOpen(false);
        markBackConsumed();
        return;
      }
      setFullscreenOpen(false);
      markBackConsumed();
    };
    window.addEventListener(ANDROID_BACK_EVENT, onBack as EventListener);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, onBack as EventListener);
  }, [fullscreenOpen, optionsOpen, queueOpen, speedOpen, boosterOpen, lyricsOpen, setFullscreenOpen]);

  const activeList = useMemo(() => (currentPlaylist.length > 0 ? currentPlaylist : tracks), [currentPlaylist, tracks]);

  if (!fullscreenOpen || !currentTrack) return null;
  const isLiked = isTrackLiked(currentTrack, likedPaths);

  const handleOpenInConverter = () => {
    const p = currentTrack.path || currentTrack.uri;
    if (p) void addPaths([p]);
    setFullscreenOpen(false);
    setActiveTool("converter");
  };

  const rootTransform = dragY > 0 ? `translateY(${dragY}px)` : undefined;
  const rootTransition =
    transitionState === "snapping"
      ? "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1)"
      : transitionState === "dismissing"
      ? "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)"
      : undefined;

  return createPortal(
    <div
      ref={containerRef}
      style={{ transform: rootTransform, transition: rootTransition, willChange: isInteracting ? "transform" : undefined }}
      {...bindContainer}
      className="fixed inset-0 z-[70] flex flex-col w-full h-[100dvh] min-h-0 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 px-4 sm:px-6 pt-[calc(1.75rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] select-none overflow-y-auto overflow-x-hidden justify-between animate-in slide-in-from-bottom duration-300"
    >
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-orange-500/15 via-amber-500/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-orange-500/10 via-amber-500/[0.04] to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row flex-1 w-full min-h-0 gap-6 overflow-visible max-w-5xl mx-auto">
        <div className="flex flex-col flex-1 min-h-0 min-w-0 justify-between overflow-visible max-w-xl mx-auto w-full">
          <div className="relative z-10 flex items-center justify-between h-12 mb-2 pb-1 shrink-0">
            <button
              type="button"
              onClick={() => setFullscreenOpen(false)}
              title={translate(lang, "collapsePlayer")}
              className="flex items-center justify-center h-9 w-9 rounded-2xl bg-black/[0.05] hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              title={translate(lang, "moreOptions")}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-black/[0.04] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/15 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer active:scale-90"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          <NowPlayingArtworkCarousel
            currentTrack={currentTrack}
            cardRef={cardRef}
            swipeX={swipeX}
            cardRotation={cardRotation}
            cardOpacity={cardOpacity}
            transitionState={transitionState}
          />

          <NowPlayingToolbar
            playbackRate={playbackRate}
            volumeGainPercent={volumeGainPercent}
            playbackMode={playbackMode}
            queueOpen={queueOpen}
            lyricsOpen={lyricsOpen}
            onOpenConverter={handleOpenInConverter}
            onToggleSpeed={() => { setSpeedOpen(!speedOpen); setBoosterOpen(false); setLyricsOpen(false); }}
            onToggleBooster={() => { setBoosterOpen(!boosterOpen); setSpeedOpen(false); setLyricsOpen(false); }}
            onToggleLyrics={() => { setLyricsOpen(!lyricsOpen); setSpeedOpen(false); setBoosterOpen(false); }}
            onCyclePlaybackMode={() => {
              const order: PlaybackMode[] = ["normal", "shuffle", "repeatAll", "repeatOne"];
              setPlaybackMode(order[(order.indexOf(playbackMode) + 1) % order.length]);
            }}
            onToggleQueue={() => { setQueueOpen(!queueOpen); setSpeedOpen(false); setBoosterOpen(false); setLyricsOpen(false); }}
            lang={lang}
          />

          <div className="relative z-10 flex items-center justify-between gap-4 pt-1 pb-1 shrink-0">
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                {currentTrack.title || currentTrack.name}
              </h1>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {currentTrack.artist || "Unknown Artist"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleLike(currentTrack)}
              title={translate(lang, isLiked ? "unlikeTrack" : "likeTrack")}
              className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer active:scale-90 ${
                isLiked
                  ? "text-rose-500 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-rose-500 bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/5"
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-rose-500 scale-110" : ""}`} strokeWidth={isLiked ? 0 : 2} />
            </button>
          </div>

          <div data-no-gesture className="relative z-10 py-1 shrink-0">
            <WaveformSeekbar
              currentTime={currentTime}
              duration={duration}
              onSeek={(newTime) => seekTo(newTime)}
              trackSeed={currentTrack.id || currentTrack.name}
            />
          </div>

          <NowPlayingTransportControls
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onNextTrack={() => void playNextTrack()}
            onPreviousTrack={() => void playPreviousTrack()}
            lang={lang}
          />
        </div>

        <NowPlayingDesktopQueue
          activeList={activeList}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayTrack={playTrack}
          lang={lang}
        />
      </div>

      <NowPlayingSpeedModal
        isOpen={speedOpen}
        onClose={() => setSpeedOpen(false)}
        playbackRate={playbackRate}
        onSelectRate={setPlaybackRate}
        lang={lang}
      />
      <TrackBoosterSheet isOpen={boosterOpen} onClose={() => setBoosterOpen(false)} />
      <NowPlayingMobileQueue
        isOpen={queueOpen}
        onClose={() => setQueueOpen(false)}
        activeList={activeList}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayTrack={playTrack}
        lang={lang}
      />
      <TimedLyricsSheet isOpen={lyricsOpen} onClose={() => setLyricsOpen(false)} />
      {optionsOpen && <TrackOptionsSheet track={currentTrack} onClose={() => setOptionsOpen(false)} />}
    </div>,
    document.body
  );
}