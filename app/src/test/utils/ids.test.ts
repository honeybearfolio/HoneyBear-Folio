import { describe, it, expect } from "vitest";
import { sameId } from "../../utils/ids";

describe("sameId", () => {
  it("matches numeric and string forms of the same id", () => {
    expect(sameId(1, "1")).toBe(true);
    expect(sameId("5", 5)).toBe(true);
  });

  it("does not match different ids", () => {
    expect(sameId(1, 2)).toBe(false);
    expect(sameId("1", "2")).toBe(false);
  });

  it("does not match when first id is undefined", () => {
    expect(sameId(undefined, 1)).toBe(false);
  });

  it("matches special string nav ids", () => {
    expect(sameId("all", "all")).toBe(true);
    expect(sameId("dashboard", "dashboard")).toBe(true);
  });
});
