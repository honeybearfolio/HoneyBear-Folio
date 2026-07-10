import type { AvailableAccount } from "../account-details-types";

export function isTransferPayee(
  payee: string,
  availableAccounts: AvailableAccount[],
): boolean {
  return availableAccounts.some((account) => account.name === payee);
}

export function resolveInlineBuySell(
  payee: string | undefined,
  shares: number | string | undefined,
  parseNumber: (value: unknown) => number,
): boolean {
  if (payee === "Buy") return true;
  if (payee === "Sell") return false;
  return (parseNumber(shares) || 0) > 0;
}
