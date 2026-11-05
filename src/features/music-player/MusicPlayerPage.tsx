import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  Music,
  Plus,
  Trash2,
  ListMusic,
  Clock,
  Sparkles,
  Disc3,
  Moon,
  ChevronsRight,
  MicVocal,
  Library,
  SlidersHorizontal,
} from "lucide-react";
import { useMusicPlayerStore, canCrossfade, type Track } from "./useMusicPlayerStore";
import {
  EQ_FREQS,
  EQ_PRESETS,
  EQ_RANGE_DB,
  crossfadeLevels,
  resumeGraph,
  setElementGain,
  setEq,
  type EqPreset,
} from "./audioGraph";
import { LibraryPanel } from "./LibraryPanel";
import { activeLineIndex, fetchOnlineLyrics, parseLrc, type LyricLine } from "./lyrics";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { formatDuration, formatBytes } from "../../utils/format";
import { pickVideos } from "../../utils/dialog";
import { isAndroid } from "../../utils/platform";
import {
  setBackgroundPlayback,
  statMediaPaths,
  trackCover,
  trackInfo,
  trackLyrics,
  trackSilences,
} from "../../utils/tauri";
import type { CoverArt, TrackInfo } from "../../types/generated";
import { convertFileSrc } from "@tauri-apps/api/core";

