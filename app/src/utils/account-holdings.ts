import type { Transaction } from "../api/types";

/** Per-account map of ticker symbol to share count. */
export type AccountHoldingsMap = Record<string, Record<string, number>>;

type HoldingsTransaction = Pick<Transaction, "account_id" | "ticker" | "shares">;

export interface AccountHoldingsResult {
  accountHoldings: AccountHoldingsMap;
  allTickers: Set<string>;
}

/**
 * Builds per-account ticker→shares maps by summing transaction share counts.
 * Shared by market-value utilities; does not apply sell cost-basis logic
 * (see `buildHoldingsFromTransactions` for portfolio-level holdings).
 */
export function buildAccountHoldingsFromTransactions(
  transactions: HoldingsTransaction[],
): AccountHoldingsResult {
  const accountHoldings: AccountHoldingsMap = {};
  const allTickers = new Set<string>();

  for (const tx of transactions) {
    if (!tx.ticker || !tx.shares) continue;

    const accountId = String(tx.account_id);
    if (!accountHoldings[accountId]) accountHoldings[accountId] = {};
    if (!accountHoldings[accountId][tx.ticker])
      accountHoldings[accountId][tx.ticker] = 0;
    accountHoldings[accountId][tx.ticker] += tx.shares;
    allTickers.add(tx.ticker);
  }

  return { accountHoldings, allTickers };
}
