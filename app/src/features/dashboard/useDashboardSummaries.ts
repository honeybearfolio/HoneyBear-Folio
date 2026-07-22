import { useState, useEffect } from "react";
import type { TFunction } from "i18next";
import type { Account } from "../../api/types";
import { computeNetWorth } from "../../utils/networth";
import { logError } from "../../utils/errors";
import type { ChartColors } from "../../hooks/useChartColors";
import {
  buildDoughnutChartData,
  type DoughnutChartData,
} from "./dashboard-doughnut";
import type { DailyPriceData, Quote, Transaction } from "./dashboard-types";

interface UseDashboardSummariesArgs {
  filteredAccounts: Account[];
  filteredTransactions: Transaction[];
  filteredMarketValues: Record<string, number>;
  totalAssetsValue: number;
  totalLiabilitiesValue: number;
  quotes: Quote[];
  dailyPrices: Record<string, DailyPriceData>;
  isDark: boolean;
  chartColors: ChartColors;
  t: TFunction;
}

export function useDashboardSummaries({
  filteredAccounts,
  filteredTransactions,
  filteredMarketValues,
  totalAssetsValue,
  totalLiabilitiesValue,
  quotes,
  dailyPrices,
  isDark,
  chartColors,
  t,
}: UseDashboardSummariesArgs) {
  const [currentNetWorth, setCurrentNetWorth] = useState(0);
  const [doughnutData, setDoughnutData] = useState<DoughnutChartData | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    computeNetWorth(
      filteredAccounts,
      filteredMarketValues,
      totalAssetsValue,
      totalLiabilitiesValue,
    )
      .then((value) => {
        if (!cancelled) setCurrentNetWorth(value);
      })
      .catch((e: unknown) => {
        logError("Failed to compute net worth", e);
      });
    return () => {
      cancelled = true;
    };
  }, [
    filteredAccounts,
    filteredMarketValues,
    totalAssetsValue,
    totalLiabilitiesValue,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function computeDoughnutData() {
      if (filteredAccounts.length === 0) {
        if (!cancelled) setDoughnutData(null);
        return;
      }

      const data = await buildDoughnutChartData({
        filteredAccounts,
        filteredTransactions,
        quotes,
        dailyPrices,
        isDark,
        chartColors,
        t,
      });
      if (!cancelled) setDoughnutData(data);
    }

    computeDoughnutData().catch((e: unknown) => {
      logError("Failed to compute doughnut chart data", e);
    });

    return () => {
      cancelled = true;
    };
  }, [
    filteredAccounts,
    filteredTransactions,
    quotes,
    dailyPrices,
    isDark,
    chartColors,
    t,
  ]);

  return {
    currentNetWorth,
    doughnutData,
  };
}
