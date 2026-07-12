import React from "react";
import { screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FireCalculator from "../../../features/fire/FireCalculator";
import { invoke } from "@tauri-apps/api/core";
import {
  mockTauri,
  renderWithStores,
} from "../../helpers/render";

// Mock dependencies
vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="fire-chart">Chart</div>,
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}));

vi.mock("../../../hooks/useIsDark", () => ({
  default: () => false,
}));

vi.mock("../../../i18n/i18n", () => ({
  t: (
    key: string,
    params?: { age?: string | number; count?: string | number },
  ) => {
    const map: Record<string, string> = {
      "dashboard.current_net_worth": "Current Net Worth",
      "fire.annual_expenses": "Annual Expenses",
      "fire.expected_return": "Expected Annual Return",
      "fire.withdrawal_rate": "Safe Withdrawal Rate",
      "fire.annual_savings": "Annual Savings",
      "fire.fire_number": "FIRE Number",
      "fire.time_to_fire": "Time to FIRE",
      "fire.years_to_fire": "Years to FIRE",
      "fire.age_at_fire": "Age at FIRE",
      "fire.parameters": "Parameters",
      "fire.reset": "Reset",
      "fire.reset_tooltip": "Reset to defaults",
      "fire.inflation": "Inflation Rate",
      "fire.age_timeline": "Age & Timeline",
      "fire.current_age": "Current Age",
      "fire.target_retirement_age": "Target Retirement Age",
      "fire.retirement_duration": "Retirement Duration",
      "fire.years": "years",
      "fire.show_advanced": "Show advanced parameters",
      "fire.hide_advanced": "Hide advanced parameters",
      "fire.advanced_description": "Monte Carlo simulation parameters",
      "fire.return_volatility": "Return Volatility (Std Dev)",
      "fire.volatility_hint": "Typical: 15-20% for stocks",
      "fire.simulation_count": "Simulation Count",
      "fire.simulation_count_hint": "100-10,000 simulations",
      "fire.retirement_age": "Retirement Age",
      "fire.age_value": `Age ${String(params?.age ?? "")}`,
      "fire.success_rate": "Success Rate",
      "fire.monte_carlo": "Monte Carlo",
      "fire.projection": "Projection",
      "fire.projection_subtitle": "Path to financial independence",
      "fire.simulations_run": `${String(params?.count ?? "")} simulations`,
      "fire.chart_legend_explanation": "Chart explanation",
      "fire.never_retire": "Unlikely to reach FIRE",
    };
    return map[key] || key;
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("../../../utils/investments", () => ({
  buildHoldingsFromTransactions: () =>
    Promise.resolve({
      currentHoldings: [],
      firstTradeDate: "2020-01-01",
    }),
  mergeHoldingsWithQuotes: () => Promise.resolve([]),
  computePortfolioTotals: () => Promise.resolve({ totalValue: 50000 }),
  computeNetWorthMarketValues: () => Promise.resolve({}),
}));

vi.mock("../../../utils/fire", () => ({
  runMonteCarloSimulation: () => ({
    successRate: 85,
    percentiles: {
      p10: Array(51).fill(100000),
      p25: Array(51).fill(200000),
      p50: Array(51).fill(500000),
      p75: Array(51).fill(800000),
      p90: Array(51).fill(1200000),
    },
    yearsToRetirement: 25,
    totalYears: 55,
    simulationCount: 1000,
  }),
  calculateDeterministicProjection: ({
    annualExpenses,
    withdrawalRate,
  }: {
    annualExpenses: number;
    withdrawalRate: number;
  }) => ({
    fireNumber: annualExpenses / (withdrawalRate / 100),
    yearsToFire: 15,
    projectionData: Array(51)
      .fill(0)
      .map((_, i) => 50000 + i * 30000),
    neverReached: false,
  }),
}));

describe("FireCalculator", () => {
  type SavedFireState = {
    annualExpenses: number;
    currentNetWorth: number;
    userModified: { currentNetWorth: boolean };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    mockTauri((cmd: string) => {
      if (cmd === "get_accounts")
        return Promise.resolve([
          {
            id: 1,
            name: "Test Acct",
            kind: "checking",
            balance: 50000,
            currency: "USD",
          },
        ]);
      if (cmd === "get_stock_quotes") return Promise.resolve([]);
      if (cmd === "get_all_transactions") return Promise.resolve([]);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with default values and loads data", async () => {
    renderWithStores(<FireCalculator />);

    // Wait for the async fetch to complete and content to render
    await waitFor(() => {
      expect(screen.getByText("Current Net Worth")).toBeInTheDocument();
    });

    // Check for chart
    expect(screen.getByTestId("fire-chart")).toBeInTheDocument();

    // Verify the data fetch was called
    expect(invoke).toHaveBeenCalledWith("get_accounts");
  });

  it("calculates FIRE number based on expenses", async () => {
    renderWithStores(<FireCalculator />);

    // Wait for the initial data fetch to complete before interacting
    const inputs = await screen.findAllByRole("textbox");
    const expensesInput = inputs[1]!; // Annual Expenses is 2nd

    // NumberInput commits on blur, so we need the full focus → change → blur sequence
    fireEvent.focus(expensesInput);
    fireEvent.change(expensesInput, { target: { value: "50000" } });
    fireEvent.blur(expensesInput);

    await waitFor(() => {
      // Mock returns annualExpenses / (withdrawalRate / 100) = 50000 / 0.04 = $1,250,000
      expect(screen.getByText(/\$1,250,000/)).toBeInTheDocument();
    });
  });

  it("updates state from portfolio data on mount if not user modified", async () => {
    // We mocked computePortfolioTotals to return 50000
    renderWithStores(<FireCalculator />);

    const inputs = await screen.findAllByRole("textbox");
    const netWorthInput = inputs[0]!; // Current Net Worth is 1st

    await waitFor(() => {
      expect((netWorthInput as HTMLInputElement).value).toBe("50000");
    });
  });

  it("persists state to sessionStorage", async () => {
    const { unmount } = renderWithStores(<FireCalculator />);

    // Wait for initial load before interacting
    const inputs = await screen.findAllByRole("textbox");
    const expensesInput = inputs[1]!;

    await waitFor(() => {
      expect((expensesInput as HTMLInputElement).value).toBeDefined();
    });

    // NumberInput commits on blur
    fireEvent.focus(expensesInput);
    fireEvent.change(expensesInput, { target: { value: "60000" } });
    fireEvent.blur(expensesInput);

    // Wait for the useEffect to persist the updated expenses to sessionStorage
    await waitFor(() => {
      const saved = sessionStorage.getItem("fireCalculatorState");
      expect(saved).not.toBeNull();
      expect((JSON.parse(saved!) as SavedFireState).annualExpenses).toBe(60000);
    });

    unmount();

    // Re-render: should restore from sessionStorage
    renderWithStores(<FireCalculator />);
    const inputs2 = screen.getAllByRole("textbox");
    expect((inputs2[1] as HTMLInputElement).value).toBe("60000");
  });

  it("respects user modifications over fetched data", async () => {
    // 1. Render and modify Net Worth manually
    const { unmount } = renderWithStores(<FireCalculator />);
    const inputs = await screen.findAllByRole("textbox");
    const netWorthInput = inputs[0]!;

    // Wait for initial fetch (50000 from mock)
    await waitFor(() => {
      expect((netWorthInput as HTMLInputElement).value).toBe("50000");
    });

    // User changes it to 75000 — NumberInput commits on blur
    fireEvent.focus(netWorthInput);
    fireEvent.change(netWorthInput, { target: { value: "75000" } });
    fireEvent.blur(netWorthInput);

    // Wait for effect to save to sessionStorage
    await waitFor(() => {
      const raw = sessionStorage.getItem("fireCalculatorState");
      expect(raw).not.toBeNull();
      const saved = JSON.parse(raw!) as SavedFireState;
      expect(saved.currentNetWorth).toBe(75000);
      expect(saved.userModified.currentNetWorth).toBe(true);
    });

    unmount();

    // 2. Re-render — fetch would return 50000, but sessionStorage has 75000 with
    //    userModified.currentNetWorth=true, so the persisted value wins.
    renderWithStores(<FireCalculator />);

    const inputs2 = await screen.findAllByRole("textbox");
    const netWorthInput2 = inputs2[0]!;

    await waitFor(() => {
      expect((netWorthInput2 as HTMLInputElement).value).toBe("75000");
    });
  });
});
