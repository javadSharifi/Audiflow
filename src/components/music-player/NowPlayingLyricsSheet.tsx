import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Music2 } from "lucide-react";
import { translate, type Lang } from "../../i18n";
import { trackLyrics } from "../../utils/tauri";
import { activeLineIndex, fetchOnlineLyrics, parseLrc, type LyricLine } from "../../utils/lyrics";
import type { AudioTrackInfo } from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  track: AudioTrackInfo;
  currentTime: number;
  lang: Lang;
}

export function NowPlayingLyricsSheet({
  isOpen,
  onClose,
  track,
  currentTime,
  lang,
}: Props): React.JSX.Element | null {
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const path = track.path || track.uri;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    // Reset on open/track change; the effect owns this state for the current key.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLines(null);

    void (async () => {
      let raw: string | null = null;
      try {
        raw = await trackLyrics(path);
      } catch { /* best-effort: try online */ }
      // LRCLIB only knows published releases; use tags when we have them.
      if (!raw) {
        const artist = track.artist?.trim();
        const title = (track.title || track.name).trim();
        if (artist && title) {
          try {
            raw = await fetchOnlineLyrics(artist, title, track.durationSecs ?? 0);
          } catch { /* offline: show the empty state */ }
        }
      }
      if (cancelled) return;
      setLines(raw ? parseLrc(raw) : null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, path, track.artist, track.title, track.name, track.durationSecs]);

  const active = useMemo(
    () => (lines ? activeLineIndex(lines, currentTime) : -1),
    [lines, currentTime],
  );

  // Keep the active line in view as playback advances.
  useEffect(() => {
    if (active < 0) return;
    const box = boxRef.current;
    const el = box?.children[active] as HTMLElement | undefined;
    if (box && el) {
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
    }
  }, [active]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-lg mx-auto h-[60vh] rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 shadow-2xl p-5 flex flex-col gap-3 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Music2 className="h-4 w-4 text-orange-500 shrink-0" />
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {translate(lang, "lyrics")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={boxRef} className="flex-1 overflow-y-auto flex flex-col gap-3 scroll-smooth">
          {loading ? null : !lines || lines.length === 0 ? (
            <p className="m-auto text-xs text-zinc-400 text-center px-6">
              {translate(lang, "noLyricsAvailable")}
            </p>
          ) : (
            lines.map((line, i) => (
              <p
                key={i}
                className={`text-sm font-semibold leading-relaxed transition-colors ${
                  i === active
                    ? "text-orange-500"
                    : "text-zinc-500 dark:text-zinc-400 opacity-70"
                }`}
              >
                {line.words
                  ? line.words.map((w, wi) => (
                      <span
                        key={wi}
                        className={currentTime >= w.time ? "text-orange-500" : "opacity-50"}
                      >
                        {w.text}
                      </span>
                    ))
                  : line.text}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
