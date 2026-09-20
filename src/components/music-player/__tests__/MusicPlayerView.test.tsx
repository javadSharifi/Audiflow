// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MusicPlayerView } from "../MusicPlayerView";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";

vi.mock("../../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../utils/tauri")>();
  return {
    ...actual,
    scanAudioFiles: vi.fn(async () => []),
    getMusicPermissionStatus: vi.fn(async () => "granted"),
    requestMediaPermissions: vi.fn(async () => true),
    openAppSettings: vi.fn(async () => {}),
    hasNotificationPermission: vi.fn(async () => true),
  };
});

describe("MusicPlayerView Tab Pre-Warming & Lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
    useAppStore.setState({ lang: "en" });
    useMusicPlayerStore.setState({
      tracks: [
        {
          id: "track_1",
          uri: "file:///music/t1.mp3",
          path: "/music/t1.mp3",
          name: "t1.mp3",
          title: "Test Track",
          artist: "Test Artist",
          album: "Test Album",
          durationSecs: 180,
          sizeBytes: 5000000,
          createdTimestampMs: 1000,
          modifiedTimestampMs: 1000,
          format: "mp3",
          mimeType: "audio/mpeg",
          coverUrl: null,
        },
      ],
      customAlbums: [],
      likedPaths: new Set(),
      loading: false,
      hasScanned: true,
      fullscreenOpen: false,
    });
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it("mounts SongsView on cold start and defers AlbumsView until idle pre-warm runs", () => {
    render(<MusicPlayerView activeTab="songs" />);

    // Songs view is mounted and active
    expect(screen.getByText("Test Track")).toBeDefined();

    // Before idle callback triggers, AlbumsView should not be in the DOM
    expect(screen.queryByText(/Artists & Library Albums/i)).toBeNull();

    // Advance timers / idle callback
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // After idle pre-warm, AlbumsView is mounted into background DOM
    const albumsHeader = screen.getByText(/Artists & Library Albums/i);
    expect(albumsHeader).toBeDefined();

    // The container for albums must be display: none while songs is active
    const albumPane = albumsHeader.closest('div[style*="display: none"]');
    expect(albumPane).not.toBeNull();
  });

  it("smoothly activates pre-warmed tabs when user switches activeTab", () => {
    const { rerender } = render(<MusicPlayerView activeTab="songs" />);

    // Advance idle timers so pre-warm completes
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText(/Artists & Library Albums/i)).toBeDefined();

    // Switch to album tab
    rerender(<MusicPlayerView activeTab="album" />);

    const albumsHeader = screen.getByText(/Artists & Library Albums/i);
    const visiblePane = albumsHeader.closest("div.flex");
    expect(visiblePane).not.toBeNull();
    expect((visiblePane as HTMLElement).style.display).not.toBe("none");
  });
});
