import type { TFunction } from "i18next";
import type { Account } from "../../api/types";
import { buildHoldingsFromTransactions } from "../../utils/investments";
import type {
  DailyPriceData,
  Quote,
  Transaction,
} from "./dashboard-types";

export interface DoughnutChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
    originalData: number[];
    backgroundColor: string[];
    borderColor: string;
    borderWidth: number;
    borderDash: (ctx: { dataIndex: number }) => number[];
    hoverOffset: number;
  }>;
}

interface BuildDoughnutChartDataArgs {
  filteredAccounts: Account[];
  filteredTransactions: Transaction[];
  quotes: Quote[];
  dailyPrices: Record<string, DailyPriceData>;
  isDark: boolean;
  chartColors: { palette: string[] };
  t: TFunction;
}

export async function buildDoughnutChartData({
  filteredAccounts,
  filteredTransactions,
  quotes,
  dailyPrices,
  isDark,
  chartColors,
  t,
}: BuildDoughnutChartDataArgs): Promise<DoughnutChartData | null> {
  if (filteredAccounts.length === 0) return null;

  const assetTypes: Record<string, number> = {};

  const getAssetType = (ticker: string) => {
    const quote = quotes.find(
      (q) => q.symbol.toLowerCase() === ticker.toLowerCase(),
    );
    if (!quote || !quote.quoteType) return t("dashboard.assets.stock");

    const type = quote.quoteType.toUpperCase();
    if (type === "EQUITY") return t("dashboard.assets.stock");
    if (type === "ETF") return t("dashboard.assets.etf");
    if (type === "CRYPTOCURRENCY") return t("dashboard.assets.crypto");
    if (type === "MUTUALFUND") return t("dashboard.assets.mutual_fund");
    if (type === "FUTURE") return t("dashboard.assets.future");
    if (type === "INDEX") return t("dashboard.assets.index");
    if (type === "COMMODITY") return t("dashboard.assets.commodities");
    return t("dashboard.assets.stock");
  };

  for (const acc of filteredAccounts) {
    let kind = acc.kind || "cash";
    let accKindLower = kind.toLowerCase();
    const exchangeRate = acc.exchange_rate || 1.0;

    const accTxs = filteredTransactions.filter((tx) => tx.account_id === acc.id);
    const { currentHoldings } = await buildHoldingsFromTransactions(accTxs);

    if (currentHoldings.length > 0) {
      accKindLower = "brokerage";
    }

    if (accKindLower === "brokerage") {
      let holdingsValue = 0;

      for (const h of currentHoldings) {
        let price = 0;
        const quote = quotes.find(
          (q) => q.symbol.toLowerCase() === h.ticker.toLowerCase(),
        );
        if (quote) {
          price = quote.regularMarketPrice;
        } else if (dailyPrices[h.ticker]) {
          const { list } = dailyPrices[h.ticker];
          if (list.length > 0) price = list[list.length - 1].price;
        }

        const val = h.shares * price * exchangeRate;
        holdingsValue += val;

        const type = getAssetType(h.ticker);
        assetTypes[type] = (assetTypes[type] || 0) + val;
      }

      const cashBalanceConverted = (acc.balance || 0) * exchangeRate;
      const cashValue = cashBalanceConverted;

      if (
        holdingsValue === 0 &&
        currentHoldings.length === 0 &&
        Math.abs(cashBalanceConverted) > 1.0
      ) {
        const translatedStock = t("dashboard.assets.stock");
        assetTypes[translatedStock] =
          (assetTypes[translatedStock] || 0) + cashBalanceConverted;
      } else if (Math.abs(cashValue) > 1.0) {
        assetTypes[t("dashboard.assets.cash")] =
          (assetTypes[t("dashboard.assets.cash")] || 0) + cashValue;
      }
    } else {
      const value = (acc.balance || 0) * exchangeRate;

      if (accKindLower === "cash") kind = t("dashboard.assets.cash");
      else kind = kind.charAt(0).toUpperCase() + kind.slice(1);

      assetTypes[kind] = (assetTypes[kind] || 0) + value;
    }
  }

  const labels = Object.keys(assetTypes);
  const rawData = Object.values(assetTypes);
  const data = rawData.map((v) => Math.abs(v));

  const colors =
    chartColors.palette.length > 0
      ? chartColors.palette
      : [
          "rgb(59, 130, 246)",
          "rgb(16, 185, 129)",
          "rgb(245, 158, 11)",
          "rgb(244, 63, 94)",
          "rgb(139, 92, 246)",
          "rgb(6, 182, 212)",
          "rgb(99, 102, 241)",
          "rgb(249, 115, 22)",
        ];

  return {
    labels,
    datasets: [
      {
        data,
        originalData: rawData,
        backgroundColor: rawData.map((v, i) => {
          if (v < 0) return "transparent";
          return colors[i % colors.length];
        }),
        borderColor: isDark ? "#474240" : "#ffffff",
        borderWidth: 4,
        borderDash: (ctx: { dataIndex: number }) => {
          const val = rawData[ctx.dataIndex];
          return val < 0 ? [5, 5] : [];
        },
        hoverOffset: 4,
      },
    ],
  };
}
