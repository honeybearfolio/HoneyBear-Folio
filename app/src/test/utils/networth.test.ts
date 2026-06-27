import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { computeNetWorth } from "../../utils/networth";

describe("networth utils wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Rust compute_net_worth command", async () => {
    const accounts = [
      { id: 1, balance: 100, exchange_rate: 1 },
      { id: 2, balance: 200.5, exchange_rate: 1 },
    ];
    const marketValues = { 1: 50 };

    vi.mocked(invoke).mockResolvedValue(350.5);

    const result = await computeNetWorth(accounts, marketValues, 0);

    expect(invoke).toHaveBeenCalledWith("compute_net_worth", {
      accounts,
      marketValues: { 1: 50 },
      totalAssetsValue: 0,
    });
    expect(result).toBe(350.5);
  });

  it("passes totalAssetsValue when finite", async () => {
    vi.mocked(invoke).mockResolvedValue(5100);

    await computeNetWorth([{ id: 1, balance: 100 }], {}, 5000);

    expect(invoke).toHaveBeenCalledWith("compute_net_worth", {
      accounts: [{ id: 1, balance: 100 }],
      marketValues: {},
      totalAssetsValue: 5000,
    });
  });

  it("returns totalAssetsValue for invalid accounts without calling Rust", async () => {
    const result = await computeNetWorth(undefined as never, {}, 500);
    expect(invoke).not.toHaveBeenCalled();
    expect(result).toBe(500);
  });
});
