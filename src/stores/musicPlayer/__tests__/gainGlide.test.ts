// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGainGlider } from "../gainGlide";

describe("createGainGlider (004-boost-slider-debounce US1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("T003 applies a single isolated request synchronously with zero delay", () => {
    const applied: number[] = [];
    const glider = createGainGlider((p) => applied.push(p), 150);

    glider.request(200);

    expect(applied).toEqual([200]);
    vi.advanceTimersByTime(5000);
    expect(applied).toEqual([200]);
  });

  it("T003 coalesces a 60-request burst into leading + throttled + trailing", () => {
    const applied: number[] = [];
    const glider = createGainGlider((p) => applied.push(p), 150);

    for (let i = 0; i < 60; i++) {
      glider.request(100 + i * 5);
      vi.advanceTimersByTime(1000 / 60);
    }
    // Leading apply fired synchronously for the first request.
    expect(applied[0]).toBe(100);
    const duringBurst = applied.length;

    vi.advanceTimersByTime(1000);
    // Throttled intermediates + exactly one trailing apply of the final value.
    expect(applied.length).toBeLessThanOrEqual(1 + 8 + 1);
    expect(applied).toContain(100);
    expect(applied[applied.length - 1]).toBe(100 + 59 * 5);
    expect(duringBurst).toBeGreaterThanOrEqual(1);
  });

  it("T004 trailing flush carries the exact final value shortly after release", () => {
    const applied: number[] = [];
    const glider = createGainGlider((p) => applied.push(p), 150);

    glider.request(150);
    vi.advanceTimersByTime(50);
    glider.request(300);
    expect(applied).toEqual([150]);

    vi.advanceTimersByTime(150);
    expect(applied).toEqual([150, 300]);
  });

  it("T004 intermediate applies always carry a recent requested value", () => {
    const applied: number[] = [];
    const glider = createGainGlider((p) => applied.push(p), 150);

    glider.request(100);
    vi.advanceTimersByTime(100);
    glider.request(200);
    vi.advanceTimersByTime(100);
    glider.request(400);
    vi.advanceTimersByTime(1000);

    // Leading 100, throttled latest (400), trailing final (400).
    expect(applied[0]).toBe(100);
    expect(applied[applied.length - 1]).toBe(400);
    expect(applied.every((p) => [100, 200, 400].includes(p))).toBe(true);
  });

  it("cancel() drops pending without applying", () => {
    const applied: number[] = [];
    const glider = createGainGlider((p) => applied.push(p), 150);

    glider.request(120);
    vi.advanceTimersByTime(50);
    glider.request(350);
    glider.cancel();
    vi.advanceTimersByTime(5000);

    expect(applied).toEqual([120]);
  });
});
