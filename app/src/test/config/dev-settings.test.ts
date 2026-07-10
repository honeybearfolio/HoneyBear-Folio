import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getDevSetting", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../utils/version");
  });

  it("returns undefined in release builds", async () => {
    vi.doMock("../../utils/version", () => ({
      IS_RELEASE: true,
    }));

    const { getDevSetting } = await import("../../config/dev-settings");
    expect(getDevSetting("FORCE_WELCOME_SCREEN")).toBeUndefined();
  });

  it("returns configured values in development builds", async () => {
    vi.doMock("../../utils/version", () => ({
      IS_RELEASE: false,
    }));

    const { getDevSetting } = await import("../../config/dev-settings");
    expect(getDevSetting("FORCE_HIDE_UPDATE_POPUP")).toBe(true);
    expect(getDevSetting("FORCE_WELCOME_SCREEN")).toBe(false);
  });
});
