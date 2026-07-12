import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import {
  runMonteCarloSimulation,
  calculateDeterministicProjection,
} from "../../utils/fire";
import useChartColors from "../../hooks/useChartColors";
import { useTranslation } from "react-i18next";
import {
  buildHoldingsFromTransactions,
  mergeHoldingsWithQuotes,
  computePortfolioTotals,
  computeNetWorthMarketValues,
} from "../../utils/investments";
import {
  ErrorState,
  SkeletonCard,
  SkeletonChart,
} from "../../components/ui/Skeleton";
import { FIRE_DEFAULTS } from "../../constants/app";
import { handleAsyncError, logError } from "../../utils/errors";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type {
  InvestmentQuote,
  ProjectionResult,
  MonteCarloResult,
} from "./fire-types";
import FireInputsPanel from "./FireInputsPanel";
import FireResultsPanel from "./FireResultsPanel";

type FireUserModified = {
  currentNetWorth: boolean;
  annualExpenses: boolean;
  expectedReturn: boolean;
  withdrawalRate: boolean;
  annualSavings: boolean;
  inflation: boolean;
  currentAge: boolean;
  retirementAge: boolean;
  retirementDuration: boolean;
  volatility: boolean;
  simulationCount: boolean;
};

interface FireCalculatorState {
  currentNetWorth: number;
  annualExpenses: number;
  expectedReturn: number;
  withdrawalRate: number;
  annualSavings: number;
  inflation: number;
  currentAge: number;
  retirementAge: number;
  retirementDuration: number;
  showAdvanced: boolean;
  volatility: number;
  simulationCount: number;
  userModified: FireUserModified;
}

