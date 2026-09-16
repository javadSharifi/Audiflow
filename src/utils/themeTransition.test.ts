// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetThemeTransitionForTests,
  computeRevealRadius,
  revealOrigin,
  revealThemeChange,
} from "./themeTransition";

const docRecord = () => document as unknown as Record<string, unknown>;

function clearStarter(): void {
  delete docRecord().startViewTransition;
  document.documentElement.style.removeProperty("--reveal-x");
  document.documentElement.style.removeProperty("--reveal-y");
  document.documentElement.style.removeProperty("--reveal-r");
}

beforeEach(() => {
  __resetThemeTransitionForTests();
  clearStarter();
  vi.restoreAllMocks();
});

describe("computeRevealRadius", () => {
  it("covers the viewport from a corner", () => {
    expect(computeRevealRadius(0, 0, 100, 100)).toBeCloseTo(Math.hypot(100, 100));
  });

  it("is the farthest-corner distance from an interior point", () => {
    expect(computeRevealRadius(25, 25, 100, 100)).toBeCloseTo(Math.hypot(75, 75));
  });
});

describe("revealOrigin", () => {
  it("uses the exact click point for pointer activation", () => {
    expect(
      revealOrigin({ clientX: 120, clientY: 30, currentTarget: null }),
    ).toEqual({ x: 120, y: 30 });
  });

  it("falls back to the invoker center for keyboard activation", () => {
    const el = document.createElement("button");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      width: 40,
      height: 44,
      right: 50,
      bottom: 64,
      x: 10,
      y: 20,
      toJSON: () => {},
    });
    expect(revealOrigin({ clientX: 0, clientY: 0, currentTarget: el })).toEqual({
      x: 30,
      y: 42,
    });
  });
});

describe("revealThemeChange", () => {
  it("applies instantly when the API is unavailable (fallback)", () => {
    const apply = vi.fn();
    revealThemeChange(5, 5, apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.getPropertyValue("--reveal-x")).toBe("");
  });

  it("sets reveal vars and applies inside the transition", () => {
    const callbacks: Array<() => void> = [];
    docRecord().startViewTransition = vi.fn((cb: () => void) => {
      callbacks.push(cb);
      return { finished: Promise.resolve() };
    });
    const apply = vi.fn();
    revealThemeChange(10, 20, apply);
    expect(docRecord().startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.getPropertyValue("--reveal-x")).toBe("10px");
    expect(document.documentElement.style.getPropertyValue("--reveal-y")).toBe("20px");
    expect(document.documentElement.style.getPropertyValue("--reveal-r")).toMatch(/px$/);
    expect(apply).not.toHaveBeenCalled();
    callbacks[0]?.();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("never queues: a running transition forces instant apply", () => {
    let resolveFinished!: () => void;
    docRecord().startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return {
        finished: new Promise<void>((resolve) => {
          resolveFinished = resolve;
        }),
      };
    });
    const first = vi.fn();
    const second = vi.fn();
    revealThemeChange(1, 1, first);
    revealThemeChange(2, 2, second);
    expect(docRecord().startViewTransition).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    resolveFinished();
  });

  it("applies instantly when the transition starter throws", () => {
    docRecord().startViewTransition = vi.fn(() => {
      throw new Error("transition failed");
    });
    const apply = vi.fn();
    revealThemeChange(1, 1, apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("clears the guard after finish so later toggles animate again", async () => {
    docRecord().startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    revealThemeChange(1, 1, vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));
    revealThemeChange(2, 2, vi.fn());
    expect(docRecord().startViewTransition).toHaveBeenCalledTimes(2);
  });
});
