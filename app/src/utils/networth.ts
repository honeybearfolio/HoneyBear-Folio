interface NetWorthAccount {
  id: number;
  balance?: unknown;
  exchange_rate?: number;
  [key: string]: unknown;
}

function toNumeric(value: unknown): number {
  // Reject booleans explicitly (they can coerce to 1/0) and treat non-numeric strings as invalid
  if (typeof value === "boolean" || value === null || value === undefined)
    return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function computeNetWorth(
  accounts: NetWorthAccount[] = [],
  marketValues: Record<number, number> = {},
  totalAssetsValue = 0,
): number {
  if (!Array.isArray(accounts)) return totalAssetsValue || 0;
  const accountsTotal = accounts.reduce((sum: number, acc) => {
    if (!acc) return sum;

    const balanceNumeric = toNumeric(acc.balance);
    const mv = toNumeric(marketValues?.[acc.id]);

    const rate = acc.exchange_rate || 1.0;

    // Always add market value if it exists, regardless of account 'kind' (which is deprecated/unified)
    return (
      sum +
      ((Number.isNaN(balanceNumeric) ? 0 : balanceNumeric) +
        (Number.isNaN(mv) ? 0 : mv)) *
        rate
    );
  }, 0);
  return (
    accountsTotal + (Number.isFinite(totalAssetsValue) ? totalAssetsValue : 0)
  );
}

export default computeNetWorth;
