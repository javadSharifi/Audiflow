import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (p: string) => `asset://${p}` }));
vi.mock("../../../utils/tauri", () => ({ scanMusicLibrary: vi.fn() }));

import { filterLibrary, groupLibrary, toPlayerTrack } from "../library";
import type { LibraryTrack } from "../../../types/generated";

const t = (path: string, title: string | null, artist: string | null, album: string | null): LibraryTrack => ({
  path,
  name: path.split("/").pop()!,
  title,
  artist,
  album,
  durationSecs: 100,
  sizeBytes: 1,
});

const lib = [
  t("/m/b.mp3", "Beta", "Zed", "Two"),
  t("/m/a.mp3", "Alpha", "Zed", "One"),
  t("/m/x.flac", null, null, null),
  t("/m/c.mp3", "Gamma", "Amy", "One"),
];

describe("library", () => {
  it("groups by artist, sorted, untagged last", () => {
    const g = groupLibrary(lib, "artist");
    expect(g.map((x) => x.key)).toEqual(["Amy", "Zed", ""]);
    expect(g[1].tracks.map((x) => x.title)).toEqual(["Alpha", "Beta"]);
  });

  it("filters across tags and file name", () => {
    expect(filterLibrary(lib, "one").map((x) => x.path)).toEqual(["/m/a.mp3", "/m/c.mp3"]);
    expect(filterLibrary(lib, "x.FLAC")).toHaveLength(1);
    expect(filterLibrary(lib, "  ")).toHaveLength(4);
  });

  it("converts to a player track with a file-name title fallback", () => {
    const p = toPlayerTrack(lib[2], 0);
    expect([p.title, p.format, p.assetUrl]).toEqual(["x", "FLAC", "asset:///m/x.flac"]);
  });
});