const defaultUserModified: FireUserModified = {
  currentNetWorth: false,
  annualExpenses: false,
  expectedReturn: false,
  withdrawalRate: false,
  annualSavings: false,
  inflation: false,
  currentAge: false,
  retirementAge: false,
  retirementDuration: false,
  volatility: false,
  simulationCount: false,
};

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseSavedState(raw: string): FireCalculatorState | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const state = parsed as Record<string, unknown>;
  const userModifiedRaw =
    typeof state.userModified === "object" && state.userModified !== null
      ? (state.userModified as Record<string, unknown>)
      : {};

  return {
    currentNetWorth: asNumber(
      state.currentNetWorth,
      FIRE_DEFAULTS.CURRENT_NET_WORTH,
    ),
    annualExpenses: asNumber(
      state.annualExpenses,
      FIRE_DEFAULTS.ANNUAL_EXPENSES,
    ),
    expectedReturn: asNumber(
      state.expectedReturn,
      FIRE_DEFAULTS.EXPECTED_RETURN,
    ),
    withdrawalRate: asNumber(
      state.withdrawalRate,
      FIRE_DEFAULTS.WITHDRAWAL_RATE,
    ),
    annualSavings: asNumber(state.annualSavings, FIRE_DEFAULTS.ANNUAL_SAVINGS),
    inflation: asNumber(state.inflation, FIRE_DEFAULTS.INFLATION),
    currentAge: asNumber(state.currentAge, FIRE_DEFAULTS.CURRENT_AGE),
    retirementAge: asNumber(state.retirementAge, FIRE_DEFAULTS.RETIREMENT_AGE),
    retirementDuration: asNumber(
      state.retirementDuration,
      FIRE_DEFAULTS.RETIREMENT_DURATION,
    ),
    showAdvanced: asBoolean(state.showAdvanced, FIRE_DEFAULTS.SHOW_ADVANCED),
    volatility: asNumber(state.volatility, FIRE_DEFAULTS.VOLATILITY),
    simulationCount: asNumber(
      state.simulationCount,
      FIRE_DEFAULTS.SIMULATION_COUNT,
    ),
    userModified: {
      currentNetWorth: asBoolean(userModifiedRaw.currentNetWorth, false),
      annualExpenses: asBoolean(userModifiedRaw.annualExpenses, false),
      expectedReturn: asBoolean(userModifiedRaw.expectedReturn, false),
      withdrawalRate: asBoolean(userModifiedRaw.withdrawalRate, false),
      annualSavings: asBoolean(userModifiedRaw.annualSavings, false),
      inflation: asBoolean(userModifiedRaw.inflation, false),
      currentAge: asBoolean(userModifiedRaw.currentAge, false),
      retirementAge: asBoolean(userModifiedRaw.retirementAge, false),
      retirementDuration: asBoolean(userModifiedRaw.retirementDuration, false),
      volatility: asBoolean(userModifiedRaw.volatility, false),
      simulationCount: asBoolean(userModifiedRaw.simulationCount, false),
    },
  };
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default function FireCalculator() {
  const { t } = useTranslation();
  // Initialize state from sessionStorage if available (persists for the lifetime of the browser/tab session, including reloads, and is cleared when the tab or window is closed)
  const savedState = useMemo<FireCalculatorState | null>(() => {
    const saved = sessionStorage.getItem("fireCalculatorState");
    if (saved) {
      try {
        return parseSavedState(saved);
      } catch (e: unknown) {
        logError("Failed to parse saved FIRE calculator state", e);
      }
    }
    return null;
  }, []);

  const [currentNetWorth, setCurrentNetWorth] = useState(
    savedState?.currentNetWorth ?? FIRE_DEFAULTS.CURRENT_NET_WORTH,
  );
  const [annualExpenses, setAnnualExpenses] = useState(
    savedState?.annualExpenses ?? FIRE_DEFAULTS.ANNUAL_EXPENSES,
  );
  const [expectedReturn, setExpectedReturn] = useState(
    savedState?.expectedReturn ?? FIRE_DEFAULTS.EXPECTED_RETURN,
  );
  const [withdrawalRate, setWithdrawalRate] = useState(
    savedState?.withdrawalRate ?? FIRE_DEFAULTS.WITHDRAWAL_RATE,
  );
  const [annualSavings, setAnnualSavings] = useState(
    savedState?.annualSavings ?? FIRE_DEFAULTS.ANNUAL_SAVINGS,
  );
  // New fields
  const [inflation, setInflation] = useState(
    savedState?.inflation ?? FIRE_DEFAULTS.INFLATION,
  );
  const [currentAge, setCurrentAge] = useState(
    savedState?.currentAge ?? FIRE_DEFAULTS.CURRENT_AGE,
  );
  const [retirementAge, setRetirementAge] = useState(
    savedState?.retirementAge ?? FIRE_DEFAULTS.RETIREMENT_AGE,
  );
  const [retirementDuration, setRetirementDuration] = useState(
    savedState?.retirementDuration ?? FIRE_DEFAULTS.RETIREMENT_DURATION,
  );
  // Advanced Monte Carlo parameters
  const [showAdvanced, setShowAdvanced] = useState(
    savedState?.showAdvanced ?? FIRE_DEFAULTS.SHOW_ADVANCED,
  );
  const [volatility, setVolatility] = useState(
    savedState?.volatility ?? FIRE_DEFAULTS.VOLATILITY,
  );
  const [simulationCount, setSimulationCount] = useState(
    savedState?.simulationCount ?? FIRE_DEFAULTS.SIMULATION_COUNT,
  );

  const [loading, setLoading] = useState(!savedState);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const chartColors = useChartColors();

  // Track which fields the user has manually edited during the session so
  // computed backend updates don't overwrite them while the app is open. We
  // persist these flags in sessionStorage alongside values so switching
  // tabs/remounts keep user edits intact.
  const initialUserModified = savedState?.userModified ?? {
    ...defaultUserModified,
  };
  const userModified = useRef(initialUserModified); // keep as ref so it doesn't trigger effects

  async function fetchData() {
    setLoading(true);
    try {
      const accounts = await rust.get_accounts();
      const transactions = await rust.get_all_transactions();

      // Build holdings and first trade date
      const { currentHoldings, firstTradeDate } =
        await buildHoldingsFromTransactions(transactions);

      // Fetch quotes for holdings once
      const tickers = currentHoldings.map((h) => h.ticker);
      let quotes: InvestmentQuote[] = [];
      if (tickers.length > 0) {
        quotes = await rust.get_stock_quotes({
          tickers,
        });
      }

      // Compute portfolio totals
      const finalHoldings = await mergeHoldingsWithQuotes(
        currentHoldings,
        quotes,
      );
      const {
        totalValue: totalPortfolioValue,
        totalCostBasis: totalPortfolioCostBasis,
      } = await computePortfolioTotals(finalHoldings);

      // Compute market values per account used for net worth (re-uses quotes fetched earlier)
      const netWorthMarketValues = await computeNetWorthMarketValues(
        transactions,
        quotes,
      );

      const totalBalance = accounts.reduce((sum, acc) => {
        if (acc.kind === "brokerage") {
          return (
            sum +
            (netWorthMarketValues[acc.id] !== undefined
              ? netWorthMarketValues[acc.id]!
              : acc.balance)
          );
        }
        return sum + acc.balance;
      }, 0);

      if (!userModified.current.currentNetWorth) {
        setCurrentNetWorth(Math.round(totalBalance));
      }

      // Calculate Expected Return (CAGR)
      if (totalPortfolioCostBasis > 0 && firstTradeDate) {
        const totalReturnRate =
          (totalPortfolioValue - totalPortfolioCostBasis) /
          totalPortfolioCostBasis;
        const now = new Date();
        const yearsInvested = Math.max(
          (now.getTime() - new Date(firstTradeDate).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25),
          0.1,
        );

        const annualizedReturn =
          (Math.pow(1 + totalReturnRate, 1 / yearsInvested) - 1) * 100;

        if (
          isFinite(annualizedReturn) &&
          !userModified.current.expectedReturn
        ) {
          setExpectedReturn(parseFloat(annualizedReturn.toFixed(2)));
        }
      }

      // --- 2. Calculate Annual Expenses & Savings ---
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const lastYearTransactions = transactions.filter(
        (tx) => new Date(tx.date) >= oneYearAgo,
      );

      let expenses = 0;
      let income = 0;

      lastYearTransactions.forEach((tx) => {
        const isTrade = tx.ticker && tx.shares;
        const isTransfer = tx.category === "Transfer";

        if (!isTrade && !isTransfer) {
          if (tx.amount < 0) {
            expenses += Math.abs(tx.amount);
          } else {
            income += tx.amount;
          }
        }
      });

      if (!userModified.current.annualExpenses) {
        setAnnualExpenses(Math.round(expenses));
      }
      if (!userModified.current.annualSavings) {
        setAnnualSavings(Math.round(income - expenses));
      }

      setLoading(false);
    } catch (e) {
      handleAsyncError({
        context: "Failed to fetch FIRE calculator data",
        error: e,
        setError: setFetchError,
        detailFallback: t("error.failed_to_load"),
      });
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!savedState) {
      queueMicrotask(() => {
        void fetchData();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      const state = {
        currentNetWorth,
        annualExpenses,
        expectedReturn,
        withdrawalRate,
        annualSavings,
        inflation,
        currentAge,
        retirementAge,
        retirementDuration,
        showAdvanced,
        volatility,
        simulationCount,
        userModified: userModified.current,
      };
      sessionStorage.setItem("fireCalculatorState", JSON.stringify(state));
    }
  }, [
    currentNetWorth,
    annualExpenses,
    expectedReturn,
    withdrawalRate,
    annualSavings,
    inflation,
    currentAge,
    retirementAge,
    retirementDuration,
    showAdvanced,
    volatility,
    simulationCount,
    loading,
  ]);

  // Reset calculation to defaults computed from historic data
  function resetToHistoric() {
    // Remove any saved session so fetchData recomputes defaults from historic data
    try {
      sessionStorage.removeItem("fireCalculatorState");
    } catch {
      // ignore
    }

    userModified.current = {
      currentNetWorth: false,
      annualExpenses: false,
      expectedReturn: false,
      withdrawalRate: false,
      annualSavings: false,
      inflation: false,
      currentAge: false,
      retirementAge: false,
      retirementDuration: false,
      volatility: false,
      simulationCount: false,
    };

    // Reset fields that are not computed from history to their defaults
    setWithdrawalRate(4);
    setInflation(2);
    setCurrentAge(30);
    setRetirementAge(65);
    setRetirementDuration(30);
    setVolatility(15);
    setSimulationCount(1000);
    setShowAdvanced(false);

    // Re-fetch data which will set the computed defaults
    void fetchData();
  }

  // Ensure the saved session state is cleared when the window is closed
  useEffect(() => {
    const onBeforeUnload = () => {
      // sessionStorage is usually cleared on window close, but remove explicitly to be safe
      sessionStorage.removeItem("fireCalculatorState");
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // Also listen to Tauri close event in case beforeunload doesn't fire in some environments
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("tauri://close-requested", () => {
          sessionStorage.removeItem("fireCalculatorState");
        });
      } catch (e: unknown) {
        // If Tauri event API isn't available, that's fine — beforeunload handles it
        console.debug("Tauri event listener not available:", e);
      }
    })();
    return () => {
      if (typeof unlisten === "function") {
        unlisten();
      }
    };
  }, []);

  const [deterministicProjection, setDeterministicProjection] =
    useState<ProjectionResult>({
      fireNumber: 0,
      yearsToFire: null,
      projectionData: [],
      neverReached: false,
    });

  const { fireNumber, yearsToFire, projectionData, neverReached } =
    deterministicProjection;

  useEffect(() => {
    let cancelled = false;

    const loadDeterministicProjection = async () => {
      const yearsToRetirement = Math.max(0, retirementAge - currentAge);
      const totalYears = yearsToRetirement + retirementDuration;

      const result = await calculateDeterministicProjection({
        currentNetWorth,
        annualSavings,
        annualExpenses,
        expectedReturn,
        inflation,
        withdrawalRate,
        maxYears: totalYears,
      });

      if (!cancelled) {
        setDeterministicProjection(result as ProjectionResult);
      }
    };

    loadDeterministicProjection().catch((e: unknown) => {
      logError("Failed to calculate deterministic projection", e);
    });

    return () => {
      cancelled = true;
    };
  }, [
    currentNetWorth,
    annualSavings,
    annualExpenses,
    expectedReturn,
    inflation,
    withdrawalRate,
    currentAge,
    retirementAge,
    retirementDuration,
  ]);

  // Monte Carlo simulation (debounced to avoid excessive recalculation)
  const [monteCarloResult, setMonteCarloResult] =
    useState<MonteCarloResult | null>(null);

  const runSimulation = useCallback(async () => {
    const result = await runMonteCarloSimulation({
      currentNetWorth,
      annualSavings,
      annualExpenses,
      expectedReturn,
      inflation,
      volatility,
      currentAge,
      retirementAge,
      retirementDuration,
      simulationCount,
    });
    setMonteCarloResult(result as MonteCarloResult);
  }, [
    currentNetWorth,
    annualSavings,
    annualExpenses,
    expectedReturn,
    inflation,
    volatility,
    currentAge,
    retirementAge,
    retirementDuration,
    simulationCount,
  ]);

  // Debounce Monte Carlo calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation().catch((e: unknown) => {
        logError("Failed to run Monte Carlo simulation", e);
      });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [runSimulation]);

  // Build chart data combining deterministic and Monte Carlo results
  const chartData = useMemo(() => {
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const totalYears = yearsToRetirement + retirementDuration;
    const labels = Array.from({ length: totalYears + 1 }, (_, i) => {
      if (i === 0) return t("fire.age_value", { age: currentAge });
      if (i === yearsToRetirement)
        return t("fire.retire_age_label", { age: retirementAge });
      return t("fire.age_value", { age: currentAge + i });
    });

    const datasets = [];

    // Monte Carlo percentile bands (if available)
    if (monteCarloResult) {
      const { percentiles } = monteCarloResult;

      // 10th-90th percentile band (outer)
      datasets.push({
        label: t("fire.percentile_90"),
        data: percentiles.p90,
        borderColor: `${chartColors.success}4D`,
        backgroundColor: `${chartColors.success}1A`,
        fill: "+1",
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      });

      datasets.push({
        label: t("fire.percentile_10"),
        data: percentiles.p10,
        borderColor: `${chartColors.success}4D`,
        backgroundColor: "transparent",
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      });

      // 25th-75th percentile band (inner)
      datasets.push({
        label: t("fire.percentile_75"),
        data: percentiles.p75,
        borderColor: `${chartColors.success}80`,
        backgroundColor: `${chartColors.success}26`,
        fill: "+1",
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      });

      datasets.push({
        label: t("fire.percentile_25"),
        data: percentiles.p25,
        borderColor: `${chartColors.success}80`,
        backgroundColor: "transparent",
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      });

      // Median (50th percentile)
      datasets.push({
        label: t("fire.median_outcome"),
        data: percentiles.p50,
        borderColor: chartColors.success,
        backgroundColor: "transparent",
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      });
    }

    // Deterministic projection line
    datasets.push({
      label: t("fire.deterministic_projection"),
      data: projectionData.slice(0, totalYears + 1),
      borderColor: chartColors.primary,
      backgroundColor: `${chartColors.primary}1A`,
      fill: !monteCarloResult, // Only fill if no Monte Carlo data
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
    });

    // FIRE target line
    datasets.push({
      label: t("fire.target"),
      data: Array(labels.length).fill(fireNumber),
      borderColor: chartColors.loss,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      borderWidth: 2,
    });

    // Retirement marker (vertical line effect using segment)
    const retirementMarker = Array(labels.length).fill(null);
    if (yearsToRetirement > 0 && yearsToRetirement < labels.length) {
      // Create a point at retirement year
      retirementMarker[yearsToRetirement] = fireNumber * 1.5; // Extend above FIRE line
    }

    return { labels, datasets };
  }, [
    projectionData,
    fireNumber,
    monteCarloResult,
    currentAge,
    retirementAge,
    retirementDuration,
    chartColors,
    t,
  ]);

  // Calculate retirement age when FIRE is reached
  const fireAge = yearsToFire === null ? null : currentAge + yearsToFire;

  if (loading) {
    return (
      <div className="page-container fire-calculator-container animate-pulse">
        <header className="hb-header-container">
          <div>
            <h1 className="hb-header-title">{t("fire.title")}</h1>
            <p className="hb-header-subtitle">{t("fire.subtitle")}</p>
          </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <SkeletonCard className="lg:col-span-1" />
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <SkeletonChart />
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="page-container fire-calculator-container">
        <header className="hb-header-container">
          <div>
            <h1 className="hb-header-title">{t("fire.title")}</h1>
            <p className="hb-header-subtitle">{t("fire.subtitle")}</p>
          </div>
        </header>
        <ErrorState
          title={t("error.failed_to_load")}
          message={fetchError}
          onRetry={() => {
            setFetchError(null);
            void fetchData();
          }}
          retryLabel={t("error.retry")}
        />
      </div>
    );
  }

  return (
    <div className="page-container fire-calculator-container">
      <header className="hb-header-container">
        <div>
          <h1 className="hb-header-title">{t("fire.title")}</h1>
          <p className="hb-header-subtitle">{t("fire.subtitle")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Inputs */}
        <FireInputsPanel
          currentNetWorth={currentNetWorth}
          setCurrentNetWorth={setCurrentNetWorth}
          annualExpenses={annualExpenses}
          setAnnualExpenses={setAnnualExpenses}
          annualSavings={annualSavings}
          setAnnualSavings={setAnnualSavings}
          expectedReturn={expectedReturn}
          setExpectedReturn={setExpectedReturn}
          inflation={inflation}
          setInflation={setInflation}
          withdrawalRate={withdrawalRate}
          setWithdrawalRate={setWithdrawalRate}
          currentAge={currentAge}
          setCurrentAge={setCurrentAge}
          retirementAge={retirementAge}
          setRetirementAge={setRetirementAge}
          retirementDuration={retirementDuration}
          setRetirementDuration={setRetirementDuration}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          volatility={volatility}
          setVolatility={setVolatility}
          simulationCount={simulationCount}
          setSimulationCount={setSimulationCount}
          markUserModified={(field: string) => {
            (userModified.current as Record<string, boolean>)[field] = true;
          }}
          resetToHistoric={resetToHistoric}
        />

        {/* Results & Chart */}
        <FireResultsPanel
          fireNumber={fireNumber}
          yearsToFire={yearsToFire}
          neverReached={neverReached}
          fireAge={fireAge}
          monteCarloResult={monteCarloResult}
          chartData={chartData}
        />
      </div>
    </div>
  );
}
