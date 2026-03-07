import { CURRENCIES } from "./currencies";
import { computeNetWorth } from "./networth";
import {
  buildHoldingsFromTransactions,
  mergeHoldingsWithQuotes,
  computePortfolioTotals,
  computeNetWorthMarketValues,
} from "./investments";

/**
 * Get the symbol for a currency code from the CURRENCIES list.
 */
function getCurrencySymbol(code) {
  const entry = CURRENCIES.find((c) => c.code === code);
  return entry ? entry.symbol : code;
}

/**
 * Filter transactions to a date range [startStr, endStr] (YYYY-MM-DD inclusive).
 */
function filterByDateRange(transactions, startStr, endStr) {
  return transactions.filter((t) => t.date >= startStr && t.date <= endStr);
}

/**
 * Get exchange rate for a given date from the exchangeRates map.
 * exchangeRates: { "EURUSD=X": { map: { "2025-01-01": 1.05, ... }, list: [...] }, ... }
 * Falls back to the nearest earlier date, then to 1.0.
 */
function getRate(exchangeRates, pair, date) {
  const data = exchangeRates[pair];
  if (!data) return 1.0;
  if (data.map && data.map[date] !== undefined) return data.map[date];
  // Fallback: find nearest earlier date
  if (data.list) {
    let best = null;
    for (const p of data.list) {
      if (p.date <= date) best = p.price;
    }
    if (best !== null) return best;
  }
  return 1.0;
}

/**
 * Build the complete ReportData object that the Rust backend expects.
 *
 * @param {Object} params
 * @param {Array} params.accounts
 * @param {Array} params.transactions - all transactions (unfiltered)
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @param {string} params.appCurrency - e.g. "USD"
 * @param {Object} params.exchangeRates - map from pair to { list, map }
 * @param {Array} params.quotes - stock quote objects
 * @param {Object} params.labels - translated report labels
 */
export function computeReportData({
  accounts,
  transactions,
  startDate,
  endDate,
  appCurrency,
  exchangeRates,
  quotes,
  labels,
}) {
  const sym = getCurrencySymbol(appCurrency);
  const accountMap = {};
  accounts.forEach((a) => (accountMap[a.id] = a));

  const filtered = filterByDateRange(transactions, startDate, endDate);

  // Helper: convert an amount to app currency
  const toAppCurrency = (amount, accountId, date) => {
    const acc = accountMap[accountId];
    const accCurrency = acc?.currency || appCurrency;
    if (accCurrency === appCurrency) return amount;
    const rate = getRate(exchangeRates, `${accCurrency}${appCurrency}=X`, date);
    return amount * rate;
  };

  // ── Summary ───────────────────────────────────────────────────────
  const marketValues = computeNetWorthMarketValues(transactions, quotes || []);
  const netWorth = computeNetWorth(accounts, marketValues);

  let totalIncome = 0;
  let totalExpenses = 0;

  filtered.forEach((t) => {
    if (t.category === "Transfer" || t.ticker) return;
    const converted = toAppCurrency(t.amount, t.account_id, t.date);
    if (converted > 0) totalIncome += converted;
    else totalExpenses += Math.abs(converted);
  });

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const summary = {
    net_worth: netWorth,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_savings: netSavings,
    savings_rate: savingsRate,
    account_count: accounts.length,
  };

  // ── Account balances (exclude accounts with all-zero values) ─────
  const accountBalances = accounts
    .map((acc) => ({
      name: acc.name,
      currency: acc.currency || appCurrency,
      currency_symbol: getCurrencySymbol(acc.currency || appCurrency),
      cash_balance: acc.balance,
      market_value: marketValues[acc.id] || 0,
      total: acc.balance + (marketValues[acc.id] || 0),
    }))
    .filter((a) => a.cash_balance !== 0 || a.market_value !== 0);

  // ── Net worth evolution (sampled daily points) ────────────────────
  const netWorthPoints = computeNetWorthTimeSeries(
    accounts,
    transactions,
    startDate,
    endDate,
    appCurrency,
    exchangeRates,
    quotes || [],
  );

  // ── Monthly income vs expenses ────────────────────────────────────
  const monthlyIncomeExpenses = computeMonthlyIncomeExpenses(
    filtered,
    accountMap,
    appCurrency,
    exchangeRates,
    startDate,
    endDate,
  );

  // ── Expense categories ────────────────────────────────────────────
  const expenseCategories = computeCategoryBreakdown(
    filtered,
    accountMap,
    appCurrency,
    exchangeRates,
    "expense",
  );

  // ── Income categories ─────────────────────────────────────────────
  const incomeCategories = computeCategoryBreakdown(
    filtered,
    accountMap,
    appCurrency,
    exchangeRates,
    "income",
  );

  // ── Cash flow ─────────────────────────────────────────────────────
  const cashFlow = computeCashFlow(
    filtered,
    accountMap,
    appCurrency,
    exchangeRates,
  );

  // ── Portfolio ─────────────────────────────────────────────────────
  let portfolio = null;
  const { currentHoldings } = buildHoldingsFromTransactions(transactions);
  if (currentHoldings.length > 0 && quotes && quotes.length > 0) {
    const finalHoldings = mergeHoldingsWithQuotes(currentHoldings, quotes);
    const totals = computePortfolioTotals(finalHoldings);
    const overallRoi =
      totals.totalCostBasis > 0
        ? ((totals.totalValue - totals.totalCostBasis) /
            totals.totalCostBasis) *
          100
        : 0;

    portfolio = {
      total_value: totals.totalValue,
      total_cost_basis: totals.totalCostBasis,
      overall_roi: overallRoi,
      holdings: finalHoldings.map((h) => ({
        ticker: h.ticker,
        shares: h.shares,
        price: h.price,
        current_value: h.currentValue,
        cost_basis: h.costBasis,
        roi: h.roi,
      })),
    };
  }

  // ── Transactions grouped by account (only accounts with transactions) ──
  const accountsTransactions = accounts
    .map((acc) => {
      const accTxs = filtered
        .filter((t) => t.account_id === acc.id)
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .map((t) => ({
          date: t.date,
          payee: t.payee || "",
          category: t.category || "",
          amount: t.amount,
          notes: t.notes || "",
          ticker: t.ticker || "",
          shares: t.shares || 0,
          price_per_share: t.price_per_share || 0,
          fee: t.fee || 0,
        }));

      return {
        account_name: acc.name,
        currency: acc.currency || appCurrency,
        currency_symbol: getCurrencySymbol(acc.currency || appCurrency),
        transactions: accTxs,
      };
    })
    .filter((a) => a.transactions.length > 0);

  return {
    date_range_start: startDate,
    date_range_end: endDate,
    currency_symbol: sym,
    generation_date: new Date().toISOString().split("T")[0],
    labels,
    summary,
    account_balances: accountBalances,
    net_worth_points: netWorthPoints,
    monthly_income_expenses: monthlyIncomeExpenses,
    expense_categories: expenseCategories,
    income_categories: incomeCategories,
    cash_flow: cashFlow,
    portfolio,
    accounts_transactions: accountsTransactions,
  };
}

