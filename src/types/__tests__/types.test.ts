import { describe, it, expect } from "vitest";
import type { AppSettings, CustomAlbum, InputFile } from "../index";

describe("Types Structure Verification", () => {
  it("verifies AppSettings mock structure conforms to contract", () => {
    const mockSettings: AppSettings = {
      language: "fa",
      theme: "dark",
      reducedBlur: true,
      defaultFormat: "mp3",
      defaultQuality: "medium",
      defaultOutputMode: "same_as_source",
      defaultOutputDir: null,
      autoOpenOutputFolder: false,
      concurrency: 2,
      removeSilenceDefault: false,
      silenceThresholdDb: -30,
      silenceMinDurationSecs: 2,
      ffmpegPathOverride: null,
    };

    expect(mockSettings.language).toBe("fa");
    expect(mockSettings.concurrency).toBe(2);
  });

  it("verifies CustomAlbum model fields", () => {
    const album: CustomAlbum = {
      id: "album_123",
      name: "Favorites",
      trackKeys: ["track_1", "track_2"],
      createdAtMs: 1700000000000,
      updatedAtMs: 1700000005000,
    };

    expect(album.name).toBe("Favorites");
    expect(album.trackKeys).toHaveLength(2);
  });

  it("verifies InputFile structure defaults", () => {
    const file: InputFile = {
      path: "/audio/test.mp3",
      name: "test.mp3",
      sizeBytes: 1024,
      durationSecs: 60,
      formatName: "mp3",
      hasAudio: true,
      error: null,
    };

    expect(file.hasAudio).toBe(true);
    expect(file.sizeBytes).toBe(1024);
  });
});
