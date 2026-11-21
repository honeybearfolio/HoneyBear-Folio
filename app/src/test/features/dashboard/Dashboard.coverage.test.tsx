import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Dashboard from "../../../features/dashboard/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNumberFormatStore } from "../../../stores/number-format";
import { useDashboardPreferencesStore } from "../../../stores/dashboard-preferences";
import { dropLedgerRead } from "../../../api/tauri-client";
import { usePortfolioPreferences } from "../../../stores/portfolio-preferences";

const emptyHoldings = { currentHoldings: [], firstTradeDate: null };

const sampleAccounts = [
  { id: 1, name: "Checking", balance: 1000, currency: "USD" },
  { id: 2, name: "Savings", balance: 5000, currency: "USD" },
];

function recentDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function futureDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultDashboardResult(cmd: string) {
  if (
    cmd === "get_goals" ||
    cmd === "get_pending_occurrences" ||
    cmd === "get_all_transactions"
  ) {
    return Promise.resolve([]);
  }
  if (cmd === "get_account_holdings") return Promise.resolve({});
  return Promise.resolve(null);
}

const sampleTransactions = [
  {
    id: 1,
    date: recentDate(5),
    amount: -50,
    payee: "Grocery",
    category: "Food",
    account_id: 1,
    currency: "USD",
  },
  {
    id: 2,
    date: recentDate(3),
    amount: 2000,
    payee: "Employer",
    category: "Salary",
    account_id: 2,
    currency: "USD",
  },
];

const sampleSeries = {
  dates: ["2024-06-01"],
  totals: [6000],
  accounts: [
    {
      accountId: 1,
      currency: "USD",
      native: [1000],
      converted: [1000],
    },
  ],
  incomeExpense: [{ key: "2024-06", income: 2000, expenses: 50 }],
  categories: [{ category: "Food", amount: 50 }],
  tickers: [] as string[],
  bucket: "month",
};

function mockDashboardInvoke(
  handler: (cmd: string) => Promise<unknown> | undefined,
) {
  return vi.mocked(invoke).mockImplementation((cmd: string) => {
    const result = handler(cmd);
    if (result !== undefined) return result;
    if (cmd === "get_dashboard_chart_series")
      return Promise.resolve(sampleSeries);
    if (cmd === "query_dashboard_transactions")
      return Promise.resolve(sampleTransactions);
    if (cmd === "build_holdings_from_transactions")
      return Promise.resolve(emptyHoldings);
    if (cmd === "compute_net_worth") return Promise.resolve(12500);
    return defaultDashboardResult(cmd);
  });
}

