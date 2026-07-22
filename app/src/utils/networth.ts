import { rust } from "../api/tauri-client";
import type { Account } from "../api/types";

/** Minimal account fields required for net-worth aggregation. */
export type NetWorthAccount = Pick<Account, "id" | "balance" | "exchange_rate">;

export type MarketValueMap = Record<string | number, number | string>;

export async function computeNetWorth(
  accounts?: NetWorthAccount[] | null,
  marketValues: MarketValueMap = {},
  totalAssetsValue = 0,
  totalLiabilitiesValue = 0,
): Promise<number> {
  if (!Array.isArray(accounts)) {
    const assets = Number.isFinite(totalAssetsValue) ? totalAssetsValue : 0;
    const liabilities = Number.isFinite(totalLiabilitiesValue)
      ? totalLiabilitiesValue
      : 0;
    return assets - liabilities;
  }

  const normalizedMarketValues = Object.fromEntries(
    Object.entries(marketValues).map(([id, value]) => [id, value]),
  );

  return rust.compute_net_worth({
    accounts: accounts as Account[],
    marketValues: normalizedMarketValues,
    ...(Number.isFinite(totalAssetsValue) ? { totalAssetsValue } : {}),
    ...(Number.isFinite(totalLiabilitiesValue)
      ? { totalLiabilitiesValue }
      : {}),
  });
}
