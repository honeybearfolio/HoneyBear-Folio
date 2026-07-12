import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTickerSearch } from "../../hooks/useTickerSearch";
import { rust } from "../../api/tauri-client";

vi.mock("../../api/tauri-client", () => ({
  rust: {
    search_ticker: vi.fn(),
  },
}));

describe("useTickerSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty suggestions", () => {
    const { result } = renderHook(() => useTickerSearch());
    expect(result.current.suggestions).toEqual([]);
  });

  it("clears suggestions for empty or short queries without calling API", () => {
    const { result } = renderHook(() => useTickerSearch());

    act(() => {
      result.current.searchTicker("");
    });
    expect(result.current.suggestions).toEqual([]);
    expect(rust.search_ticker).not.toHaveBeenCalled();

    act(() => {
      result.current.searchTicker("a");
    });
    expect(result.current.suggestions).toEqual([]);
    expect(rust.search_ticker).not.toHaveBeenCalled();
  });

  it("debounces search by 300ms and trims query", async () => {
    const mockResults = [{ symbol: "AAPL", shortname: "Apple Inc." }];
    vi.mocked(rust.search_ticker).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useTickerSearch());

    act(() => {
      result.current.searchTicker("  aa  ");
    });
    expect(rust.search_ticker).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(rust.search_ticker).toHaveBeenCalledWith({ query: "aa" });
    expect(result.current.suggestions).toEqual(mockResults);
  });

  it("clears pending debounce when a new query is entered", async () => {
    vi.mocked(rust.search_ticker).mockResolvedValue([]);

    const { result } = renderHook(() => useTickerSearch());

    act(() => {
      result.current.searchTicker("first");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.searchTicker("second");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(rust.search_ticker).toHaveBeenCalledTimes(1);
    expect(rust.search_ticker).toHaveBeenCalledWith({ query: "second" });
  });

  it("clearSuggestions resets state and cancels pending search", () => {
    vi.mocked(rust.search_ticker).mockResolvedValue([
      { symbol: "MSFT", shortname: "Microsoft" },
    ]);

    const { result } = renderHook(() => useTickerSearch());

    act(() => {
      result.current.searchTicker("ms");
    });
    act(() => {
      result.current.clearSuggestions();
    });
    expect(result.current.suggestions).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(rust.search_ticker).not.toHaveBeenCalled();
  });
});