// ── Internal helpers ────────────────────────────────────────────────

/**
 * Compute a simplified net worth time series (weekly samples).
 */
function computeNetWorthTimeSeries(
  accounts,
  allTransactions,
  startDate,
  endDate,
  appCurrency,
  exchangeRates,
) {
  // Build a running balance per account from the beginning to endDate
  const sorted = [...allTransactions].sort((a, b) =>
    a.date > b.date ? 1 : -1,
  );

  // Accumulate balances day-by-day
  const balanceByAccount = {};
  accounts.forEach((a) => (balanceByAccount[a.id] = 0));

  const txByDate = {};
  sorted.forEach((tx) => {
    if (!txByDate[tx.date]) txByDate[tx.date] = [];
    txByDate[tx.date].push(tx);
  });

  // Generate sample dates (weekly or less frequent for long ranges)
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const sampleInterval = daysDiff > 365 ? 14 : daysDiff > 90 ? 7 : 1;
  const maxSamples = 200;

  const sampleDates = [];
  const d = new Date(start);
  while (d <= end && sampleDates.length < maxSamples) {
    sampleDates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + sampleInterval);
  }
  // Always include the end date
  const endStr = end.toISOString().slice(0, 10);
  if (sampleDates[sampleDates.length - 1] !== endStr) {
    sampleDates.push(endStr);
  }

  // Process all transactions up to each sample date
  const allDates = Object.keys(txByDate).sort();
  let txIdx = 0;
  const points = [];

  for (const sampleDate of sampleDates) {
    // Apply all transactions up to this date
    while (txIdx < allDates.length && allDates[txIdx] <= sampleDate) {
      const dateTxs = txByDate[allDates[txIdx]];
      dateTxs.forEach((tx) => {
        if (balanceByAccount[tx.account_id] !== undefined) {
          balanceByAccount[tx.account_id] += tx.amount;
        }
      });
      txIdx++;
    }

    // Compute net worth at this point
    let nw = 0;
    accounts.forEach((acc) => {
      const bal = balanceByAccount[acc.id] || 0;
      const accCurrency = acc.currency || appCurrency;
      const rate =
        accCurrency === appCurrency
          ? 1.0
          : getRate(
              exchangeRates,
              `${accCurrency}${appCurrency}=X`,
              sampleDate,
            );
      nw += bal * rate;
    });

    points.push({ label: sampleDate, value: nw });
  }

  return points;
}

