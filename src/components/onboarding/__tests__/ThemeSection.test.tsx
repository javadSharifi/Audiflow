// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeSection } from "../ThemeSection";
import { useAppStore } from "../../../stores/useAppStore";

vi.mock("../../../utils/tauri", () => ({
  updateAppSettings: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({
    language: "en",
    theme: "system",
    defaultFormat: "mp3",
    defaultQuality: "medium",
    removeSilenceDefault: false,
    silenceThresholdDb: -30,
    silenceMinDurationSecs: 2,
    defaultOutputMode: "same_as_source",
    defaultOutputDir: null,
    concurrency: 2,
    autoOpenOutputFolder: false,
  }),
}));

describe("ThemeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      lang: "en",
      theme: "system",
      settings: {
        language: "en",
        theme: "system",
        defaultFormat: "mp3",
        defaultQuality: "medium",
        removeSilenceDefault: false,
        silenceThresholdDb: -30,
        silenceMinDurationSecs: 2,
        defaultOutputMode: "same_as_source",
        defaultOutputDir: null,
        concurrency: 2,
        autoOpenOutputFolder: false,
        ffmpegPathOverride: null,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders light, dark, and system options", () => {
    render(<ThemeSection />);
    expect(screen.getByRole("button", { name: /Light/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dark/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /System/i })).toBeTruthy();
  });

  it("selects dark theme immediately on click", () => {
    render(<ThemeSection />);
    const darkBtn = screen.getByRole("button", { name: /Dark/i });
    fireEvent.click(darkBtn);

    expect(useAppStore.getState().theme).toBe("dark");
  });

  it("selects light theme immediately on click", () => {
    render(<ThemeSection />);
    const lightBtn = screen.getByRole("button", { name: /Light/i });
    fireEvent.click(lightBtn);

    expect(useAppStore.getState().theme).toBe("light");
  });
});
