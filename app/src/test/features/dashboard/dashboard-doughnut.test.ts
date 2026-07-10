import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDoughnutChartData } from "../../../features/dashboard/dashboard-doughnut";
import { buildHoldingsFromTransactions } from "../../../utils/investments";
import i18n from "../../../i18n/i18n";
import type { Account } from "../../../api/types";
import type {
  Quote,
  Transaction,
} from "../../../features/dashboard/dashboard-types";

vi.mock("../../../utils/investments", () => ({
  buildHoldingsFromTransactions: vi.fn(),
}));

const t = i18n.t.bind(i18n);
const chartColors = { palette: ["rgb(59, 130, 246)", "rgb(16, 185, 129)"] };

const baseArgs = {
  filteredTransactions: [] as Transaction[],
  quotes: [] as Quote[],
  dailyPrices: {},
  isDark: false,
  chartColors,
  t,
};

describe("buildDoughnutChartData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildHoldingsFromTransactions).mockResolvedValue({
      currentHoldings: [],
      firstTradeDate: null,
    });
  });

  it("returns null when filtered accounts is empty", async () => {
    const result = await buildDoughnutChartData({
      ...baseArgs,
      filteredAccounts: [],
    });

    expect(result).toBeNull();
    expect(buildHoldingsFromTransactions).not.toHaveBeenCalled();
  });

  it("aggregates cash account balance", async () => {
    const accounts: Account[] = [
      { id: 1, name: "Checking", balance: 5000, kind: "cash", currency: "USD" },
    ];

    const result = await buildDoughnutChartData({
      ...baseArgs,
      filteredAccounts: accounts,
    });

    expect(result).not.toBeNull();
    expect(result!.labels).toContain(t("dashboard.assets.cash"));
    expect(result!.datasets[0]!.data).toContain(5000);
  });

  it("aggregates brokerage holdings and cash balance", async () => {
    const accounts: Account[] = [
      {
        id: 2,
        name: "Brokerage",
        balance: 1000,
        kind: "brokerage",
        currency: "USD",
      },
    ];
    const transactions: Transaction[] = [
      {
        id: 1,
        account_id: 2,
        date: "2024-01-01",
        amount: -1500,
        ticker: "AAPL",
        shares: 10,
      },
    ];
    const quotes: Quote[] = [
      {
        ticker: "AAPL",
        symbol: "AAPL",
        price: 150,
        regularMarketPrice: 150,
        quoteType: "EQUITY",
      },
    ];

    vi.mocked(buildHoldingsFromTransactions).mockResolvedValue({
      currentHoldings: [{ ticker: "AAPL", shares: 10 }],
      firstTradeDate: "2024-01-01",
    });

    const result = await buildDoughnutChartData({
      ...baseArgs,
      filteredAccounts: accounts,
      filteredTransactions: transactions,
      quotes,
    });

    expect(result).not.toBeNull();
    expect(result!.labels).toContain(t("dashboard.assets.stock"));
    expect(result!.labels).toContain(t("dashboard.assets.cash"));
    const stockIdx = result!.labels.indexOf(t("dashboard.assets.stock"));
    const cashIdx = result!.labels.indexOf(t("dashboard.assets.cash"));
    expect(result!.datasets[0]!.data[stockIdx]).toBe(1500);
    expect(result!.datasets[0]!.data[cashIdx]).toBe(1000);
  });

  it("maps quote types to translated asset labels", async () => {
    const accounts: Account[] = [
      {
        id: 3,
        name: "Investments",
        balance: 0,
        kind: "brokerage",
        currency: "USD",
      },
    ];

    vi.mocked(buildHoldingsFromTransactions).mockResolvedValue({
      currentHoldings: [
        { ticker: "AAPL", shares: 1 },
        { ticker: "SPY", shares: 1 },
        { ticker: "BTC-USD", shares: 1 },
        { ticker: "VFIAX", shares: 1 },
        { ticker: "ES=F", shares: 1 },
        { ticker: "^GSPC", shares: 1 },
        { ticker: "GC=F", shares: 1 },
      ],
      firstTradeDate: "2024-01-01",
    });

    const quotes: Quote[] = [
      {
        ticker: "AAPL",
        symbol: "AAPL",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "EQUITY",
      },
      {
        ticker: "SPY",
        symbol: "SPY",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "ETF",
      },
      {
        ticker: "BTC-USD",
        symbol: "BTC-USD",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "CRYPTOCURRENCY",
      },
      {
        ticker: "VFIAX",
        symbol: "VFIAX",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "MUTUALFUND",
      },
      {
        ticker: "ES=F",
        symbol: "ES=F",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "FUTURE",
      },
      {
        ticker: "^GSPC",
        symbol: "^GSPC",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "INDEX",
      },
      {
        ticker: "GC=F",
        symbol: "GC=F",
        price: 100,
        regularMarketPrice: 100,
        quoteType: "COMMODITY",
      },
    ];

    const result = await buildDoughnutChartData({
      ...baseArgs,
      filteredAccounts: accounts,
      quotes,
    });

    expect(result).not.toBeNull();
    expect(result!.labels).toContain(t("dashboard.assets.stock"));
    expect(result!.labels).toContain(t("dashboard.assets.etf"));
    expect(result!.labels).toContain(t("dashboard.assets.crypto"));
    expect(result!.labels).toContain(t("dashboard.assets.mutual_fund"));
    expect(result!.labels).toContain(t("dashboard.assets.future"));
    expect(result!.labels).toContain(t("dashboard.assets.index"));
    expect(result!.labels).toContain(t("dashboard.assets.commodities"));
  });
});