/**
 * Compute monthly income and expense totals.
 */
function computeMonthlyIncomeExpenses(
  filteredTxs,
  accountMap,
  appCurrency,
  exchangeRates,
  startDate,
  endDate,
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setDate(1);

  const months = [];
  const d = new Date(start);
  while (d <= end) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en", {
      month: "short",
      year: "numeric",
    });
    months.push({ key, label, income: 0, expenses: 0 });
    d.setMonth(d.getMonth() + 1);
  }

  const monthMap = {};
  months.forEach((m) => (monthMap[m.key] = m));

  filteredTxs.forEach((t) => {
    if (t.category === "Transfer" || t.ticker) return;
    const key = t.date.slice(0, 7);
    const bucket = monthMap[key];
    if (!bucket) return;

    const acc = accountMap[t.account_id];
    const accCurrency = acc?.currency || appCurrency;
    const rate =
      accCurrency === appCurrency
        ? 1.0
        : getRate(exchangeRates, `${accCurrency}${appCurrency}=X`, t.date);
    const amount = t.amount * rate;

    if (amount > 0) bucket.income += amount;
    else bucket.expenses += Math.abs(amount);
  });

  return months
    .filter((m) => m.income > 0 || m.expenses > 0)
    .map((m) => ({
      label: m.label,
      income: m.income,
      expenses: m.expenses,
    }));
}

/**
 * Compute category breakdown (either "income" or "expense").
 */
function computeCategoryBreakdown(
  filteredTxs,
  accountMap,
  appCurrency,
  exchangeRates,
  type,
) {
  const totals = {};
  let grandTotal = 0;

  filteredTxs.forEach((t) => {
    if (t.category === "Transfer" || t.ticker) return;

    const acc = accountMap[t.account_id];
    const accCurrency = acc?.currency || appCurrency;
    const rate =
      accCurrency === appCurrency
        ? 1.0
        : getRate(exchangeRates, `${accCurrency}${appCurrency}=X`, t.date);
    const amount = t.amount * rate;

    if (type === "expense" && amount < 0) {
      const cat = t.category || "Uncategorized";
      const abs = Math.abs(amount);
      totals[cat] = (totals[cat] || 0) + abs;
      grandTotal += abs;
    } else if (type === "income" && amount > 0) {
      const cat = t.category || "Uncategorized";
      totals[cat] = (totals[cat] || 0) + amount;
      grandTotal += amount;
    }
  });

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
    }));
}

/**
 * Compute cash flow summary.
 */
function computeCashFlow(filteredTxs, accountMap, appCurrency, exchangeRates) {
  const incomeCategories = {};
  const expenseCategories = {};
  const investmentCategories = {};
  let totalIncome = 0;
  let totalExpense = 0;
  let totalInvestments = 0;

  const isInvestment = (cat) => {
    const lower = (cat || "").toLowerCase();
    return (
      lower.includes("invest") ||
      lower.includes("savings") ||
      lower.includes("brokerage") ||
      lower.includes("deposit")
    );
  };

  filteredTxs.forEach((tx) => {
    if (tx.category === "Transfer") return;

    const acc = accountMap[tx.account_id];
    const accCurrency = acc?.currency || appCurrency;
    const rate =
      accCurrency === appCurrency
        ? 1.0
        : getRate(exchangeRates, `${accCurrency}${appCurrency}=X`, tx.date);
    const amount = tx.amount * rate;

    if (amount > 0) {
      const cat = tx.category || "Uncategorized";
      incomeCategories[cat] = (incomeCategories[cat] || 0) + amount;
      totalIncome += amount;
    } else if (amount < 0) {
      const cat = tx.category || "Uncategorized";
      const abs = Math.abs(amount);

      if (isInvestment(cat)) {
        investmentCategories[cat] = (investmentCategories[cat] || 0) + abs;
        totalInvestments += abs;
      } else {
        expenseCategories[cat] = (expenseCategories[cat] || 0) + abs;
      }
      totalExpense += abs;
    }
  });

  const expenseCats = Object.entries(expenseCategories)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
    }));

  const investCats = Object.entries(investmentCategories)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
    }));

  return {
    total_income: totalIncome,
    total_expenses: totalExpense - totalInvestments,
    total_investments: totalInvestments,
    surplus_or_deficit: totalIncome - totalExpense,
    expense_categories: expenseCats,
    investment_categories: investCats,
  };
}
