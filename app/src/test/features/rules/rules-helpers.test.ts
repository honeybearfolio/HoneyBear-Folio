import { describe, it, expect } from "vitest";
import {
  toRuleFormState,
  toRulePayload,
  reorderRules,
  isValuelessOperator,
  isRegexOperator,
  isValidRegex,
  formatCondition,
  formatAction,
} from "../../../features/rules/rules-helpers";
import { createDefaultRuleFormState } from "../../../constants/app";
import type { RuleRecord } from "../../../api/types";

const t = (key: string) => key;

describe("rules-helpers", () => {
  it("toRuleFormState prefers explicit conditions and actions", () => {
    const rule: RuleRecord = {
      id: 1,
      priority: 2,
      logic: "or",
      match_field: "payee",
      match_pattern: "old",
      action_field: "category",
      action_value: "Food",
      conditions: [{ field: "payee", operator: "contains", value: "Coffee", negated: false }],
      actions: [{ field: "category", value: "Drinks" }],
    };

    const form = toRuleFormState(rule);
    expect(form.logic).toBe("or");
    expect(form.conditions[0]?.value).toBe("Coffee");
    expect(form.actions[0]?.value).toBe("Drinks");
  });

  it("toRuleFormState falls back to legacy match/action fields", () => {
    const form = toRuleFormState({
      id: 2,
      priority: 1,
      match_field: "payee",
      match_pattern: "Rent",
      action_field: "category",
      action_value: "Housing",
    } as RuleRecord);

    expect(form.conditions[0]).toMatchObject({
      field: "payee",
      operator: "equals",
      value: "Rent",
    });
    expect(form.actions[0]).toMatchObject({ field: "category", value: "Housing" });
  });

  it("toRulePayload builds API payload and max priority", () => {
    const form = createDefaultRuleFormState();
    form.conditions = [{ field: "payee", operator: "equals", value: "Salary", negated: false }];
    form.actions = [{ field: "category", value: "Income" }];
    form.logic = "and";

    const { payload, maxPriority } = toRulePayload(form, [
      { id: 1, priority: 5 } as RuleRecord,
      { id: 2, priority: 3 } as RuleRecord,
    ]);

    expect(payload.match_field).toBe("payee");
    expect(payload.match_pattern).toBe("Salary");
    expect(payload.action_field).toBe("category");
    expect(payload.action_value).toBe("Income");
    expect(maxPriority).toBe(5);
  });

  it("reorderRules moves item and reassigns priorities", () => {
    const rules = [
      { id: 1, priority: 3, name: "A" },
      { id: 2, priority: 2, name: "B" },
      { id: 3, priority: 1, name: "C" },
    ] as RuleRecord[];

    const reordered = reorderRules(rules, 1, 2);
    expect(reordered.map((r) => r.id)).toEqual([2, 3, 1]);
    expect(reordered[0]?.priority).toBe(3);
    expect(reordered[2]?.priority).toBe(1);
  });

  it("reorderRules returns original list when indices invalid", () => {
    const rules = [{ id: 1, priority: 1 }] as RuleRecord[];
    expect(reorderRules(rules, 99, 0)).toBe(rules);
    expect(reorderRules(rules, 1, 0)).toBe(rules);
  });

  it("detects valueless and regex operators", () => {
    expect(isValuelessOperator("is_empty")).toBe(true);
    expect(isValuelessOperator("equals")).toBe(false);
    expect(isRegexOperator("matches_regex")).toBe(true);
    expect(isValidRegex("(")).toBe(false);
    expect(isValidRegex("[a-z]+")).toBe(true);
    expect(isValidRegex("")).toBe(true);
  });

  it("formats conditions and actions for display", () => {
    expect(
      formatCondition(
        { field: "payee", operator: "is_empty", value: "", negated: false },
        t,
      ),
    ).toContain("rules.field.payee");

    expect(
      formatCondition(
        { field: "payee", operator: "matches_regex", value: "foo", negated: false },
        t,
      ),
    ).toContain("/foo/");

    expect(formatAction({ field: "category", value: "Food" }, t)).toContain(
      'category = "Food"',
    );
  });
});
