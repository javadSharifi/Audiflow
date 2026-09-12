// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOT_PREFS_KEY, readBootPrefs, writeBootPrefs } from "./bootPrefs";

// In-memory localStorage mock (same pattern as ToolSwitcher.test.tsx).
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
});
