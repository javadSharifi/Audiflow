// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LanguageSection } from "../LanguageSection";
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

describe("LanguageSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      lang: "en",
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

  it("renders Persian and English options", () => {
    render(<LanguageSection />);
    expect(screen.getByRole("button", { name: /فارسی/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /English/i })).toBeTruthy();
  });

  it("selects Persian immediately on click and updates store lang", () => {
    render(<LanguageSection />);
    const faBtn = screen.getByRole("button", { name: /فارسی/i });
    fireEvent.click(faBtn);

    expect(useAppStore.getState().lang).toBe("fa");
  });
});
