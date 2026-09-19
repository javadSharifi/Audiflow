// @vitest-environment jsdom
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MusicPlayerNav, type PlayerTab } from "../MusicPlayerNav";
import { MusicPlayerView } from "../MusicPlayerView";
import { useAppStore } from "../../../stores/useAppStore";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";

vi.mock("../../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../utils/tauri")>();
  return {
    ...actual,
    scanAudioFiles: vi.fn(async () => []),
  };
});

beforeEach(() => {
  cleanup();
  useAppStore.setState({
    lang: "en",
    activeTool: "player",
  });
  useMusicPlayerStore.setState({
    tracks: [],
    loading: false,
    hasScanned: true,
    likedPaths: new Set(),
    customAlbums: [],
  });
});

describe("MusicPlayerNav", () => {
  it("renders the 4 navigation tabs (Songs, Albums, Liked, Sound Boost)", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    expect(screen.getByRole("tab", { name: /Songs/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Albums/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Liked/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Sound Boost/i })).toBeTruthy();
  });

  it("calls onSelectTab when a tab is clicked", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    fireEvent.click(screen.getByRole("tab", { name: /Albums/i }));
    expect(onSelect).toHaveBeenCalledWith("album");

    fireEvent.click(screen.getByRole("tab", { name: /Liked/i }));
    expect(onSelect).toHaveBeenCalledWith("like");

    fireEvent.click(screen.getByRole("tab", { name: /Sound Boost/i }));
    expect(onSelect).toHaveBeenCalledWith("boost");

    fireEvent.click(screen.getByRole("tab", { name: /Songs/i }));
    expect(onSelect).toHaveBeenCalledWith("songs");
  });

  it("marks the active tab as selected with aria-selected", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="boost" onSelectTab={onSelect} />);

    expect(screen.getByRole("tab", { name: /Sound Boost/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /Songs/i }).getAttribute("aria-selected")).toBe("false");
  });

  it("collapses inactive labels on mobile (only active shows text)", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    // All tabs keep accessible names via aria-label even when visually collapsed
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.getAttribute("aria-label")).toBeTruthy();
    }

    const activeLabel = screen.getByRole("tab", { name: /Songs/i }).querySelector("span");
    expect(activeLabel?.className ?? "").not.toMatch(/(^|\s)hidden(\s|$)/);

    const inactiveLabel = screen.getByRole("tab", { name: /Albums/i }).querySelector("span");
    expect(inactiveLabel?.className ?? "").toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("renders the converter tab alongside the 4 player tabs", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    expect(screen.getByRole("tab", { name: /Audio Converter/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Songs/i })).toBeTruthy();
  });

  it("switches activeTool to converter when the converter tab is clicked", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    fireEvent.click(screen.getByRole("tab", { name: /Audio Converter/i }));

    expect(useAppStore.getState().activeTool).toBe("converter");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("switches activeTool back to player when a player tab is clicked", () => {
    useAppStore.setState({ activeTool: "converter" });
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    fireEvent.click(screen.getByRole("tab", { name: /Songs/i }));

    expect(useAppStore.getState().activeTool).toBe("player");
    expect(onSelect).toHaveBeenCalledWith("songs");
  });

  it("marks the converter tab selected when activeTool is converter", () => {
    useAppStore.setState({ activeTool: "converter" });
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    expect(screen.getByRole("tab", { name: /Audio Converter/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /Songs/i }).getAttribute("aria-selected")).toBe("false");
  });

  it("keeps the active pill content-sized (no flex-1 stretch)", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    const activeClass = screen.getByRole("tab", { name: /Songs/i }).className;
    expect(activeClass).toMatch(/(^|\s)flex-none(\s|$)/);
    expect(activeClass).not.toMatch(/(^|\s)flex-1(\s|$)/);
  });

  it("orders tabs album, liked, songs, boost, converter", () => {
    const onSelect = vi.fn();
    render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    const labels = screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"));
    expect(labels).toEqual(["Albums", "Liked", "Songs", "Sound Boost", "Audio Converter"]);
  });

  it("uses a wider dock on desktop so labels are not truncated", () => {
    const onSelect = vi.fn();
    const { container } = render(<MusicPlayerNav activeTab="songs" onSelectTab={onSelect} />);

    const nav = container.querySelector("nav");
    expect(nav?.className ?? "").toMatch(/sm:max-w-xl/);
  });

  it("constrains tabs inside dock (no overflow on narrow windows)", () => {
    const onSelect = vi.fn();
    const { container } = render(<MusicPlayerNav activeTab="boost" onSelectTab={onSelect} />);

    const dock = container.querySelector("nav > div");
    expect(dock?.className ?? "").toMatch(/overflow-hidden/);

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toMatch(/min-w-0/);
      expect(tab.className).toMatch(/overflow-hidden/);
      const label = tab.querySelector("span");
      expect(label?.className ?? "").toMatch(/truncate/);
    }
    const activeClass = screen.getByRole("tab", { name: /Sound Boost/i }).className;
    expect(activeClass).toMatch(/max-w-/);
  });
});

describe("MusicPlayerView", () => {
  function PlayerHarness({ initialTab = "songs" as PlayerTab }: { initialTab?: PlayerTab }) {
    const [tab, setTab] = useState<PlayerTab>(initialTab);
    return (
      <>
        <MusicPlayerView activeTab={tab} onSelectTab={setTab} />
        <MusicPlayerNav activeTab={tab} onSelectTab={setTab} />
      </>
    );
  }

  it("switches tab content when clicking navigation items and defaults to Songs", async () => {
    render(<PlayerHarness />);

    // Default tab is Songs with search input
    expect(screen.getByPlaceholderText(/Search songs/i)).toBeTruthy();

    // Click Liked -> renders LikedView
    fireEvent.click(screen.getByRole("tab", { name: /Liked/i }));
    expect(screen.getByText(/No liked songs yet/i)).toBeTruthy();

    // Click Albums -> renders AlbumsView
    fireEvent.click(screen.getByRole("tab", { name: /Albums/i }));
    expect(screen.getAllByText(/My Custom Albums/i).length).toBeGreaterThan(0);

    // Click Sound Boost -> renders BoosterView (lazy chunk: await it)
    fireEvent.click(screen.getByRole("tab", { name: /Sound Boost/i }));
    expect(
      await screen.findByRole("switch", { name: /Toggle Sound Booster/i }),
    ).toBeTruthy();
  });

  it("renders localized text in Persian (fa)", async () => {
    useAppStore.setState({ lang: "fa" });
    render(<PlayerHarness />);

    expect(screen.getByRole("tab", { name: /آهنگ‌ها/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /آلبوم‌ها/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /علاقه‌مندی‌ها/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /افزایش صدا/i })).toBeTruthy();

    // Click افزایش صدا -> renders Persian BoosterView (lazy chunk: await it)
    fireEvent.click(screen.getByRole("tab", { name: /افزایش صدا/i }));
    expect(await screen.findByText(/افزایش صدای سراسری گوشی/i)).toBeTruthy();
  });
});