vi.mock("../../../hooks/useIsDark", () => ({ default: () => false }));

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
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
  ArcElement: {},
  BarElement: {},
}));

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number) => `fmt-${String(val)}`,
  useFormatDate: () => (_date: unknown) => "formatted-date",
  getDatePickerFormat: () => "yyyy-MM-dd",
  parseCalendarDate: (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  },
  formatCalendarDate: (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${String(date.getFullYear())}-${month}-${day}`;
  },
}));

vi.mock("../../../features/dashboard/SankeyDiagram", () => ({
  default: () => <div data-testid="sankey">Sankey Diagram</div>,
}));

vi.mock("react-datepicker", () => ({
  default: (props: {
    selected?: Date;
    onChange: (date: Date | null) => void;
    "aria-label"?: string;
  }) => (
    <input
      data-testid="datepicker"
      aria-label={props["aria-label"]}
      value={props.selected ? props.selected.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        props.onChange(new Date(e.target.value));
      }}
    />
  ),
}));

describe("Dashboard coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropLedgerRead();
    useNumberFormatStore.setState({
      dateFormat: "MM/dd/yyyy",
      firstDayOfWeek: 0,
      currency: "USD",
      locale: "en-US",
    });
    localStorage.clear();
    useDashboardPreferencesStore.getState().resetAll();
  });

  it("shows loading skeleton while data is fetching", () => {
    mockDashboardInvoke(() => new Promise(() => {}));

    const { container } = render(<Dashboard accounts={sampleAccounts} />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Current Net Worth")).not.toBeInTheDocument();
  });

  it("displays computed net worth in summary cards", async () => {
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(
      <Dashboard
        accounts={sampleAccounts}
        totalAssetsValue={500}
        totalLiabilitiesValue={200}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Current Net Worth")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "compute_net_worth",
        expect.objectContaining({
          accounts: sampleAccounts,
          totalAssetsValue: 500,
          totalLiabilitiesValue: 200,
        }),
      );
    });

    await waitFor(() => {
      const netWorthCard = screen
        .getByText("Current Net Worth")
        .closest(".summary-card");
      expect(netWorthCard?.textContent).toContain("fmt-12500");
    });
  });

  it("shows budget health, goal progress, and scheduled items", async () => {
    usePortfolioPreferences.setState({
      values: {
        hb_budget_limits: JSON.stringify({
          currency: "USD",
          limits: { Food: 25 },
        }),
      },
    });
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve(sampleSeries);
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
      if (cmd === "get_goals") {
        return Promise.resolve([
          {
            id: 7,
            name: "Emergency Fund",
            target_amount: 2000,
            target_date: null,
            monthly_contribution: null,
            created_at: recentDate(100),
            archived: false,
            exchange_rate: 1,
            links: [
              {
                id: 1,
                goal_id: 7,
                source_type: "account",
                account_id: 1,
                allocation_percent: 100,
              },
            ],
          },
        ]);
      }
      if (cmd === "get_account_holdings") return Promise.resolve({});
      if (cmd === "get_pending_occurrences") {
        return Promise.resolve([
          {
            scheduled_tx_id: 11,
            date: futureDate(3),
            payee: "Rent",
            amount: -800,
            account_name: "Checking",
            status: "upcoming",
          },
        ]);
      }
      if (cmd === "compute_net_worth") return Promise.resolve(6000);
      return defaultDashboardResult(cmd);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    expect(
      await screen.findByText("fmt-50 spent of fmt-25"),
    ).toBeInTheDocument();
    expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Food: over by fmt-25")).toBeInTheDocument();
  });

  it("selects YTD time range", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    const ytdBtn = screen.getByRole("button", { name: "YTD" });
    await user.click(ytdBtn);

    expect(ytdBtn.className).toContain("time-range-button-active");
  });

  it("selects ALL time range", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    const allBtn = screen.getByRole("button", { name: "ALL" });
    await user.click(allBtn);

    expect(allBtn.className).toContain("time-range-button-active");
  });

  it("shows error state and retries fetch on button click", async () => {
    let callCount = 0;
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series") {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("Network down"));
        }
        return Promise.resolve(sampleSeries);
      }
      if (cmd === "query_dashboard_transactions")
        return Promise.resolve(sampleTransactions);
      if (cmd === "build_holdings_from_transactions")
        return Promise.resolve(emptyHoldings);
      if (cmd === "compute_net_worth") return Promise.resolve(6000);
      return defaultDashboardResult(cmd);
    });

    const user = userEvent.setup();
    render(<Dashboard accounts={sampleAccounts} />);

    expect(
      await screen.findByText("Failed to load data. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByText("Network down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  it("fetches accounts when none are passed as props", async () => {
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
      if (cmd === "get_accounts") return Promise.resolve(sampleAccounts);
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_accounts");
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  it("selects 1M time range preset", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} marketValues={{ 1: 500 }} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    const oneMonthBtn = screen.getByRole("button", { name: "1M" });
    await user.click(oneMonthBtn);

    expect(oneMonthBtn.className).toContain("time-range-button-active");
  });

  it("fetches stock quotes when transactions include tickers", async () => {
    const investmentTx = {
      ...sampleTransactions[0],
      ticker: "AAPL",
      shares: 5,
      price_per_share: 100,
    };

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve({ ...sampleSeries, tickers: ["AAPL"] });
      if (cmd === "query_dashboard_transactions")
        return Promise.resolve([investmentTx]);
      if (cmd === "build_holdings_from_transactions") {
        return Promise.resolve({
          currentHoldings: [{ ticker: "AAPL", shares: 5, costBasis: 500 }],
          firstTradeDate: recentDate(30),
        });
      }
      if (cmd === "get_stock_quotes") {
        return Promise.resolve([
          { ticker: "AAPL", price: 150, currency: "USD" },
        ]);
      }
      if (cmd === "compute_net_worth") return Promise.resolve(7000);
      return defaultDashboardResult(cmd);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_stock_quotes",
        expect.objectContaining({ tickers: ["AAPL"] }),
      );
    });
  });

  it("selects 6M time range preset", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    const sixMonthBtn = screen.getByRole("button", { name: "6M" });
    await user.click(sixMonthBtn);

    expect(sixMonthBtn.className).toContain("time-range-button-active");
  });

  it("fetches daily prices for foreign-currency accounts", async () => {
    const eurAccounts = [
      { id: 1, name: "EUR Checking", balance: 1000, currency: "EUR" },
    ];

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve(sampleSeries);
      if (cmd === "query_dashboard_transactions")
        return Promise.resolve(sampleTransactions);
      if (cmd === "update_daily_stock_prices") return Promise.resolve(null);
      if (cmd === "get_daily_stock_prices") return Promise.resolve([]);
      if (cmd === "build_holdings_from_transactions")
        return Promise.resolve(emptyHoldings);
      if (cmd === "compute_net_worth") return Promise.resolve(1000);
      return defaultDashboardResult(cmd);
    });

    render(<Dashboard accounts={eurAccounts} />);

    await waitFor(() => {
      const pricesCall = vi
        .mocked(invoke)
        .mock.calls.find(([cmd]) => cmd === "update_daily_stock_prices");
      const pricesArgs = pricesCall![1] as { tickers?: string[] };
      expect(pricesArgs.tickers).toContain("EURUSD=X");
    });
  });

  it("paints cash charts and account totals before daily prices return", async () => {
    const user = userEvent.setup();
    let releasePrices: (value: unknown) => void = () => {};
    const prices = new Promise((resolve) => {
      releasePrices = resolve;
    });
    const eurAccounts = [
      { id: 1, name: "EUR Checking", balance: 1000, currency: "EUR" },
    ];

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve(sampleSeries);
      if (cmd === "get_daily_stock_prices") return prices;
      if (cmd === "update_daily_stock_prices") return Promise.resolve(null);
      if (cmd === "compute_net_worth") return Promise.resolve(1000);
      return defaultDashboardResult(cmd);
    });

    render(<Dashboard accounts={eurAccounts} />);

    expect(await screen.findByTestId("line-chart")).toBeInTheDocument();
    expect(await screen.findByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByText("Total Accounts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accounts" }));
    expect(screen.getByText("EUR Checking")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith(
      "update_daily_stock_prices",
      expect.anything(),
    );

    releasePrices([]);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "update_daily_stock_prices",
        expect.objectContaining({ tickers: ["EURUSD=X"] }),
      );
    });
  });

  it("reads every ticker's stored history at the same time", async () => {
    let releaseReads = false;
    const pending: Array<(value: unknown) => void> = [];
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve({
          ...sampleSeries,
          tickers: ["AAPL", "MSFT"],
        });
      if (cmd === "get_daily_stock_prices") {
        if (releaseReads) return Promise.resolve([]);
        return new Promise((resolve) => {
          pending.push(resolve);
        });
      }
      if (cmd === "update_daily_stock_prices") return Promise.resolve(null);
      if (cmd === "get_stock_quotes") return Promise.resolve([]);
      if (cmd === "compute_net_worth") return Promise.resolve(1000);
      return defaultDashboardResult(cmd);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => {
      const reads = vi
        .mocked(invoke)
        .mock.calls.filter(([cmd]) => cmd === "get_daily_stock_prices");
      expect(
        reads.map(([, args]) => (args as { ticker: string }).ticker),
      ).toEqual(expect.arrayContaining(["AAPL", "MSFT"]));
    });
    expect(pending.length).toBeGreaterThanOrEqual(2);

    releaseReads = true;
    for (const resolve of pending) resolve([]);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "update_daily_stock_prices",
        expect.objectContaining({ tickers: ["AAPL", "MSFT"] }),
      );
    });
  });

  it("skips the daily price update when stored history is already from today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve({ ...sampleSeries, tickers: ["AAPL", "MSFT"] });
      if (cmd === "get_daily_stock_prices") {
        const ticker = (args as { ticker?: string } | undefined)?.ticker;
        if (ticker === "AAPL")
          return Promise.resolve([{ date: today, price: 10 }]);
        return Promise.resolve([]);
      }
      if (cmd === "update_daily_stock_prices") return Promise.resolve(null);
      if (cmd === "get_stock_quotes") return Promise.resolve([]);
      if (cmd === "compute_net_worth") return Promise.resolve(1000);
      return defaultDashboardResult(cmd);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_daily_stock_prices", {
        tickers: ["MSFT"],
      });
    });
    expect(invoke).not.toHaveBeenCalledWith("update_daily_stock_prices", {
      tickers: ["AAPL", "MSFT"],
    });
  });

  it("does not update daily prices when every ticker is already fresh", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_dashboard_chart_series")
        return Promise.resolve({ ...sampleSeries, tickers: ["AAPL"] });
      if (cmd === "get_daily_stock_prices")
        return Promise.resolve([{ date: today, price: 10 }]);
      if (cmd === "update_daily_stock_prices") return Promise.resolve(null);
      if (cmd === "get_stock_quotes") return Promise.resolve([]);
      if (cmd === "compute_net_worth") return Promise.resolve(1000);
      return Promise.resolve(null);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await screen.findByTestId("line-chart");
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_daily_stock_prices",
        expect.objectContaining({ ticker: "AAPL" }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
    expect(invoke).not.toHaveBeenCalledWith(
      "update_daily_stock_prices",
      expect.anything(),
    );
  });
});
