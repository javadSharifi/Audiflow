// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeekDebouncer } from "../seekDebounce";

describe("createSeekDebouncer (003-volume-boost-accuracy US2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("T009 applies a single isolated seek synchronously with zero delay", () => {
    const applied: number[] = [];
    const debouncer = createSeekDebouncer((t) => applied.push(t), 1000);

    debouncer.request(42);

    expect(applied).toEqual([42]);
    vi.advanceTimersByTime(5000);
    expect(applied).toEqual([42]);
  });

  it("T009 coalesces a burst of 10 requests into leading + 1 trailing apply", () => {
    const applied: number[] = [];
    const debouncer = createSeekDebouncer((t) => applied.push(t), 1000);

    for (let i = 1; i <= 10; i++) {
      debouncer.request(i * 10);
      vi.advanceTimersByTime(50);
    }
    // Leading apply fired synchronously for the first request only.
    expect(applied).toEqual([10]);

    vi.advanceTimersByTime(1000);
    expect(applied).toEqual([10, 100]);
  });

  it("T009 trailing apply lands on the final requested position", () => {
    const applied: number[] = [];
    const debouncer = createSeekDebouncer((t) => applied.push(t), 1000);

    debouncer.request(5);
    vi.advanceTimersByTime(200);
    debouncer.request(60);
    vi.advanceTimersByTime(200);
    debouncer.request(33.25);
    vi.advanceTimersByTime(1000);

    expect(applied).toEqual([5, 33.25]);
  });

  it("T009 opens a fresh window after the previous one lapses", () => {
    const applied: number[] = [];
    const debouncer = createSeekDebouncer((t) => applied.push(t), 1000);

    debouncer.request(1);
    vi.advanceTimersByTime(2000);
    expect(applied).toEqual([1]);

    debouncer.request(2);
    expect(applied).toEqual([1, 2]);
    vi.advanceTimersByTime(2000);
    expect(applied).toEqual([1, 2]);
  });

  it("T009 cancel drops a pending trailing apply", () => {
    const applied: number[] = [];
    const debouncer = createSeekDebouncer((t) => applied.push(t), 1000);

    debouncer.request(7);
    vi.advanceTimersByTime(100);
    debouncer.request(9);
    debouncer.cancel();
    vi.advanceTimersByTime(5000);

    expect(applied).toEqual([7]);
  });
});
