import { describe, it, expect } from "vitest";
import { en } from "../en";
import { fa } from "../fa";

describe("i18n Dictionary Parity", () => {
  it("en and fa dictionaries have matching keys", () => {
    const enKeys = Object.keys(en).sort();
    const faKeys = Object.keys(fa).sort();

    const missingInFa = enKeys.filter((k) => !(k in fa));
    const missingInEn = faKeys.filter((k) => !(k in en));

    expect(missingInFa).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("every dictionary entry is a string", () => {
    for (const [key, val] of Object.entries(en)) {
      expect(typeof val, `en key ${key} should be string`).toBe("string");
    }

    for (const [key, val] of Object.entries(fa)) {
      expect(typeof val, `fa key ${key} should be string`).toBe("string");
    }
  });
});
