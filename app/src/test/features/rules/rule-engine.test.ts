import { describe, it, expect, vi } from "vitest";
import {
  evaluateCondition,
  evaluateRule,
  applyRuleActions,
  applyMatchingRules,
  type EvaluatableRule,
} from "../../../features/rules/rule-engine";

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

  it("matches regex operators case-insensitively", () => {
    expect(
      evaluateCondition(
        { field: "payee", operator: "matches_regex", value: "^star" },
        { payee: "Starbucks" },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { field: "payee", operator: "not_matches_regex", value: "^star" },
        { payee: "Starbucks" },
      ),
    ).toBe(false);
  });

  it("returns false for invalid regex patterns", () => {
    expect(
      evaluateCondition(
        { field: "payee", operator: "matches_regex", value: "[" },
        { payee: "test" },
      ),
    ).toBe(false);
  });
});

describe("evaluateRule", () => {
  const baseRule: EvaluatableRule = {
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
    expect(evaluateRule(baseRule, { payee: "Starbucks Coffee" })).toBe(true);
  });

  it("does not match when negated condition inner check succeeds", () => {
    expect(evaluateRule(baseRule, { payee: "McDonalds" })).toBe(false);
  });
});

describe("evaluateRule with multiple conditions", () => {
  const andRule: EvaluatableRule = {
    priority: 1,
    logic: "and",
    conditions: [
      { field: "payee", operator: "contains", value: "coffee" },
      { field: "amount", operator: "less_than", value: "20" },
    ],
    actions: [{ field: "category", value: "Coffee" }],
  };

  const orRule: EvaluatableRule = {
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
    expect(
      evaluateRule(orRule, { payee: "Employer", category: "Income" }),
    ).toBe(true);
  });

  it("does not match when no OR conditions are satisfied", () => {
    expect(evaluateRule(orRule, { payee: "Grocery", category: "Food" })).toBe(
      false,
    );
  });

  it("defaults to AND logic when logic is omitted", () => {
    const rule: EvaluatableRule = {
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

describe("applyRuleActions", () => {
  it("applies actions from the actions array", () => {
    const setCategory = vi.fn();
    const rule: EvaluatableRule = {
      priority: 1,
      conditions: [],
      actions: [{ field: "category", value: "Food" }],
    };

    applyRuleActions(rule, {
      category: { value: "", set: setCategory },
    });

    expect(setCategory).toHaveBeenCalledWith("Food");
  });

  it("skips set when value is already correct", () => {
    const setCategory = vi.fn();
    const rule: EvaluatableRule = {
      priority: 1,
      conditions: [],
      actions: [{ field: "category", value: "Food" }],
    };

    applyRuleActions(rule, {
      category: { value: "Food", set: setCategory },
    });

    expect(setCategory).not.toHaveBeenCalled();
  });

  it("falls back to legacy action_field/action_value", () => {
    const setPayee = vi.fn();
    const rule: EvaluatableRule = {
      priority: 1,
      action_field: "payee",
      action_value: "Rent",
    };

    applyRuleActions(rule, {
      payee: { value: "", set: setPayee },
    });

    expect(setPayee).toHaveBeenCalledWith("Rent");
  });
});

describe("applyMatchingRules", () => {
  it("applies rules only when field values change", () => {
    const setCategory = vi.fn();
    const rules: EvaluatableRule[] = [
      {
        priority: 10,
        conditions: [{ field: "payee", operator: "contains", value: "coffee" }],
        actions: [{ field: "category", value: "Coffee" }],
      },
    ];
    const fieldMap = {
      payee: { value: "Local Coffee", set: vi.fn() },
      category: { value: "", set: setCategory },
    };
    const previous = { payee: "", category: "" };
    const current = { payee: "Local Coffee", category: "" };

    applyMatchingRules(rules, current, previous, fieldMap);
    expect(setCategory).toHaveBeenCalledWith("Coffee");
  });

  it("does nothing when no fields changed", () => {
    const setCategory = vi.fn();
    const rules: EvaluatableRule[] = [
      {
        priority: 10,
        conditions: [{ field: "payee", operator: "contains", value: "coffee" }],
        actions: [{ field: "category", value: "Coffee" }],
      },
    ];
    const snapshot = { payee: "Local Coffee", category: "" };

    applyMatchingRules(rules, snapshot, snapshot, {
      payee: { value: "Local Coffee", set: vi.fn() },
      category: { value: "", set: setCategory },
    });

    expect(setCategory).not.toHaveBeenCalled();
  });
});
