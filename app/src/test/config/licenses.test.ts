import { describe, expect, it } from "vitest";
import THIRD_PARTY_LICENSES from "../../config/licenses";

describe("licenses config", () => {
  it("contains well-formed license entries", () => {
    expect(THIRD_PARTY_LICENSES.length).toBeGreaterThan(0);

    for (const entry of THIRD_PARTY_LICENSES) {
      expect(entry.name).toBeTypeOf("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.license).toBeTypeOf("string");
      expect(entry.license.length).toBeGreaterThan(0);
      expect(entry.url).toBeTypeOf("string");
      expect(entry.url.startsWith("https://")).toBe(true);
    }
  });

  it("contains unique package names", () => {
    const names = THIRD_PARTY_LICENSES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
