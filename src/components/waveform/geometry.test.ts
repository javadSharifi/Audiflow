import { describe, expect, it } from "vitest";
import {
  clampTime,
  timeToPixel,
  pixelToTime,
  timeFromClientX,
  hitTestHandle,
  applySelectionBound,
  formatClock,
} from "./geometry";

describe("waveform/geometry", () => {
  describe("clampTime", () => {
    it("clamps time within [0, duration]", () => {
      expect(clampTime(5, 10)).toBe(5);
      expect(clampTime(-2, 10)).toBe(0);
      expect(clampTime(12, 10)).toBe(10);
      expect(clampTime(0, 10)).toBe(0);
      expect(clampTime(10, 10)).toBe(10);
    });

    it("handles zero or non-finite inputs gracefully", () => {
      expect(clampTime(5, 0)).toBe(0);
      expect(clampTime(5, -10)).toBe(0);
      expect(clampTime(NaN, 10)).toBe(0);
      expect(clampTime(Infinity, 10)).toBe(0);
    });
  });

  describe("timeToPixel and pixelToTime", () => {
    it("converts time to pixel and vice versa", () => {
      const duration = 100;
      const width = 1000;
      expect(timeToPixel(50, duration, width)).toBe(500);
      expect(pixelToTime(500, width, duration)).toBe(50);

      expect(timeToPixel(0, duration, width)).toBe(0);
      expect(pixelToTime(0, width, duration)).toBe(0);

      expect(timeToPixel(100, duration, width)).toBe(1000);
      expect(pixelToTime(1000, width, duration)).toBe(100);
    });

    it("clamps out-of-bounds pixel or time values", () => {
      expect(timeToPixel(150, 100, 1000)).toBe(1000);
      expect(timeToPixel(-10, 100, 1000)).toBe(0);
      expect(pixelToTime(1200, 1000, 100)).toBe(100);
      expect(pixelToTime(-100, 1000, 100)).toBe(0);
    });

    it("handles zero dimensions safely", () => {
      expect(timeToPixel(50, 0, 1000)).toBe(0);
      expect(timeToPixel(50, 100, 0)).toBe(0);
      expect(pixelToTime(500, 0, 100)).toBe(0);
      expect(pixelToTime(500, 1000, 0)).toBe(0);
    });
  });

  describe("timeFromClientX", () => {
    it("calculates time relative to bounding rect", () => {
      const rect = { left: 100, width: 800 };
      const duration = 80;
      // clientX = 500 -> offset = 400 -> fraction = 0.5 -> 40s
      expect(timeFromClientX(500, rect, duration)).toBe(40);
      // clientX = 100 -> offset = 0 -> 0s
      expect(timeFromClientX(100, rect, duration)).toBe(0);
      // clientX = 900 -> offset = 800 -> 80s
      expect(timeFromClientX(900, rect, duration)).toBe(80);
      // outside left
      expect(timeFromClientX(50, rect, duration)).toBe(0);
      // outside right
      expect(timeFromClientX(1000, rect, duration)).toBe(80);
    });
  });

  describe("hitTestHandle", () => {
    const rect = { left: 0, width: 1000 };
    const duration = 100;
    const selStart = 20; // 200px
    const selEnd = 80; // 800px
    const hitRadius = 24;

    it("detects start handle click within radius", () => {
      expect(hitTestHandle(200, rect, duration, selStart, selEnd, hitRadius)).toBe("start");
      expect(hitTestHandle(210, rect, duration, selStart, selEnd, hitRadius)).toBe("start");
      expect(hitTestHandle(190, rect, duration, selStart, selEnd, hitRadius)).toBe("start");
    });

    it("detects end handle click within radius", () => {
      expect(hitTestHandle(800, rect, duration, selStart, selEnd, hitRadius)).toBe("end");
      expect(hitTestHandle(810, rect, duration, selStart, selEnd, hitRadius)).toBe("end");
      expect(hitTestHandle(790, rect, duration, selStart, selEnd, hitRadius)).toBe("end");
    });

    it("returns null when click is outside hit radius of both handles", () => {
      expect(hitTestHandle(500, rect, duration, selStart, selEnd, hitRadius)).toBe(null);
      expect(hitTestHandle(150, rect, duration, selStart, selEnd, hitRadius)).toBe(null);
      expect(hitTestHandle(850, rect, duration, selStart, selEnd, hitRadius)).toBe(null);
    });

    it("prioritizes closer handle when handles are close together", () => {
      // Start at 49s (490px), End at 51s (510px). Distance = 20px < 2 * 24px
      const closeStart = 49;
      const closeEnd = 51;
      expect(hitTestHandle(492, rect, duration, closeStart, closeEnd, hitRadius)).toBe("start");
      expect(hitTestHandle(508, rect, duration, closeStart, closeEnd, hitRadius)).toBe("end");
    });

    it("returns null if rect width or duration is invalid", () => {
      expect(hitTestHandle(200, { left: 0, width: 0 }, duration, selStart, selEnd, hitRadius)).toBe(null);
      expect(hitTestHandle(200, rect, 0, selStart, selEnd, hitRadius)).toBe(null);
    });
  });

  describe("applySelectionBound", () => {
    const duration = 100;

    it("adjusts start bound while respecting end - minDistance", () => {
      const res1 = applySelectionBound("start", 30, 10, 80, duration, 0.5);
      expect(res1).toEqual({ start: 30, end: 80 });

      // Trying to push start past end - minDistance (80 - 0.5 = 79.5)
      const res2 = applySelectionBound("start", 85, 10, 80, duration, 0.5);
      expect(res2).toEqual({ start: 79.5, end: 80 });

      // Negative clamp
      const res3 = applySelectionBound("start", -5, 10, 80, duration, 0.5);
      expect(res3).toEqual({ start: 0, end: 80 });
    });

    it("adjusts end bound while respecting start + minDistance", () => {
      const res1 = applySelectionBound("end", 60, 20, 90, duration, 0.5);
      expect(res1).toEqual({ start: 20, end: 60 });

      // Trying to pull end below start + minDistance (20 + 0.5 = 20.5)
      const res2 = applySelectionBound("end", 15, 20, 90, duration, 0.5);
      expect(res2).toEqual({ start: 20, end: 20.5 });

      // Past duration clamp
      const res3 = applySelectionBound("end", 120, 20, 90, duration, 0.5);
      expect(res3).toEqual({ start: 20, end: 100 });
    });
  });

  describe("formatClock", () => {
    it("formats seconds as mm:ss", () => {
      expect(formatClock(0)).toBe("00:00");
      expect(formatClock(9)).toBe("00:09");
      expect(formatClock(65)).toBe("01:05");
      expect(formatClock(600)).toBe("10:00");
      expect(formatClock(3599)).toBe("59:59");
    });

    it("handles negative or non-finite inputs", () => {
      expect(formatClock(-1)).toBe("00:00");
      expect(formatClock(NaN)).toBe("00:00");
      expect(formatClock(Infinity)).toBe("00:00");
    });
  });
});
