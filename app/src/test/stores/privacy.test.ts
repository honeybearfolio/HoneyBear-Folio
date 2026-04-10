import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePrivacyStore } from "../../stores/privacy";

describe("usePrivacyStore", () => {
  beforeEach(() => {
    usePrivacyStore.setState({ isPrivacyMode: false });
    vi.spyOn(Storage.prototype, "setItem");
  });

  it("has isPrivacyMode defaulting to false", () => {
    expect(usePrivacyStore.getState().isPrivacyMode).toBe(false);
  });

  it("togglePrivacyMode switches false → true", () => {
    usePrivacyStore.getState().togglePrivacyMode();
    expect(usePrivacyStore.getState().isPrivacyMode).toBe(true);
  });

  it("togglePrivacyMode switches true → false", () => {
    usePrivacyStore.setState({ isPrivacyMode: true });
    usePrivacyStore.getState().togglePrivacyMode();
    expect(usePrivacyStore.getState().isPrivacyMode).toBe(false);
  });

  it("togglePrivacyMode persists to localStorage", () => {
    usePrivacyStore.getState().togglePrivacyMode();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "hb_privacy_mode",
      "true",
    );
  });

  it("persists false when toggling off", () => {
    usePrivacyStore.setState({ isPrivacyMode: true });
    usePrivacyStore.getState().togglePrivacyMode();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "hb_privacy_mode",
      "false",
    );
  });

  it("exposes a togglePrivacyMode action", () => {
    expect(typeof usePrivacyStore.getState().togglePrivacyMode).toBe(
      "function",
    );
  });
});
