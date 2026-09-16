// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";
import { TrackRow } from "../TrackRow";
import { MultiSelectActionBar } from "../MultiSelectActionBar";
import { TrackDetailsModal } from "../TrackDetailsModal";
import { AddToAlbumModal } from "../AddToAlbumModal";
import type { AudioTrackInfo } from "../../../types";

vi.mock("../../../utils/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../utils/platform")>();
  return { ...actual, isAndroid: vi.fn(() => true) };
});

const mockTrack: AudioTrackInfo = {
  id: "track_sheet_1",
  uri: "file:///music/sheet1.mp3",
  path: "/music/sheet1.mp3",
  name: "sheet1.mp3",
  title: "Sheet Song",
  artist: "Artist",
  album: "Album",
  durationSecs: 200,
  sizeBytes: 5000000,
  createdTimestampMs: 1000,
  modifiedTimestampMs: 1000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

beforeEach(() => {
  cleanup();
  document.body.innerHTML = "";
  useAppStore.setState({ lang: "en" });
  useMusicPlayerStore.setState({
    tracks: [mockTrack],
    currentPlaylist: [mockTrack],
    currentTrack: null,
    isPlaying: false,
    likedPaths: new Set(),
    selectedTrackKeys: new Set(),
    isSelectionMode: false,
    customAlbums: [],
  });
});

describe("Sheet positioning regression", () => {
  it("Bug1: selection bar sits above MiniPlayer when a track is loaded", () => {
    useMusicPlayerStore.setState({
      isSelectionMode: true,
      selectedTrackKeys: new Set([mockTrack.uri]),
      currentTrack: mockTrack,
    });
    const { container } = render(<MultiSelectActionBar tracks={[mockTrack]} />);
    const bar = container.querySelector(".fixed") as HTMLElement | null;
    expect(bar).toBeTruthy();
    // Must NOT use the same bottom-20 offset as the MiniPlayer when a track exists.
    expect(bar!.className).not.toContain("bottom-20");
  });

  it("Bug2: TrackOptionsSheet portals to document.body (escapes transform ancestor)", () => {
    const { container } = render(
      <div style={{ transform: "translateY(100px)", overflow: "hidden" }}>
        <TrackRow track={mockTrack} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /More options/i }));
    expect(screen.getByText(/Like track/i)).toBeTruthy();
    // Sheet root must be a direct child of body, not inside the transformed wrapper.
    const bodyHasSheet = document.body.textContent?.includes("Like track");
    expect(bodyHasSheet).toBe(true);
    const wrapperHasSheet = container.textContent?.includes("Like track");
    expect(wrapperHasSheet).toBe(false);
  });

  it("Bug3: nested modals use bottom-sheet pattern, portal to body, layer above sheet", () => {
    render(<TrackDetailsModal track={mockTrack} onClose={() => {}} />);
    const outer = document.body.querySelector(".fixed.inset-0") as HTMLElement | null;
    expect(outer).toBeTruthy();
    expect(outer!.className).toContain("justify-end");
    expect(outer!.className).toContain("z-[90]");
    expect(outer!.className).not.toContain("z-[70]");
    const card = outer!.querySelector(".rounded-t-3xl") as HTMLElement | null;
    expect(card).toBeTruthy();

    cleanup();
    render(<AddToAlbumModal track={mockTrack} onClose={() => {}} />);
    const albumOuter = document.body.querySelector(".fixed.inset-0") as HTMLElement | null;
    expect(albumOuter).toBeTruthy();
    expect(albumOuter!.className).toContain("z-[90]");
  });
});
