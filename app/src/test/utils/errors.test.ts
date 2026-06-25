import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError, toUserMessage, handleAsyncError } from "../../utils/errors";

describe("toUserMessage", () => {
  it("extracts message from Error instances", () => {
    expect(toUserMessage(new Error("db locked"))).toBe("db locked");
  });

  it("returns string errors as-is", () => {
    expect(toUserMessage("network timeout")).toBe("network timeout");
  });

  it("extracts message from plain objects", () => {
    expect(toUserMessage({ message: "invalid input" })).toBe("invalid input");
  });

  it("uses fallback for unknown values", () => {
    expect(toUserMessage(null, "fallback")).toBe("fallback");
    expect(toUserMessage(42)).toBe("Unknown error");
  });

  it("trims whitespace", () => {
    expect(toUserMessage("  spaced  ")).toBe("spaced");
  });
});

describe("logError", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("logs with context prefix in dev", () => {
    logError("Failed to fetch", new Error("boom"));
    if (import.meta.env.DEV) {
      expect(consoleError).toHaveBeenCalledWith(
        "[Failed to fetch]",
        expect.any(Error),
      );
    }
  });
});

describe("handleAsyncError", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("routes i18n message to toast and detail to setError", () => {
    const toast = vi.fn();
    const setError = vi.fn();
    const err = new Error("backend detail");

    handleAsyncError({
      context: "Load failed",
      error: err,
      userMessage: "Failed to load data.",
      toast,
      setError,
    });

    expect(toast).toHaveBeenCalledWith("Failed to load data.");
    expect(setError).toHaveBeenCalledWith("backend detail");
  });

  it("uses userMessage for toast-only mutations", () => {
    const toast = vi.fn();

    handleAsyncError({
      context: "Delete failed",
      error: new Error("raw"),
      userMessage: "Failed to delete.",
      toast,
    });

    expect(toast).toHaveBeenCalledWith("Failed to delete.");
  });
});
