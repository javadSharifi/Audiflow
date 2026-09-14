// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { open } from "@tauri-apps/plugin-dialog";
import { pickDirectories } from "../dialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

const mockedOpen = vi.mocked(open);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pickDirectories", () => {
  it("returns [] when the dialog is cancelled", async () => {
    mockedOpen.mockResolvedValue(null);
    await expect(pickDirectories()).resolves.toEqual([]);
    expect(mockedOpen).toHaveBeenCalledWith({ directory: true, multiple: true });
  });

  it("wraps a single picked directory in an array", async () => {
    mockedOpen.mockResolvedValue("/home/tester/Music");
    await expect(pickDirectories()).resolves.toEqual(["/home/tester/Music"]);
  });

  it("returns multiple picked directories as-is", async () => {
    mockedOpen.mockResolvedValue(["/a", "/b"]);
    await expect(pickDirectories()).resolves.toEqual(["/a", "/b"]);
  });

  it("fails soft with [] when the dialog throws", async () => {
    mockedOpen.mockRejectedValue(new Error("denied"));
    await expect(pickDirectories()).resolves.toEqual([]);
  });
});
