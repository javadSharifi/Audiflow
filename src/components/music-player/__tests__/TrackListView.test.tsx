// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrackListView } from "../TrackListView";
import { KeepAlivePane } from "../KeepAlivePane";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";
import type { AudioTrackInfo } from "../../../types";

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

const mockTracks: AudioTrackInfo[] = [
  {
    id: "track_1",
    uri: "file:///music/track1.mp3",
    path: "/music/track1.mp3",
    name: "track1.mp3",
    title: "Alpha Song",
    artist: "Artist One",
    album: "Album A",
    durationSecs: 180,
    sizeBytes: 5000000,
    createdTimestampMs: 1000,
    modifiedTimestampMs: 1000,
    format: "mp3",
    mimeType: "audio/mpeg",
    coverUrl: null,
  },
  {
    id: "track_2",
    uri: "file:///music/track2.flac",
    path: "/music/track2.flac",
    name: "track2.flac",
    title: "Beta Song",
    artist: "Artist Two",
    album: "Album B",
    durationSecs: 240,
    sizeBytes: 25000000,
    createdTimestampMs: 5000,
    modifiedTimestampMs: 5000,
    format: "flac",
    mimeType: "audio/flac",
    coverUrl: null,
  },
  {
    id: "track_3",
    uri: "file:///music/track3.m4a",
    path: "/music/track3.m4a",
    name: "track3.m4a",
    title: "Gamma Song",
    artist: "Artist Three",
    album: "Album C",
    durationSecs: 200,
    sizeBytes: 8000000,
    createdTimestampMs: 3000,
    modifiedTimestampMs: 3000,
    format: "m4a",
    mimeType: "audio/mp4",
    coverUrl: null,
  },
];

describe("TrackListView Virtualization & Rendering", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ lang: "en" });
    useMusicPlayerStore.setState({
      tracks: mockTracks,
      loading: false,
      hasScanned: true,
      permissionStatus: "granted",
      searchQuery: "",
      sortBy: "newest",
      likedPaths: new Set(),
      currentTrack: null,
      isPlaying: false,
    });
  });

  it("renders virtualized track items and total count", () => {
    render(<TrackListView />);

    expect(screen.getByText("3 songs")).toBeDefined();
    expect(screen.getByText("Alpha Song")).toBeDefined();
    expect(screen.getByText("Beta Song")).toBeDefined();
    expect(screen.getByText("Gamma Song")).toBeDefined();
  });

  it("filters virtualized tracks when searching", () => {
    render(<TrackListView />);

    const searchInput = screen.getByPlaceholderText("Search songs, artists, albums...");
    fireEvent.change(searchInput, { target: { value: "Alpha" } });

    expect(screen.getByText("Alpha Song")).toBeDefined();
    expect(screen.queryByText("Beta Song")).toBeNull();
    expect(screen.queryByText("Gamma Song")).toBeNull();
  });

  it("opens sort dropdown and switches sort order", () => {
    render(<TrackListView />);

    const sortBtn = screen.getByLabelText("Sort by");
    fireEvent.click(sortBtn);

    // Dropdown is open
    const titleSortOption = screen.getByText("Title (A-Z)");
    fireEvent.click(titleSortOption);

    expect(useMusicPlayerStore.getState().sortBy).toBe("title");
  });

  it("renders empty state when no search matches exist", () => {
    render(<TrackListView />);

    const searchInput = screen.getByPlaceholderText("Search songs, artists, albums...");
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    expect(screen.getByText(/No tracks matching/)).toBeDefined();
  });

  it("renders liked tracks cleanly when mounted inside a pre-warmed KeepAlivePane", () => {
    useMusicPlayerStore.setState({
      likedPaths: new Set(["/music/track1.mp3"]),
    });

    const { container, rerender } = render(
      <KeepAlivePane active={false} prewarm={true}>
        <TrackListView likedOnly={true} />
      </KeepAlivePane>
    );

    const pane = container.firstElementChild as HTMLElement;
    expect(pane.style.display).toBe("none");
    expect(screen.getByText("Alpha Song")).toBeDefined();
    expect(screen.queryByText("Beta Song")).toBeNull();

    rerender(
      <KeepAlivePane active={true} prewarm={true}>
        <TrackListView likedOnly={true} />
      </KeepAlivePane>
    );

    expect(pane.style.display).not.toBe("none");
    expect(screen.getByText("Alpha Song")).toBeDefined();
  });
});
