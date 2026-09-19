// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../useAppStore";
import * as api from "../../utils/tauri";

vi.mock("../../utils/tauri", () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("settingsSlice autoOpenOutputFolder coercion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coerces autoOpenOutputFolder from true to false on settings load and persists correction", async () => {
    vi.mocked(api.getSettings).mockResolvedValueOnce({
      language: "en",
      theme: "dark",
      defaultFormat: "mp3",
      defaultQuality: "medium",
      removeSilenceDefault: false,
      silenceThresholdDb: -30,
      silenceMinDurationSecs: 2,
      defaultOutputMode: "same_as_source",
      defaultOutputDir: null,
      concurrency: 2,
      autoOpenOutputFolder: true, // stored true from previous version
      ffmpegPathOverride: null,
    });

    await useAppStore.getState().loadSettings();

    // Store settings should have coerced autoOpenOutputFolder to false
    expect(useAppStore.getState().settings?.autoOpenOutputFolder).toBe(false);

    // Should have persisted the correction back to storage (one-time self-healing migration)
    expect(api.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoOpenOutputFolder: false }),
    );
  });

  it("leaves autoOpenOutputFolder as false without extra persist when already false", async () => {
    vi.mocked(api.getSettings).mockResolvedValueOnce({
      language: "en",
      theme: "dark",
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
    });

    await useAppStore.getState().loadSettings();

    expect(useAppStore.getState().settings?.autoOpenOutputFolder).toBe(false);
    expect(api.saveSettings).not.toHaveBeenCalled();
  });
});
