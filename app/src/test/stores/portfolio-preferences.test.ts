import { beforeEach, describe, expect, it, vi } from "vitest";
import { rust } from "../../api/tauri-client";
import {
  loadPortfolioPreferences,
  savePortfolioPreference,
  usePortfolioPreferences,
} from "../../stores/portfolio-preferences";
import { useNumberFormatStore } from "../../stores/number-format";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";

vi.mock("../../api/tauri-client", () => ({
  rust: {
    get_portfolio_preferences: vi.fn(),
    set_portfolio_preference: vi.fn(),
  },
}));

describe("portfolio preferences", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePortfolioPreferences.setState({ path: null, values: {} });
  });

  it("isolates files, waits for pending writes, and ignores legacy localStorage", async () => {
    const files: Record<string, Record<string, string>> = { a: {}, b: {} };
    let finishWrite: (() => void) | undefined;
    vi.mocked(rust.get_portfolio_preferences).mockImplementation(({ path }) =>
      Promise.resolve({ ...files[path] }),
    );
    vi.mocked(rust.set_portfolio_preference).mockImplementation(
      ({ path, key, value }) =>
        new Promise((resolve) => {
          finishWrite = () => {
            files[path]![key] = value;
            resolve();
          };
        }),
    );
    localStorage.setItem("hb_budget_limits", '{"Food":999}');
    await loadPortfolioPreferences("a");
    const saving = savePortfolioPreference("hb_budget_limits", "file-a");
    await Promise.resolve();
    const switching = loadPortfolioPreferences("b");
    expect(usePortfolioPreferences.getState().path).toBe("a");
    finishWrite!();
    await saving;
    await switching;
    expect(usePortfolioPreferences.getState()).toEqual({
      path: "b",
      values: {},
    });
    await loadPortfolioPreferences("a");
    expect(usePortfolioPreferences.getState().values.hb_budget_limits).toBe(
      "file-a",
    );
    expect(localStorage.getItem("hb_budget_limits")).toBe('{"Food":999}');
  });

  it("restores the previous value when a save fails", async () => {
    usePortfolioPreferences.setState({
      path: "a",
      values: { currency: "USD" },
    });

    vi.mocked(rust.set_portfolio_preference).mockRejectedValue(
      new Error("disk full"),
    );
    await expect(savePortfolioPreference("currency", "EUR")).rejects.toThrow(
      "disk full",
    );
    expect(usePortfolioPreferences.getState().values.currency).toBe("USD");
  });

  it("rolls back to the last saved value when consecutive writes fail", async () => {
    usePortfolioPreferences.setState({
      path: "a",
      values: { currency: "USD" },
    });
    vi.mocked(rust.set_portfolio_preference).mockRejectedValue(
      new Error("disk full"),
    );
    const first = savePortfolioPreference("currency", "EUR");
    const second = savePortfolioPreference("currency", "GBP");
    await Promise.allSettled([first, second]);
    expect(usePortfolioPreferences.getState().values.currency).toBe("USD");
  });

  it("hydrates file-specific currency and dashboard visibility when switching files", async () => {
    vi.mocked(rust.get_portfolio_preferences).mockImplementation(({ path }) =>
      Promise.resolve(
        path === "a"
          ? {
              hb_currency: "EUR",
              hb_dashboard_view: JSON.stringify({
                timeRange: "ALL",
                hiddenAccountIds: ["1"],
              }),
            }
          : {},
      ),
    );
    await loadPortfolioPreferences("a");
    expect(useNumberFormatStore.getState().currency).toBe("EUR");
    expect(
      useDashboardPreferencesStore.getState().view.hiddenAccountIds,
    ).toEqual(["1"]);
    await loadPortfolioPreferences("b");
    expect(useNumberFormatStore.getState().currency).toBe("USD");
    expect(
      useDashboardPreferencesStore.getState().view.hiddenAccountIds,
    ).toEqual([]);
  });
});
