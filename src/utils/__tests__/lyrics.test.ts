import { describe, it, expect } from "vitest";
import { parseLrc, activeLineIndex } from "../lyrics";

describe("parseLrc", () => {
  it("parses, sorts, expands multi-stamps and skips metadata tags", () => {
    const lines = parseLrc("[ar:Band]\n[00:05.50]second\n[00:01.00][00:10]chorus\n");
    expect(lines).toEqual([
      { time: 1, text: "chorus" },
      { time: 5.5, text: "second" },
      { time: 10, text: "chorus" },
    ]);
  });

  it("applies [offset:] (positive = earlier)", () => {
    expect(parseLrc("[offset:+500]\n[00:02.00]a")[0].time).toBeCloseTo(1.5);
  });

  it("returns unsynced lines for plain lyrics", () => {
    expect(parseLrc("hello\nworld")).toEqual([
      { time: null, text: "hello" },
      { time: null, text: "world" },
    ]);
  });

  it("parses Enhanced LRC word timings", () => {
    const [line] = parseLrc("[00:01.00]<00:01.00>Hello <00:01.50>big <00:02.00>world");
    expect(line.text).toBe("Hello big world");
    expect(line.words?.map((w) => [w.time, w.text.trim()])).toEqual([
      [1, "Hello"],
      [1.5, "big"],
      [2, "world"],
    ]);
    expect(parseLrc("[00:01]plain line")[0].words).toBeUndefined();
  });

  it("finds the active line", () => {
    const lines = parseLrc("[00:01]a\n[00:03]b\n[00:06]c");
    expect([0.5, 1, 4, 99].map((t) => activeLineIndex(lines, t))).toEqual([-1, 0, 1, 2]);
    expect(activeLineIndex(parseLrc("plain"), 5)).toBe(-1);
  });
});
