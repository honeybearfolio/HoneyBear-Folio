import { describe, it, expect } from "vitest";
import {
  isTransferPayee,
  resolveInlineBuySell,
} from "../../../features/accounts/transaction-fields/utils";

describe("transaction-fields utils", () => {
  const accounts = [
    { id: "1", name: "Savings", kind: "cash", balance: 0, currency: "USD" },
  ];

  it("detects transfer payee by account name", () => {
    expect(isTransferPayee("Savings", accounts)).toBe(true);
    expect(isTransferPayee("Grocery", accounts)).toBe(false);
  });

  it("resolves buy/sell from payee label", () => {
    const parse = (v: unknown) => Number(v);
    expect(resolveInlineBuySell("Buy", "-10", parse)).toBe(true);
    expect(resolveInlineBuySell("Sell", "10", parse)).toBe(false);
  });

  it("falls back to shares sign when payee is not Buy/Sell", () => {
    const parse = (v: unknown) => Number(v);
    expect(resolveInlineBuySell("AAPL", "5", parse)).toBe(true);
    expect(resolveInlineBuySell("AAPL", "-5", parse)).toBe(false);
    expect(resolveInlineBuySell("AAPL", "0", parse)).toBe(false);
  });
});
