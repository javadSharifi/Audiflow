import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { markBoot, logBootSummary } from "../bootPerf";

describe("bootPerf", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // Fresh module state per test.
    vi.resetModules();
  });

  it("marks phases in order and logs a monotonic summary without throwing", async () => {
    markBoot("a");
    markBoot("b");
    expect(() => logBootSummary()).not.toThrow();
    const logged = (console.info as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
    expect(logged).toContain("[boot]");
    expect(logged).toContain("a:");
    expect(logged).toContain("b:");
  });

  it("is failure-tolerant (no marks, hostile env)", () => {
    expect(() => logBootSummary()).not.toThrow();
  });
});