export function MusicPlayerPage(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const isFa = lang === "fa";

  const {
    playlist,
    currentTrackIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    playbackRate,
    addTracks,
    removeTrack,
    clearPlaylist,
    playTrack,
    togglePlay,
    setIsPlaying,
    nextTrack,
    prevTrack,
    setCurrentTime,
    setDuration,
    setVolume,
    toggleMute,
    toggleRepeatMode,
    toggleShuffle,
    setPlaybackRate,
    skipSilence,
    toggleSkipSilence,
    sleepEndsAt,
    sleepAfterTrack,
    setSleepTimer,
    setSleepAfterTrack,
    trackEnded,
    crossfadeSecs,
    setCrossfadeSecs,
    eqEnabled,
    eqGains,
    setEqEnabled,
    setEqGain,
    setEqPreset,
  } = useMusicPlayerStore();

  // Two elements so the next track can start while the current one fades out.
  // audioRef always points at the ACTIVE element (the one the UI controls).
  const elsRef = useRef<(HTMLAudioElement | null)[]>([null, null]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<{ from: HTMLAudioElement; timer: ReturnType<typeof setInterval> } | null>(
    null,
  );
  const [isSoundPanelOpen, setIsSoundPanelOpen] = useState(false);
  const [listTab, setListTab] = useState<"playlist" | "library">("playlist");
  // Bumped on user seeks so the Android notification's position is re-sent.
  const [seekNonce, setSeekNonce] = useState(0);
  const [cover, setCover] = useState<CoverArt | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [lyricsState, setLyricsState] = useState<"idle" | "loading" | "none">("idle");
  const lyricsCache = useRef(new Map<string, LyricLine[] | null>());
  const lyricsBoxRef = useRef<HTMLDivElement | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [info, setInfo] = useState<TrackInfo | null>(null);
  const [silences, setSilences] = useState<[number, number][]>([]);
  const silenceCache = useRef(new Map<string, [number, number][]>());
  const [, setTick] = useState(0);

  const currentTrack: Track | undefined = playlist[currentTrackIndex];
  const trackPath = currentTrack?.path;

  // Tags + stats for the current track
  useEffect(() => {
    setInfo(null);
    if (!trackPath) return;
    let alive = true;
    trackInfo(trackPath)
      .then((i) => alive && setInfo(i))
      .catch((err) => console.warn("track info failed", err));
    return () => {
      alive = false;
    };
  }, [trackPath]);

  // Silent spans, only fetched while "skip silence" is on (full decode)
  useEffect(() => {
    setSilences([]);
    if (!trackPath || !skipSilence) return;
    const cached = silenceCache.current.get(trackPath);
    if (cached) {
      setSilences(cached);
      return;
    }
    let alive = true;
    trackSilences(trackPath)
      .then((r) => {
        silenceCache.current.set(trackPath, r);
        if (alive) setSilences(r);
      })
      .catch((err) => console.warn("silence scan failed", err));
    return () => {
      alive = false;
    };
  }, [trackPath, skipSilence]);

  // Cover art + its average color (drives the glow tint)
  useEffect(() => {
    setCover(null);
    if (!trackPath) return;
    let alive = true;
    trackCover(trackPath)
      .then((c) => alive && setCover(c))
      .catch((err) => console.warn("cover extraction failed", err));
    return () => {
      alive = false;
    };
  }, [trackPath]);

  // Lyrics: local (.lrc / embedded) first, LRCLIB only when the panel is opened
  useEffect(() => {
    setLyrics(null);
    if (!lyricsOpen || !trackPath) return;
    if (lyricsCache.current.has(trackPath)) {
      const c = lyricsCache.current.get(trackPath) ?? null;
      setLyrics(c);
      setLyricsState(c ? "idle" : "none");
      return;
    }
    let alive = true;
    setLyricsState("loading");
    (async () => {
      let raw = await trackLyrics(trackPath).catch(() => null);
      const title = info?.title || currentTrack?.title;
      if (!raw && info?.artist && title) {
        raw = await fetchOnlineLyrics(info.artist, title, currentTrack?.durationSecs ?? 0).catch(
          () => null,
        );
      }
      const lines = raw ? parseLrc(raw) : null;
      const result = lines && lines.length > 0 ? lines : null;
      // Don't cache a miss before tags arrive — the online lookup needs the artist.
      if (result || info) lyricsCache.current.set(trackPath, result);
      if (!alive) return;
      setLyrics(result);
      setLyricsState(result ? "idle" : "none");
    })();
    return () => {
      alive = false;
    };
  }, [lyricsOpen, trackPath, info, currentTrack?.title, currentTrack?.durationSecs]);

  const activeLyric = lyrics ? activeLineIndex(lyrics, currentTime) : -1;
  useEffect(() => {
    const box = lyricsBoxRef.current;
    const line = box?.children[activeLyric] as HTMLElement | undefined;
    if (box && line) {
      box.scrollTo({ top: line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2, behavior: "smooth" });
    }
  }, [activeLyric]);

  // Re-render the sleep countdown every 30s
  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [sleepEndsAt]);

  const displayTitle = info?.title || currentTrack?.title;
  const displayArtist = [info?.artist, info?.album].filter(Boolean).join(" — ");

  // OS media controls (media keys, lock screen, notification)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayTitle || currentTrack.name,
      artist: info?.artist ?? "",
      album: info?.album ?? "",
      artwork: cover ? [{ src: convertFileSrc(cover.path), type: "image/jpeg" }] : [],
    });
  }, [currentTrack, displayTitle, info, cover]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const st = useMusicPlayerStore.getState;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => st().setIsPlaying(true)],
      ["pause", () => st().setIsPlaying(false)],
      ["previoustrack", () => st().prevTrack()],
      ["nexttrack", () => st().nextTrack()],
      [
        "seekto",
        (d) => {
          if (audioRef.current && d.seekTime != null) {
            finishFade();
            audioRef.current.currentTime = d.seekTime;
          }
        },
      ],
    ];
    for (const [a, h] of handlers) {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* action unsupported on this platform */
      }
    }
    return () => {
      for (const [a] of handlers) {
        try {
          ms.setActionHandler(a, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  // Android: foreground service + notification so playback survives backgrounding.
  // Position is sent only on state changes; the MediaSession extrapolates it.
  useEffect(() => {
    if (!isAndroid()) return;
    if (!currentTrack) {
      setBackgroundPlayback(null);
      return;
    }
    setBackgroundPlayback({
      title: displayTitle || currentTrack.name,
      artist: info?.artist ?? "",
      album: info?.album ?? "",
      playing: isPlaying,
      positionSecs: audioRef.current?.currentTime ?? 0,
      durationSecs: duration || currentTrack.durationSecs || 0,
      rate: playbackRate,
    });
  }, [currentTrack, displayTitle, info, isPlaying, duration, playbackRate, seekNonce]);

  useEffect(() => {
    if (!isAndroid()) return;
    const onAction = (e: Event) => {
      const { action, value } = (e as CustomEvent<{ action: string; value: number }>).detail;
      const st = useMusicPlayerStore.getState();
      if (action === "play") st.setIsPlaying(true);
      else if (action === "pause") st.setIsPlaying(false);
      else if (action === "next") st.nextTrack();
      else if (action === "prev") st.prevTrack();
      else if (action === "seek" && audioRef.current) {
        finishFade();
        audioRef.current.currentTime = value;
      }
    };
    window.addEventListener("ac:media-action", onAction);
    return () => {
      window.removeEventListener("ac:media-action", onAction);
      setBackgroundPlayback(null);
    };
  }, []);

  // Helper to import files into player
  const handleImportFiles = useCallback(async () => {
    try {
      const paths = await pickVideos();
      if (!paths || paths.length === 0) return;

      const stats = await statMediaPaths(paths);
      const newTracks: Track[] = stats.map((s, idx) => ({
        id: `${s.input}-${Date.now()}-${idx}`,
        path: s.input,
        name: s.name,
        title: s.name.replace(/\.[^.]+$/, ""),
        durationSecs: s.durationSecs || 0,
        sizeBytes: s.sizeBytes || 0,
        format: s.input.split(".").pop()?.toUpperCase() || "AUDIO",
        assetUrl: convertFileSrc(s.input),
      }));

      addTracks(newTracks);
    } catch (err) {
      console.error("Failed to add tracks to player", err);
    }
  }, [addTracks]);

  // Sync Audio source when current track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.src = "";
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const src = currentTrack.assetUrl || convertFileSrc(currentTrack.path);
    if (audio.src !== src) {
      audio.src = src;
      audio.load();
      if (isPlaying) {
        audio.play().catch((err) => {
          console.warn("Autoplay was prevented:", err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrack, setCurrentTime, setDuration, isPlaying, setIsPlaying]);

  // Sync Play / Pause state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      resumeGraph();
      if (audio.paused) {
        audio.play().catch((err) => {
          console.warn("Play interrupted:", err);
          setIsPlaying(false);
        });
      }
    } else {
      finishFade();
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, currentTrack, setIsPlaying]);

  // Sync volume and mute (the crossfade timer owns levels while it runs)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || fadeRef.current) return;
    setElementGain(audio, isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // Sync playback rate
  useEffect(() => {
    for (const el of elsRef.current) if (el) el.playbackRate = playbackRate;
  }, [playbackRate]);

  // EQ (builds the Web Audio graph on first non-flat use)
  useEffect(() => {
    const els = elsRef.current.filter((e): e is HTMLAudioElement => !!e);
    try {
      setEq(els, eqEnabled, eqGains);
    } catch (err) {
      console.error("EQ unavailable", err);
    }
  }, [eqEnabled, eqGains]);

  // Stop any running crossfade at once: silence + release the outgoing element.
  function finishFade() {
    const f = fadeRef.current;
    if (!f) return;
    clearInterval(f.timer);
    f.from.pause();
    f.from.removeAttribute("src");
    f.from.load();
    fadeRef.current = null;
    const st = useMusicPlayerStore.getState();
    if (audioRef.current) setElementGain(audioRef.current, st.isMuted ? 0 : st.volume);
  }

  function startCrossfade(from: HTMLAudioElement, secs: number) {
    const to = elsRef.current.find((e) => e && e !== from);
    if (!to) return;
    finishFade();
    setElementGain(to, 0);
    to.playbackRate = from.playbackRate;
    audioRef.current = to;
    const started = performance.now();
    // setInterval, not rAF: rAF stops in a hidden window and would freeze the fade.
    const timer = setInterval(() => {
      const st = useMusicPlayerStore.getState();
      const level = st.isMuted ? 0 : st.volume;
      const p = (performance.now() - started) / (secs * 1000);
      const l = crossfadeLevels(p);
      setElementGain(from, level * l.out);
      setElementGain(to, level * l.in);
      if (p >= 1) finishFade();
    }, 50);
    fadeRef.current = { from, timer };
    useMusicPlayerStore.getState().nextTrack(); // src-sync effect loads + plays `to`
  }

  useEffect(() => () => finishFade(), []);

  // Progress Seek handling
  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(Number(e.target.value));
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
    finishFade();
    setSeekNonce((n) => n + 1);
    if (audioRef.current) {
      audioRef.current.currentTime = seekValue;
      setCurrentTime(seekValue);
    }
  };

  const effectiveDuration = duration > 0 ? duration : currentTrack?.durationSecs || 0;
  const currentDisplayTime = isSeeking ? seekValue : currentTime;
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentDisplayTime / effectiveDuration) * 100))
      : 0;

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="flex flex-col gap-5">
      {/* Hidden audio elements (two, for crossfade). Events from the
          outgoing element are ignored: only the active one drives the UI. */}
      {[0, 1].map((i) => (
        <audio
          key={i}
          crossOrigin="anonymous"
          ref={(el) => {
            elsRef.current[i] = el;
            if (i === 0 && !audioRef.current) audioRef.current = el;
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            if (isSeeking || audio !== audioRef.current) return;
            const t = audio.currentTime;
            // Jump to the end of the silent span we're in (0.3s margin avoids re-trigger loops)
            const span = skipSilence
              ? silences.find(([s, end]) => t >= s && t < end - 0.3)
              : undefined;
            if (span) audio.currentTime = span[1];
            setCurrentTime(audio.currentTime);

            const st = useMusicPlayerStore.getState();
            const remaining = audio.duration - audio.currentTime;
            if (
              !fadeRef.current &&
              canCrossfade(st) &&
              Number.isFinite(audio.duration) &&
              audio.duration > st.crossfadeSecs * 2 &&
              remaining <= st.crossfadeSecs
            ) {
              startCrossfade(audio, Math.max(0.5, remaining));
            }
          }}
          onLoadedMetadata={(e) => {
            if (e.currentTarget !== audioRef.current) return;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
            }
          }}
          onEnded={(e) => {
            const audio = e.currentTarget;
            if (audio !== audioRef.current) return;
            const before = useMusicPlayerStore.getState().currentTrackIndex;
            trackEnded();
            const st = useMusicPlayerStore.getState();
            // Same track again (repeat-one / one-song playlist): src doesn't change, so restart by hand
            if (st.isPlaying && st.currentTrackIndex === before) {
              audio.currentTime = 0;
              void audio.play().catch(() => setIsPlaying(false));
            }
          }}
          onError={(e) => {
            if (e.currentTarget !== audioRef.current) return;
            console.error("Audio playback error:", e);
            setIsPlaying(false);
          }}
        />
      ))}

      {/* Main Player Card */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8 shadow-xl">
        {/* Subtle decorative background gradient glows */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-violet-600/20 to-purple-600/0 blur-3xl transition-colors duration-700"
          style={cover ? { backgroundImage: "none", backgroundColor: `rgb(${cover.rgb.join(",")} / 0.25)` } : undefined}
        />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-orange-500/15 to-amber-500/0 blur-3xl" />

        {currentTrack ? (
          <div className="relative z-1 flex flex-col items-center gap-6">
            {/* Vinyl Disc & Animated Visualizer Container */}
            <div className="relative flex items-center justify-center py-2">
              {/* Outer Glowing Ring */}
              <div
                className={`absolute h-48 w-48 rounded-full transition-all duration-700 blur-xl ${
                  isPlaying
                    ? "bg-gradient-to-tr from-violet-600/40 via-purple-500/30 to-orange-500/30 scale-110"
                    : "bg-black/5 dark:bg-white/5 scale-95"
                }`}
                style={
                  cover && isPlaying
                    ? { backgroundImage: "none", backgroundColor: `rgb(${cover.rgb.join(",")} / 0.5)` }
                    : undefined
                }
              />

              {/* Vinyl Record Disc */}
              <div
                className={`relative flex h-44 w-44 md:h-52 md:w-52 items-center justify-center rounded-full bg-zinc-900 border-4 border-zinc-800 shadow-2xl transition-transform duration-500 ${
                  isPlaying ? "animate-spin-slow" : "animate-spin-slow-paused scale-98"
                }`}
                style={{
                  backgroundImage: `radial-gradient(circle, #27272a 18%, #18181b 19%, #18181b 40%, #27272a 41%, #18181b 60%, #27272a 61%, #09090b 100%)`,
                }}
              >
                {/* Center Label on Vinyl Disc */}
                {cover ? (
                  <img
                    src={convertFileSrc(cover.path)}
                    alt=""
                    className="h-24 w-24 md:h-28 md:w-28 rounded-full object-cover border-2 border-zinc-700 shadow-inner"
                  />
                ) : (
                  <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 via-purple-600 to-orange-500 p-1 shadow-inner border-2 border-zinc-700">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-950/80 text-white">
                      <Disc3 className="h-7 w-7 text-violet-400" />
                    </div>
                  </div>
                )}

                {/* Vinyl Center Spindle Hole */}
                <div className="absolute h-3 w-3 rounded-full bg-zinc-900 border border-zinc-700 shadow-inner" />
              </div>

              {/* Live Equalizer Waveform Overlay */}
              {isPlaying && (
                <div className="absolute bottom-1 flex items-end gap-1 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                  <div className="w-1 rounded-full bg-violet-400 animate-eq-1" />
                  <div className="w-1 rounded-full bg-purple-400 animate-eq-2" />
                  <div className="w-1 rounded-full bg-orange-400 animate-eq-3" />
                  <div className="w-1 rounded-full bg-amber-400 animate-eq-4" />
                </div>
              )}
            </div>

            {/* Track Info (Title & Format) */}
            <div className="text-center max-w-lg space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 border border-violet-500/20">
                <Sparkles className="h-3 w-3" />
                <span>{info?.codec?.toUpperCase() || currentTrack.format}</span>
                {info?.sampleRate && (
                  <>
                    <span>•</span>
                    <span>{(info.sampleRate / 1000).toFixed(1)} kHz</span>
                  </>
                )}
                {info?.bitDepth && (
                  <>
                    <span>•</span>
                    <span>{info.bitDepth}-bit</span>
                  </>
                )}
                {info?.bitrateKbps && (
                  <>
                    <span>•</span>
                    <span>{info.bitrateKbps} kbps</span>
                  </>
                )}
                {info?.channels && (
                  <>
                    <span>•</span>
                    <span>{info.channels === 1 ? "Mono" : info.channels === 2 ? "Stereo" : `${info.channels}ch`}</span>
                  </>
                )}
                {currentTrack.sizeBytes > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatBytes(currentTrack.sizeBytes)}</span>
                  </>
                )}
              </span>
              <h2
                className="text-lg md:text-xl font-black text-zinc-900 dark:text-zinc-100 truncate px-4"
                title={displayTitle}
              >
                {displayTitle || translate(lang, "unknownTitle")}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate px-4">
                {displayArtist || translate(lang, "nowPlaying")}
              </p>
            </div>

            {/* Progress Bar & Timestamps */}
            <div className="w-full max-w-lg space-y-1.5">
              <div className="relative flex items-center group">
                {/* Custom Track Slider */}
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration || 100}
                  step={0.1}
                  value={currentDisplayTime}
                  onMouseDown={handleSeekStart}
                  onTouchStart={handleSeekStart}
                  onChange={handleSeekChange}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  className="w-full h-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 appearance-none cursor-pointer accent-violet-600 focus:outline-none transition-all"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #a855f7 ${progressPercent}%, rgba(120, 120, 130, 0.2) ${progressPercent}%, rgba(120, 120, 130, 0.2) 100%)`,
                  }}
                />
              </div>

              {/* Time displays */}
              <div className="flex items-center justify-between text-[11px] font-mono font-medium text-zinc-500 dark:text-zinc-400">
                <span>{formatDuration(currentDisplayTime)}</span>
                <span>{formatDuration(effectiveDuration)}</span>
              </div>
            </div>

            {/* Main Playback Controls */}
            <div className="flex items-center justify-center gap-3 md:gap-5">
              {/* Shuffle Button */}
              <button
                type="button"
                onClick={toggleShuffle}
                className={`relative p-2.5 rounded-full transition-all active:scale-95 ${
                  isShuffle
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
                title={translate(lang, isShuffle ? "shuffleOn" : "shuffleOff")}
              >
                <Shuffle className="h-4 w-4" strokeWidth={2.3} />
                {isShuffle && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-violet-600" />
                )}
              </button>

              {/* Previous Track */}
              <button
                type="button"
                onClick={prevTrack}
                className="p-3 rounded-2xl border border-black/5 bg-black/[0.03] dark:border-white/5 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:scale-95 transition-all shadow-sm"
                title={translate(lang, "statusWaiting")}
              >
                <SkipBack className="h-5 w-5" strokeWidth={2.3} />
              </button>

              {/* Play / Pause Hero Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-600/30 transition-all duration-300 hover:brightness-110 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7 fill-current" strokeWidth={0} />
                ) : (
                  <Play
                    className={`h-7 w-7 fill-current ${isFa ? "-scale-x-100 mr-0.5" : "ml-0.5"}`}
                    strokeWidth={0}
                  />
                )}
              </button>

              {/* Next Track */}
              <button
                type="button"
                onClick={nextTrack}
                className="p-3 rounded-2xl border border-black/5 bg-black/[0.03] dark:border-white/5 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:scale-95 transition-all shadow-sm"
                title={translate(lang, "statusWaiting")}
              >
                <SkipForward className="h-5 w-5" strokeWidth={2.3} />
              </button>

              {/* Repeat Button */}
              <button
                type="button"
                onClick={toggleRepeatMode}
                className={`relative p-2.5 rounded-full transition-all active:scale-95 ${
                  repeatMode !== "off"
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
                title={
                  repeatMode === "all"
                    ? translate(lang, "repeatAll")
                    : repeatMode === "one"
                      ? translate(lang, "repeatOne")
                      : translate(lang, "repeatOff")
                }
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="h-4 w-4" strokeWidth={2.3} />
                ) : (
                  <Repeat className="h-4 w-4" strokeWidth={2.3} />
                )}
                {repeatMode !== "off" && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-violet-600" />
                )}
              </button>
            </div>

            {/* Bottom Controls Bar: Speed & Volume */}
            <div className="flex w-full max-w-lg items-center justify-between gap-4 border-t border-black/[0.06] dark:border-white/[0.06] pt-4 text-xs">
              {/* Playback Speed Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSpeedMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-black/[0.03] px-3 py-1.5 font-mono font-bold text-zinc-700 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08] transition-all"
                  title={translate(lang, "playbackSpeed")}
                >
                  <Clock className="h-3.5 w-3.5 text-violet-500" />
                  <span>{playbackRate}x</span>
                </button>

                {isSpeedMenuOpen && (
                  <div className="absolute bottom-full mb-2 start-0 z-30 flex gap-1 rounded-2xl glass-panel p-1.5 shadow-xl animate-in fade-in">
                    {speeds.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(s);
                          setIsSpeedMenuOpen(false);
                        }}
                        className={`rounded-xl px-2.5 py-1 font-mono text-[11px] font-bold transition-all ${
                          playbackRate === s
                            ? "bg-violet-600 text-white shadow-sm"
                            : "text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sleep Timer + Skip Silence */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSleepMenuOpen((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition-all ${
                      sleepEndsAt || sleepAfterTrack
                        ? "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                        : "border-black/5 bg-black/[0.03] text-zinc-700 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]"
                    }`}
                    title={translate(lang, "sleepTimer")}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    {sleepEndsAt ? (
                      <span>
                        {translate(lang, "sleepRemaining", {
                          n: Math.max(1, Math.ceil((sleepEndsAt - Date.now()) / 60_000)),
                        })}
                      </span>
                    ) : sleepAfterTrack ? (
                      <span>{translate(lang, "sleepEndOfTrack")}</span>
                    ) : null}
                  </button>

                  {isSleepMenuOpen && (
                    <div className="absolute bottom-full mb-2 start-0 z-30 flex flex-col gap-1 rounded-2xl glass-panel p-1.5 shadow-xl animate-in fade-in min-w-28">
                      {(
                        [
                          ["sleepOff", () => (setSleepTimer(null), setSleepAfterTrack(false))],
                          ...[15, 30, 45, 60].map(
                            (n) => [String(n), () => setSleepTimer(n)] as const,
                          ),
                          ["sleepEndOfTrack", () => setSleepAfterTrack(true)],
                        ] as const
                      ).map(([key, run]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            run();
                            setIsSleepMenuOpen(false);
                          }}
                          className="rounded-xl px-2.5 py-1 text-start text-[11px] font-bold text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 transition-all"
                        >
                          {key === "sleepOff" || key === "sleepEndOfTrack"
                            ? translate(lang, key)
                            : translate(lang, "sleepMinutes", { n: key })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleSkipSilence}
                  aria-pressed={skipSilence}
                  className={`rounded-xl border p-1.5 transition-all ${
                    skipSilence
                      ? "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                      : "border-black/5 bg-black/[0.03] text-zinc-500 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08]"
                  }`}
                  title={translate(lang, "skipSilence")}
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setLyricsOpen((v) => !v)}
                  aria-pressed={lyricsOpen}
                  className={`rounded-xl border p-1.5 transition-all ${
                    lyricsOpen
                      ? "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                      : "border-black/5 bg-black/[0.03] text-zinc-500 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08]"
                  }`}
                  title={translate(lang, "lyrics")}
                >
                  <MicVocal className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsSoundPanelOpen((v) => !v)}
                  aria-pressed={isSoundPanelOpen}
                  className={`rounded-xl border p-1.5 transition-all ${
                    isSoundPanelOpen || (eqEnabled && eqGains.some((g) => g !== 0)) || crossfadeSecs > 0
                      ? "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                      : "border-black/5 bg-black/[0.03] text-zinc-500 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08]"
                  }`}
                  title={translate(lang, "soundSettings")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                  title={isMuted ? translate(lang, "unmute") : translate(lang, "mute")}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-red-500" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 md:w-28 h-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 appearance-none cursor-pointer accent-violet-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Sound panel: crossfade + equalizer */}
            {isSoundPanelOpen && (
              <div className="w-full max-w-lg space-y-4 rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-xs dark:border-white/[0.06] dark:bg-white/[0.03]">
                <label className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-bold text-zinc-700 dark:text-zinc-300">
                    {translate(lang, "crossfade")}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={1}
                    value={crossfadeSecs}
                    onChange={(e) => setCrossfadeSecs(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 appearance-none cursor-pointer accent-violet-600"
                  />
                  <span className="w-10 text-end font-mono text-zinc-500">
                    {crossfadeSecs === 0 ? translate(lang, "sleepOff") : `${crossfadeSecs}s`}
                  </span>
                </label>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="me-2 flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={eqEnabled}
                        onChange={(e) => setEqEnabled(e.target.checked)}
                        className="accent-violet-600"
                      />
                      {translate(lang, "equalizer")}
                    </label>
                    {(Object.keys(EQ_PRESETS) as EqPreset[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEqPreset(p)}
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition-all ${
                          eqEnabled && EQ_PRESETS[p].every((g, i) => g === eqGains[i])
                            ? "bg-violet-600 text-white"
                            : "bg-black/[0.04] text-zinc-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-400"
                        }`}
                      >
                        {translate(lang, `eqPreset_${p}`)}
                      </button>
                    ))}
                  </div>
                  <div
                    dir="ltr"
                    className={`flex justify-between gap-1 transition-opacity ${eqEnabled ? "" : "opacity-40"}`}
                  >
                    {EQ_FREQS.map((f, i) => (
                      <div key={f} className="flex flex-col items-center gap-1">
                        <span className="font-mono text-[9px] text-zinc-500">
                          {eqGains[i] > 0 ? "+" : ""}
                          {eqGains[i]}
                        </span>
                        <input
                          type="range"
                          min={-EQ_RANGE_DB}
                          max={EQ_RANGE_DB}
                          step={1}
                          value={eqGains[i]}
                          onChange={(e) => setEqGain(i, Number(e.target.value))}
                          aria-label={`${f} Hz`}
                          className="h-24 w-4 cursor-pointer accent-violet-600 [writing-mode:vertical-lr] [direction:rtl]"
                        />
                        <span className="font-mono text-[9px] text-zinc-500">
                          {f >= 1000 ? `${f / 1000}k` : f}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Lyrics panel */}
            {lyricsOpen && (
              <div
                ref={lyricsBoxRef}
                className="relative w-full max-w-lg max-h-64 overflow-y-auto rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-center dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                {lyricsState === "loading" ? (
                  <p className="text-xs text-zinc-500">{translate(lang, "lyricsLoading")}</p>
                ) : !lyrics ? (
                  <p className="text-xs text-zinc-500">{translate(lang, "lyricsNone")}</p>
                ) : (
                  lyrics.map((l, i) => (
                    <p
                      key={i}
                      onClick={() => {
                        if (l.time === null || !audioRef.current) return;
                        finishFade();
                        audioRef.current.currentTime = l.time;
                        setSeekNonce((n) => n + 1);
                      }}
                      className={`py-1 text-sm transition-all ${
                        l.time !== null ? "cursor-pointer" : ""
                      } ${
                        i === activeLyric
                          ? "font-extrabold text-violet-600 dark:text-violet-300 scale-105"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {i === activeLyric && l.words
                        ? l.words.map((w, wi) => (
                            <span
                              key={wi}
                              className={
                                w.time <= currentTime ? "" : "text-zinc-400 dark:text-zinc-500"
                              }
                            >
                              {w.text}
                            </span>
                          ))
                        : l.text || "♪"}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty State / Welcome Dropzone */
          <div
            role="button"
            tabIndex={0}
            onClick={handleImportFiles}
            onKeyDown={(e) => e.key === "Enter" && handleImportFiles()}
            className="flex flex-col items-center justify-center gap-4 py-12 text-center cursor-pointer group"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-600 text-white shadow-xl shadow-purple-500/30 transition-transform duration-300 group-hover:scale-105">
              <Music className="h-9 w-9" strokeWidth={2.2} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {translate(lang, "noTracks")}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {translate(lang, "dropMusicHere")}
              </p>
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:brightness-105 active:scale-95"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>{translate(lang, "addSongs")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Playlist Section */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 shadow-md">
        {/* Playlist Header */}
        <div className="flex items-center justify-between border-b border-black/[0.05] pb-3.5 dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
              {listTab === "playlist" ? <ListMusic className="h-4 w-4" /> : <Library className="h-4 w-4" />}
            </div>
            <div role="tablist" className="flex gap-1">
              {(["playlist", "library"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={listTab === tab}
                  onClick={() => setListTab(tab)}
                  className={`rounded-lg px-2 py-0.5 text-sm font-bold transition-colors ${
                    listTab === tab
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  }`}
                >
                  {translate(lang, tab === "playlist" ? "playlistTitle" : "library")}
                </button>
              ))}
            </div>
            {listTab === "playlist" && playlist.length > 0 && (
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-400">
                {playlist.length}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-2 ${listTab === "playlist" ? "" : "hidden"}`}>
            <button
              type="button"
              onClick={handleImportFiles}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/5 bg-black/[0.03] px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-black/[0.06] dark:border-white/5 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08] active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{translate(lang, "addSongs")}</span>
            </button>

            {playlist.length > 0 && (
              <button
                type="button"
                onClick={clearPlaylist}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
                title={translate(lang, "clearPlaylist")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{translate(lang, "clearPlaylist")}</span>
              </button>
            )}
          </div>
        </div>

        {listTab === "library" && <LibraryPanel lang={lang} />}

        {/* Playlist Items List */}
        <div
          className={`mt-3 divide-y divide-black/[0.03] dark:divide-white/[0.03] max-h-[380px] overflow-y-auto pr-1 ${
            listTab === "playlist" ? "" : "hidden"
          }`}
        >
          {playlist.length > 0 ? (
            playlist.map((track, idx) => {
              const isSelected = idx === currentTrackIndex;
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(idx)}
                  className={`group flex items-center justify-between rounded-2xl p-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-violet-500/10 border border-violet-500/20 shadow-sm"
                      : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Index or Equalizer indicator */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-xs font-mono font-bold">
                      {isSelected && isPlaying ? (
                        <div className="flex items-end gap-0.5 h-3">
                          <div className="w-0.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-eq-1" />
                          <div className="w-0.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-eq-2" />
                          <div className="w-0.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-eq-3" />
                        </div>
                      ) : (
                        <span
                          className={
                            isSelected
                              ? "text-violet-600 dark:text-violet-400 font-extrabold"
                              : "text-zinc-400"
                          }
                        >
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Track info */}
                    <div className="min-w-0">
                      <p
                        className={`truncate text-xs font-bold ${
                          isSelected
                            ? "text-violet-700 dark:text-violet-300 font-extrabold"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {track.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold uppercase">{track.format}</span>
                        {track.sizeBytes > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatBytes(track.sizeBytes)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Duration */}
                  <div className="flex items-center gap-2 shrink-0">
                    {track.durationSecs > 0 && (
                      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatDuration(track.durationSecs)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTrack(track.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
                      title={translate(lang, "removeTrack")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {translate(lang, "noTracks")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
