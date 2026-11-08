import { describe, expect, it } from "vitest";
import {
  GOAL_COLORS,
  goalColorClasses,
} from "../../../features/goals/goal-colors";

describe("goalColorClasses", () => {
  it("returns a swatch for every palette color and a brand fallback", () => {
    for (const color of GOAL_COLORS) {
      const swatch = goalColorClasses(color).swatch;
      expect(swatch).toContain(color === "brand" ? "brand" : color);
    }
    expect(goalColorClasses("unknown")).toEqual(goalColorClasses("brand"));
  });
});
