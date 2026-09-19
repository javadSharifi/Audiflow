// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOT_PREFS_KEY,
  FIRST_RUN_DONE_KEY,
  REDUCED_BLUR_KEY,
  TRACKS_CACHE_KEY,
  checkAndGrandfatherFirstRun,
  isFirstRunDone,
  markFirstRunDone,
  readBootPrefs,
  writeBootPrefs,
} from "./bootPrefs";

// In-memory localStorage mock (same pattern as HeaderBar.test.tsx).
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

vi.stubGlobal("localStorage", storageMock);

beforeEach(() => {
  storageMock.clear();
});

describe("bootPrefs", () => {
  it("returns null when nothing is cached", () => {
    expect(readBootPrefs()).toBeNull();
  });

  it("round-trips language and theme", () => {
    writeBootPrefs({ language: "fa", theme: "dark" });
    expect(readBootPrefs()).toEqual({ language: "fa", theme: "dark" });
    expect(localStorage.getItem(BOOT_PREFS_KEY)).toContain("fa");
  });

  it("rejects corrupt or partial payloads", () => {
    localStorage.setItem(BOOT_PREFS_KEY, "not-json{{{");
    expect(readBootPrefs()).toBeNull();
    localStorage.setItem(BOOT_PREFS_KEY, JSON.stringify({ language: "fa" }));
    expect(readBootPrefs()).toBeNull();
    localStorage.setItem(BOOT_PREFS_KEY, JSON.stringify({ language: "de", theme: "dark" }));
    expect(readBootPrefs()).toBeNull();
  });

  describe("checkAndGrandfatherFirstRun", () => {
    it("returns false on clean slate (fresh install)", () => {
      expect(checkAndGrandfatherFirstRun()).toBe(false);
      expect(isFirstRunDone()).toBe(false);
    });

    it("returns true when first run is already marked done", () => {
      markFirstRunDone();
      expect(localStorage.getItem(FIRST_RUN_DONE_KEY)).toBe("1");
      expect(checkAndGrandfatherFirstRun()).toBe(true);
      expect(isFirstRunDone()).toBe(true);
    });

    it("grandfathers when ac:ui-prefs is present without first-run flag", () => {
      localStorage.setItem(BOOT_PREFS_KEY, JSON.stringify({ language: "en", theme: "dark" }));
      expect(checkAndGrandfatherFirstRun()).toBe(true);
      expect(isFirstRunDone()).toBe(true);
    });

    it("grandfathers when ac:reduced-blur is present without first-run flag", () => {
      localStorage.setItem(REDUCED_BLUR_KEY, "1");
      expect(checkAndGrandfatherFirstRun()).toBe(true);
      expect(isFirstRunDone()).toBe(true);
    });

    it("grandfathers when cached tracks exist without first-run flag", () => {
      localStorage.setItem(
        TRACKS_CACHE_KEY,
        JSON.stringify([{ id: "t1", uri: "file:///music/t1.mp3" }]),
      );
      expect(checkAndGrandfatherFirstRun()).toBe(true);
      expect(isFirstRunDone()).toBe(true);
    });
  });
});
