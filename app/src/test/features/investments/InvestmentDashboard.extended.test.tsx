import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InvestmentDashboard from "../../../features/investments/InvestmentDashboard";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../../../hooks/useIsDark", () => ({ default: () => false }));

vi.mock("../../../hooks/useChartColors", () => ({
  default: () => ({
    palette: ["#111", "#222", "#333"],
    text: "#333",
    tooltipBg: "#fff",
    tooltipText: "#000",
  }),
}));

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number, opts?: { style?: string }) =>
    opts?.style === "currency" ? `$${String(val)}` : String(val),
}));

vi.mock("../../../stores/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    currency: "USD",
    dateFormat: "YYYY-MM-DD",
    firstDayOfWeek: 1,
  }),
}));

const holdingsFixture = [
  {
    ticker: "AAPL",
    shares: 10,
    costBasis: 1000,
    price: 150,
    currentValue: 1500,
    roi: 50,
  },
  {
    ticker: "MSFT",
    shares: 5,
    costBasis: 1200,
    price: 300,
    currentValue: 1500,
    roi: 25,
  },
];

vi.mock("../../../utils/investments", () => ({
  buildHoldingsFromTransactions: (txs: unknown[]) =>
    Promise.resolve({
      currentHoldings:
        txs.length > 0
          ? holdingsFixture.map((h) => ({
              ticker: h.ticker,
              shares: h.shares,
              costBasis: h.costBasis,
            }))
          : [],
    }),
  mergeHoldingsWithQuotes: (
    holdings: { ticker: string; shares: number; costBasis: number }[],
  ) =>
    Promise.resolve(
      holdings.map((h) => {
        const match = holdingsFixture.find((f) => f.ticker === h.ticker)!;
        return { ...h, ...match };
      }),
    ),
}));

vi.mock("react-chartjs-2", () => ({
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  ArcElement: {},
  Tooltip: {},
  Legend: {},
}));

describe("InvestmentDashboard extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

    render(<InvestmentDashboard />);
    expect(screen.getByText("Loading investment data...")).toBeInTheDocument();
  });

  it("renders summary cards and holdings table when data loads", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions") return Promise.resolve([{ id: 1 }]);
      if (cmd === "get_stock_quotes") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<InvestmentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("doughnut-chart")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Portfolio Value")).toBeInTheDocument();
    expect(screen.getByText("$3000")).toBeInTheDocument();
    expect(screen.getByText("Top Performer")).toBeInTheDocument();
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
    expect(screen.getByText("Total Holdings")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Holdings")).toBeInTheDocument();
    expect(screen.getAllByText("MSFT").length).toBeGreaterThan(0);
  });

  it("renders treemap tickers for holdings", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions") return Promise.resolve([{ id: 1 }]);
      if (cmd === "get_stock_quotes") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<InvestmentDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("MSFT").length).toBeGreaterThan(0);
  });

  it("shows empty state when no holdings", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<InvestmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No investments found")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Start adding stock transactions to track your portfolio",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("doughnut-chart")).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions") {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(null);
    });

    render(<InvestmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Error loading data")).toBeInTheDocument();
    });
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("retries fetch from error state", async () => {
    let callCount = 0;
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions") {
        callCount += 1;
        if (callCount === 1) return Promise.reject(new Error("fail"));
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    render(<InvestmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Error loading data")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });
});
