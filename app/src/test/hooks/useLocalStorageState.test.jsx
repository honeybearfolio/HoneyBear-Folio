import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import useLocalStorageState from "../../hooks/useLocalStorageState";

describe("useLocalStorageState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the default value when storage is empty", () => {
    const { result } = renderHook(() =>
      useLocalStorageState("hb_test_key", "fallback"),
    );

    expect(result.current[0]).toBe("fallback");
  });

  it("reads existing value from localStorage", () => {
    localStorage.setItem("hb_test_key", "stored");

    const { result } = renderHook(() =>
      useLocalStorageState("hb_test_key", "fallback"),
    );

    expect(result.current[0]).toBe("stored");
  });

  it("writes updates to localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorageState("hb_test_key", "fallback"),
    );

    act(() => {
      result.current[1]("next");
    });

    expect(localStorage.getItem("hb_test_key")).toBe("next");
  });

  it("supports custom deserialize function", () => {
    localStorage.setItem("hb_day", "3");

    const { result } = renderHook(() =>
      useLocalStorageState("hb_day", 1, (value) => parseInt(value, 10)),
    );

    expect(result.current[0]).toBe(3);
  });
});
