import { describe, it, expect } from "vitest";
import {
  getPriceFromDailyPrices,
  createGetPrice,
  collectDailyPriceTickers,
} from "../../../features/dashboard/dashboard-prices";
import type { Account } from "../../../api/types";
import type {
  DailyPriceData,
  Transaction,
} from "../../../features/dashboard/dashboard-types";

const dailyPrices: Record<string, DailyPriceData> = {
  AAPL: {
    list: [
      { date: "2024-01-01", price: 100 },
      { date: "2024-01-03", price: 110 },
    ],
    map: { "2024-01-01": 100, "2024-01-03": 110 },
  },
};

describe("dashboard-prices", () => {
  it("getPriceFromDailyPrices returns exact date price", () => {
    expect(getPriceFromDailyPrices(dailyPrices, "AAPL", "2024-01-03")).toBe(
      110,
    );
  });

  it("getPriceFromDailyPrices returns last available price before date", () => {
    expect(getPriceFromDailyPrices(dailyPrices, "AAPL", "2024-01-02")).toBe(
      100,
    );
  });

  it("getPriceFromDailyPrices returns 0 for unknown ticker", () => {
    expect(getPriceFromDailyPrices(dailyPrices, "MSFT", "2024-01-01")).toBe(0);
  });

  it("createGetPrice returns a bound lookup function", () => {
    const getPrice = createGetPrice(dailyPrices);
    expect(getPrice("AAPL", "2024-01-03")).toBe(110);
  });

  it("collectDailyPriceTickers gathers stock and FX pair tickers", () => {
    const accounts: Account[] = [
      { id: 1, name: "EUR Account", balance: 0, currency: "EUR" },
      { id: 2, name: "USD Account", balance: 0, currency: "USD" },
    ];
    const transactions: Transaction[] = [
      {
        id: 1,
        account_id: 1,
        date: "2024-01-01",
        amount: -100,
        ticker: "AAPL",
        currency: "USD",
      },
    ];

    const tickers = collectDailyPriceTickers(transactions, accounts, "USD");

    expect(tickers.has("AAPL")).toBe(true);
    expect(tickers.has("USDUSD=X")).toBe(false);
    expect(tickers.has("USDEUR=X")).toBe(true);
    expect(tickers.has("EURUSD=X")).toBe(true);
  });
});
