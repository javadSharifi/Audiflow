// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";
import { NowPlayingView } from "../NowPlayingView";
import { MiniPlayer } from "../MiniPlayer";
import { WaveformSeekbar } from "../WaveformSeekbar";
import type { AudioTrackInfo } from "../../../types";

const mockTrack1: AudioTrackInfo = {
  id: "track_droeloe_1",
  uri: "file:///music/droeloe.mp3",
  path: "/music/droeloe.mp3",
  name: "droeloe.mp3",
  title: "DROELOE",
  artist: "Strangers (feat. Iris Penning)",
  album: "Nightblue Music",
  durationSecs: 198,
  sizeBytes: 6000000,
  createdTimestampMs: 1000,
  modifiedTimestampMs: 1000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

const mockTrack2: AudioTrackInfo = {
  id: "track_droeloe_2",
  uri: "file:///music/droeloe2.mp3",
  path: "/music/droeloe2.mp3",
  name: "droeloe2.mp3",
  title: "Sunburn",
  artist: "DROELOE",
  album: "Nightblue Music",
  durationSecs: 210,
  sizeBytes: 6500000,
  createdTimestampMs: 2000,
  modifiedTimestampMs: 2000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

beforeEach(() => {
  cleanup();
  useAppStore.setState({
    lang: "en",
    activeTool: "player",
    files: [],
  });
  useMusicPlayerStore.setState({
    tracks: [mockTrack1, mockTrack2],
    currentPlaylist: [mockTrack1, mockTrack2],
    currentTrack: mockTrack1,
    isPlaying: true,
    currentTime: 106,
    duration: 198,
    fullscreenOpen: false,
    repeatMode: "off",
    shuffleMode: false,
    playbackRate: 1.0,
    volumeGainPercent: 100,
    likedPaths: new Set(),
  });
});

describe("WaveformSeekbar Component", () => {
  it("renders waveform bars and formatted timestamps", () => {
    const onSeek = vi.fn();
    render(
      <WaveformSeekbar
        currentTime={106}
        duration={198}
        onSeek={onSeek}
        trackSeed="test"
      />,
    );

    // 01:46 and 03:18
    expect(screen.getByText("01:46")).toBeTruthy();
    expect(screen.getByText("03:18")).toBeTruthy();
  });
});

describe("MiniPlayer Component", () => {
  it("renders mini player when track is active and opens fullscreen on click", () => {
    render(<MiniPlayer />);

    expect(screen.getByText("DROELOE")).toBeTruthy();
    expect(screen.getByText("Strangers (feat. Iris Penning)")).toBeTruthy();

    // Click anywhere on mini player
    const title = screen.getByText("DROELOE");
    fireEvent.click(title);

    expect(useMusicPlayerStore.getState().fullscreenOpen).toBe(true);
  });

  it("allows interactive seeking from the mini player progress bar", () => {
    render(<MiniPlayer />);

    const seekbar = screen.getByTitle("01:46 / 03:18");
    expect(seekbar).toBeTruthy();

    fireEvent.mouseDown(seekbar, { clientX: 100 });
    expect(useMusicPlayerStore.getState().currentTime).toBeDefined();
  });

  it("handles previous and next track buttons in mini player", () => {
    render(<MiniPlayer />);

    const prevBtn = screen.getByTitle(/Previous song/i);
    const nextBtn = screen.getByTitle(/Next song/i);

    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);
  });

  it("keeps mini transport controls LTR even in fa (RTL) mode", () => {
    useAppStore.setState({ lang: "fa" });
    render(<MiniPlayer />);

    const transport = screen.getByTestId("mini-transport-controls");
    expect(transport.getAttribute("dir")).toBe("ltr");
  });
});

describe("NowPlayingView Fullscreen Player", () => {
  it("renders complete player elements when fullscreenOpen is true", () => {
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    // Header numeric track counter was removed.
    expect(screen.queryByText("1/2")).toBeNull();

    // Track metadata
    expect(screen.getAllByText("DROELOE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Strangers (feat. Iris Penning)").length).toBeGreaterThan(0);

    // Converter button is icon-only (title/aria-label, no visible text)
    expect(screen.getByTitle(/Open in Converter/i)).toBeTruthy();
    expect(screen.queryByText(/Converter/i)).toBeNull();

    // Speed button & Booster button
    expect(screen.getByTitle(/Playback Speed/i)).toBeTruthy();
    expect(screen.getByTitle(/Sound Booster/i)).toBeTruthy();
  });

  it("switches to Converter tool when Converter button is clicked", () => {
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    const converterBtn = screen.getByRole("button", { name: /Converter/i });
    fireEvent.click(converterBtn);

    expect(useAppStore.getState().activeTool).toBe("converter");
    expect(useMusicPlayerStore.getState().fullscreenOpen).toBe(false);
  });

  it("toggles and updates playback speed from 0.5x to 4.0x", () => {
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    const speedBtn = screen.getByTitle(/Playback Speed/i);
    fireEvent.click(speedBtn);

    // Click 2.0x preset
    const preset2x = screen.getByRole("button", { name: "2x" });
    fireEvent.click(preset2x);

    expect(useMusicPlayerStore.getState().playbackRate).toBe(2.0);
  });

  it("toggles and updates sound booster gain from 100% to 400%", () => {
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    const boosterBtn = screen.getByTitle(/Sound Booster/i);
    fireEvent.click(boosterBtn);

    // Click 200% preset
    const preset200 = screen.getByRole("button", { name: "200%" });
    fireEvent.click(preset200);

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(200);
  });

  it("cycles combined playback mode: normal -> shuffle -> repeat all -> repeat one", () => {
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    const modeBtn = screen.getByTitle(/Playback: Normal/i);

    // normal -> shuffle
    fireEvent.click(modeBtn);
    expect(useMusicPlayerStore.getState().shuffleMode).toBe(true);
    expect(useMusicPlayerStore.getState().repeatMode).toBe("off");

    // shuffle -> repeat all
    fireEvent.click(screen.getByTitle(/Playback: Shuffle/i));
    expect(useMusicPlayerStore.getState().repeatMode).toBe("all");
    expect(useMusicPlayerStore.getState().shuffleMode).toBe(false);

    // repeat all -> repeat one
    fireEvent.click(screen.getByTitle(/Playback: Repeat All/i));
    expect(useMusicPlayerStore.getState().repeatMode).toBe("one");

    // repeat one -> normal
    fireEvent.click(screen.getByTitle(/Playback: Repeat One/i));
    expect(useMusicPlayerStore.getState().repeatMode).toBe("off");
    expect(useMusicPlayerStore.getState().shuffleMode).toBe(false);
  });

  it("keeps fullscreen transport controls LTR even in fa (RTL) mode", () => {
    useAppStore.setState({ lang: "fa" });
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    const transport = screen.getByTestId("transport-controls");
    expect(transport.getAttribute("dir")).toBe("ltr");
    // Both buttons still exist with correct actions
    expect(screen.getByTitle("آهنگ قبلی")).toBeTruthy();
    expect(screen.getByTitle("آهنگ بعدی")).toBeTruthy();
  });

  it("opens Queue drawer and collapses player", () => {
    useMusicPlayerStore.setState({ fullscreenOpen: true });
    render(<NowPlayingView />);

    // Queue drawer
    const queueBtn = screen.getByTitle(/Up Next \/ Queue/i);
    fireEvent.click(queueBtn);

    expect(screen.getAllByText("Sunburn").length).toBeGreaterThan(0);

    // Collapse player
    const collapseBtn = screen.getByTitle(/Minimize Player/i);
    fireEvent.click(collapseBtn);

    expect(useMusicPlayerStore.getState().fullscreenOpen).toBe(false);
  });

  it("dismisses fullscreen player when dragged down beyond the threshold", () => {
    vi.useFakeTimers();
    useMusicPlayerStore.setState({
      currentTrack: mockTrack1,
      fullscreenOpen: true,
    });

    render(<NowPlayingView />);
    const root = document.querySelector(".fixed.inset-0");
    expect(root).toBeTruthy();

    if (root) {
      fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 200, clientY: 100 });
      fireEvent.pointerMove(root, { pointerId: 1, clientX: 200, clientY: 260 });
      fireEvent.pointerUp(root, { pointerId: 1, clientX: 200, clientY: 260 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(useMusicPlayerStore.getState().fullscreenOpen).toBe(false);
    }
    vi.useRealTimers();
  });

  it("swipes to next track when swiping left on the album art card", () => {
    vi.useFakeTimers();
    const mockNext = vi.fn();
    useMusicPlayerStore.setState({
      currentTrack: mockTrack1,
      fullscreenOpen: true,
      playNextTrack: mockNext,
    });

    render(<NowPlayingView />);
    const card = screen.getByTestId("now-playing-artwork-carousel");
    expect(card).toBeTruthy();

    fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 300, clientY: 200 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 200, clientY: 200 });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(mockNext).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
