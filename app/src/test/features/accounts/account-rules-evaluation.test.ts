import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluateRule,
} from "../../../features/accounts/account-rules-evaluation";
import type { Rule } from "../../../features/accounts/account-details-types";

describe("evaluateCondition", () => {
  const values = { payee: "Starbucks Coffee" };

  it("matches contains when negated is false", () => {
    expect(
      evaluateCondition(
        {
          field: "payee",
          operator: "contains",
          value: "Starbucks",
          negated: false,
        },
        values,
      ),
    ).toBe(true);
  });

  it("inverts contains when negated is true", () => {
    expect(
      evaluateCondition(
        {
          field: "payee",
          operator: "contains",
          value: "Starbucks",
          negated: true,
        },
        values,
      ),
    ).toBe(false);
  });

  it("matches negated condition when inner check fails", () => {
    expect(
      evaluateCondition(
        {
          field: "payee",
          operator: "contains",
          value: "McDonalds",
          negated: true,
        },
        values,
      ),
    ).toBe(true);
  });

  it("treats missing negated as false", () => {
    expect(
      evaluateCondition(
        { field: "payee", operator: "contains", value: "Starbucks" },
        values,
      ),
    ).toBe(true);
  });
});

describe("evaluateRule", () => {
  const baseRule: Rule = {
    priority: 10,
    logic: "and",
    conditions: [
      {
        field: "payee",
        operator: "contains",
        value: "McDonalds",
        negated: true,
      },
    ],
    actions: [{ field: "category", value: "Not Fast Food" }],
  };

  it("applies negated conditions when evaluating a rule", () => {
    expect(
      evaluateRule(baseRule, { payee: "Starbucks Coffee" }),
    ).toBe(true);
  });

  it("does not match when negated condition inner check succeeds", () => {
    expect(evaluateRule(baseRule, { payee: "McDonalds" })).toBe(false);
  });
});
