import { lazy, Suspense, useEffect, useState } from "react";
import type { PlayerTab } from "./MusicPlayerNav";
import { SongsView } from "./SongsView";
import { LikedView } from "./LikedView";
import { AlbumsView } from "./AlbumsView";
import { KeepAlivePane } from "./KeepAlivePane";
import { MiniPlayer } from "./MiniPlayer";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { ANDROID_BACK_EVENT, markBackConsumed, wasBackConsumed } from "../../utils/androidBack";
import { isAndroid } from "../../utils/platform";

// Code splitting: the fullscreen player (largest component in the app) and
// the booster dial are not part of first paint — load them on first use so
// the initial chunk stays small (Vite warned about a >500 kB single chunk).
const NowPlayingView = lazy(() =>
  import("./NowPlayingView").then((m) => ({ default: m.NowPlayingView })),
);
const BoosterView = lazy(() =>
  import("./BoosterView").then((m) => ({ default: m.BoosterView })),
);

/** Local chunk fetch is near-instant; no spinner needed. */
function LazyFallback(): null {
  return null;
}

export interface MusicPlayerViewProps {
  activeTab?: PlayerTab;
  onSelectTab?: (tab: PlayerTab) => void;
}

export function MusicPlayerView(props?: MusicPlayerViewProps): React.JSX.Element {
  const [internalTab, setInternalTab] = useState<PlayerTab>("songs");
  const activeTab = props?.activeTab ?? internalTab;
  const setFullscreenOpen = useMusicPlayerStore((s) => s.setFullscreenOpen);
  const fullscreenOpen = useMusicPlayerStore((s) => s.fullscreenOpen);

  const handleSelectTab = (tab: PlayerTab) => {
    if (props?.onSelectTab) {
      props.onSelectTab(tab);
    } else {
      setInternalTab(tab);
    }
    setFullscreenOpen(false);
  };

  // Android back: album/like/boost tabs go home to songs first (consumes the press
  // so App doesn't also jump to converter on the same press).
  useEffect(() => {
    if (!isAndroid()) return;
    const onBack = () => {
      if (wasBackConsumed()) return;
      if (fullscreenOpen) return; // NowPlayingView handles fullscreen/sheets.
      if (activeTab !== "songs") {
        handleSelectTab("songs");
        markBackConsumed();
      }
    };
    window.addEventListener(ANDROID_BACK_EVENT, onBack as EventListener);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, onBack as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fullscreenOpen, setFullscreenOpen]);

  return (
    <div className="flex flex-col flex-1 w-full gap-3 min-h-0 overflow-hidden relative">
      {/* Persistent Keep-Alive Tab Panes (Instant switching, zero DOM thrash) */}
      <KeepAlivePane active={activeTab === "songs"}>
        <SongsView />
      </KeepAlivePane>
      <KeepAlivePane active={activeTab === "like"}>
        <LikedView />
      </KeepAlivePane>
      <KeepAlivePane active={activeTab === "boost"}>
        <Suspense fallback={<LazyFallback />}>
          <BoosterView />
        </Suspense>
      </KeepAlivePane>
      <KeepAlivePane active={activeTab === "album"}>
        <AlbumsView />
      </KeepAlivePane>

      {/* Fullscreen Now Playing View (covers nav + mini player) */}
      <Suspense fallback={<LazyFallback />}>
        <NowPlayingView />
      </Suspense>

      {/* Floating Mini Player (hidden in fullscreen so it never covers popups) */}
      {!fullscreenOpen && <MiniPlayer />}
    </div>
  );
}
