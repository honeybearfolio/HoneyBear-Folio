import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Dashboard from "../../../features/dashboard/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNumberFormatStore } from "../../../stores/number-format";

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

function mockDashboardInvoke(
  handler: (cmd: string) => Promise<unknown> | undefined,
) {
  return vi.mocked(invoke).mockImplementation((cmd: string) => {
    const result = handler(cmd);
    if (result !== undefined) return result;
    if (cmd === "build_holdings_from_transactions")
      return Promise.resolve(emptyHoldings);
    if (cmd === "compute_net_worth") return Promise.resolve(12500);
    return Promise.resolve(null);
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
    useNumberFormatStore.setState({
      dateFormat: "MM/dd/yyyy",
      firstDayOfWeek: 0,
      currency: "USD",
      locale: "en-US",
    });
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

    render(<Dashboard accounts={sampleAccounts} totalAssetsValue={500} />);

    await waitFor(() => {
      expect(screen.getByText("Current Net Worth")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "compute_net_worth",
        expect.objectContaining({
          accounts: sampleAccounts,
          totalAssetsValue: 500,
        }),
      );
    });

    const netWorthCard = screen
      .getByText("Current Net Worth")
      .closest(".summary-card");
    expect(netWorthCard?.textContent).toContain("fmt-12500");
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
      if (cmd === "get_all_transactions") {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("Network down"));
        }
        return Promise.resolve(sampleTransactions);
      }
      if (cmd === "build_holdings_from_transactions")
        return Promise.resolve(emptyHoldings);
      if (cmd === "compute_net_worth") return Promise.resolve(6000);
      return Promise.resolve(null);
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
      if (cmd === "get_all_transactions")
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
      return Promise.resolve(null);
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
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
      if (cmd === "update_daily_stock_prices") return Promise.resolve(null);
      if (cmd === "get_daily_stock_prices") return Promise.resolve([]);
      if (cmd === "build_holdings_from_transactions")
        return Promise.resolve(emptyHoldings);
      if (cmd === "compute_net_worth") return Promise.resolve(1000);
      return Promise.resolve(null);
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
});
