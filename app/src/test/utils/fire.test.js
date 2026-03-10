import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  runMonteCarloSimulation,
  calculateDeterministicProjection,
} from "../../utils/fire";

describe("fire utils wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Rust deterministic projection command", async () => {
    const payload = {
      currentNetWorth: 100000,
      annualSavings: 20000,
      annualExpenses: 40000,
      expectedReturn: 7,
      inflation: 2,
      withdrawalRate: 4,
      maxYears: 50,
    };
    const expected = { fireNumber: 2040000, yearsToFire: 18 };

    vi.mocked(invoke).mockResolvedValue(expected);

    const result = await calculateDeterministicProjection(payload);

    expect(invoke).toHaveBeenCalledWith("calculate_deterministic_projection", {
      input: payload,
    });
    expect(result).toEqual(expected);
  });

  it("calls Rust Monte Carlo command", async () => {
    const payload = {
      currentNetWorth: 500000,
      annualSavings: 20000,
      annualExpenses: 40000,
      expectedReturn: 7,
      inflation: 2,
      volatility: 15,
      currentAge: 40,
      retirementAge: 65,
      retirementDuration: 30,
      simulationCount: 100,
    };
    const expected = {
      successRate: 82,
      percentiles: { p50: Array(56).fill(500000) },
    };

    vi.mocked(invoke).mockResolvedValue(expected);

    const result = await runMonteCarloSimulation(payload);

    expect(invoke).toHaveBeenCalledWith("run_monte_carlo_simulation", {
      input: payload,
    });
    expect(result).toEqual(expected);
  });
});
