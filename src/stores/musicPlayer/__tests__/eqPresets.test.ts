import { describe, it, expect } from "vitest";
import { EQ_FREQS, EQ_PRESETS } from "../audioEngine";

describe("EQ presets", () => {
  it("gives every preset one gain per band, within a sane range", () => {
    for (const gains of Object.values(EQ_PRESETS)) {
      expect(gains).toHaveLength(EQ_FREQS.length);
      for (const g of gains) expect(Math.abs(g)).toBeLessThanOrEqual(12);
    }
  });

  it("keeps flat silent", () => {
    expect(EQ_PRESETS.flat.every((g) => g === 0)).toBe(true);
  });
});
