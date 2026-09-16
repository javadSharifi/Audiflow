// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLatestRelease,
  isNewerVersion,
  normalizeVersion,
} from "./githubUpdate";

describe("normalizeVersion", () => {
  it("strips leading v", () => {
    expect(normalizeVersion("v1.4.4")).toBe("1.4.4");
  });

  it("leaves plain versions untouched", () => {
    expect(normalizeVersion("1.4.3")).toBe("1.4.3");
  });
});

describe("isNewerVersion", () => {
  it("detects a newer patch/minor/major", () => {
    expect(isNewerVersion("1.4.4", "1.4.3")).toBe(true);
    expect(isNewerVersion("1.5.0", "1.4.3")).toBe(true);
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
  });

  it("handles multi-digit segments numerically", () => {
    expect(isNewerVersion("1.4.10", "1.4.3")).toBe(true);
    expect(isNewerVersion("1.4.3", "1.4.10")).toBe(false);
  });

  it("ignores a leading v on either side", () => {
    expect(isNewerVersion("v1.4.4", "1.4.3")).toBe(true);
    expect(isNewerVersion("1.4.4", "v1.4.3")).toBe(true);
  });

  it("returns false for equal or older versions", () => {
    expect(isNewerVersion("1.4.3", "1.4.3")).toBe(false);
    expect(isNewerVersion("1.4.2", "1.4.3")).toBe(false);
  });
});

describe("fetchLatestRelease", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses the GitHub release payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          tag_name: "v1.5.0",
          name: "Audiflow 1.5.0",
          html_url: "https://github.com/javadSharifi/audio-converter/releases/tag/v1.5.0",
          body: "Bug fixes",
        }),
      })),
    );
    const release = await fetchLatestRelease();
    expect(release?.version).toBe("1.5.0");
    expect(release?.url).toContain("releases/tag/v1.5.0");
  });

  it("returns null when offline or the API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(fetchLatestRelease()).resolves.toBeNull();
  });
});
