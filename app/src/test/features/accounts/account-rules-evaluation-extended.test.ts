import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluateRule,
} from "../../../features/accounts/account-rules-evaluation";
import type { Rule } from "../../../features/accounts/account-details-types";

describe("evaluateCondition extended operators", () => {
  it("matches equals operator", () => {
    expect(
      evaluateCondition(
        { field: "category", operator: "equals", value: "Food" },
        { category: "Food" },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: "category", operator: "equals", value: "Food" },
        { category: "Travel" },
      ),
    ).toBe(false);
  });

  it("matches starts_with operator case-insensitively", () => {
    expect(
      evaluateCondition(
        { field: "payee", operator: "starts_with", value: "star" },
        { payee: "Starbucks Coffee" },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: "payee", operator: "starts_with", value: "coffee" },
        { payee: "Starbucks Coffee" },
      ),
    ).toBe(false);
  });

  it("matches ends_with operator case-insensitively", () => {
    expect(
      evaluateCondition(
        { field: "payee", operator: "ends_with", value: "COFFEE" },
        { payee: "Starbucks Coffee" },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: "payee", operator: "ends_with", value: "starbucks" },
        { payee: "Starbucks Coffee" },
      ),
    ).toBe(false);
  });

  it("matches greater_than operator for numeric values", () => {
    expect(
      evaluateCondition(
        { field: "amount", operator: "greater_than", value: "50" },
        { amount: "100" },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: "amount", operator: "greater_than", value: "50" },
        { amount: "25" },
      ),
    ).toBe(false);

    expect(
      evaluateCondition(
        { field: "amount", operator: "greater_than", value: "50" },
        { amount: "not-a-number" },
      ),
    ).toBe(false);
  });

  it("matches less_than operator for numeric values", () => {
    expect(
      evaluateCondition(
        { field: "amount", operator: "less_than", value: "50" },
        { amount: "25" },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: "amount", operator: "less_than", value: "50" },
        { amount: "75" },
      ),
    ).toBe(false);
  });

  it("applies negation to equals operator", () => {
    expect(
      evaluateCondition(
        {
          field: "category",
          operator: "equals",
          value: "Food",
          negated: true,
        },
        { category: "Food" },
      ),
    ).toBe(false);
  });
});

describe("evaluateRule with multiple conditions", () => {
  const andRule: Rule = {
    priority: 1,
    logic: "and",
    conditions: [
      { field: "payee", operator: "contains", value: "coffee" },
      { field: "amount", operator: "less_than", value: "20" },
    ],
    actions: [{ field: "category", value: "Coffee" }],
  };

  const orRule: Rule = {
    priority: 2,
    logic: "or",
    conditions: [
      { field: "payee", operator: "equals", value: "Salary" },
      { field: "category", operator: "equals", value: "Income" },
    ],
    actions: [{ field: "notes", value: "Paycheck" }],
  };

  it("matches when all AND conditions are satisfied", () => {
    expect(
      evaluateRule(andRule, { payee: "Local Coffee Shop", amount: "12.50" }),
    ).toBe(true);
  });

  it("does not match when one AND condition fails", () => {
    expect(
      evaluateRule(andRule, { payee: "Local Coffee Shop", amount: "45.00" }),
    ).toBe(false);
  });

  it("matches when any OR condition is satisfied", () => {
    expect(evaluateRule(orRule, { payee: "Salary", category: "Other" })).toBe(
      true,
    );
    expect(evaluateRule(orRule, { payee: "Employer", category: "Income" })).toBe(
      true,
    );
  });

  it("does not match when no OR conditions are satisfied", () => {
    expect(evaluateRule(orRule, { payee: "Grocery", category: "Food" })).toBe(
      false,
    );
  });

  it("defaults to AND logic when logic is omitted", () => {
    const rule: Rule = {
      priority: 3,
      conditions: [
        { field: "payee", operator: "starts_with", value: "Am" },
        { field: "payee", operator: "ends_with", value: "zon" },
      ],
      actions: [{ field: "category", value: "Shopping" }],
    };

    expect(evaluateRule(rule, { payee: "Amazon" })).toBe(true);
    expect(evaluateRule(rule, { payee: "Amazon Prime" })).toBe(false);
  });
});
