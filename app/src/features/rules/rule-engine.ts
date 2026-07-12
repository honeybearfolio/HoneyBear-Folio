import type { RuleAction, RuleCondition } from "../../api/types";

/** Rule shape used for evaluation (with or without DB id). */
export interface EvaluatableRule {
  priority: number;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  logic?: string;
  match_field?: string;
  match_pattern?: string;
  action_field?: string;
  action_value?: string;
}

export type FormFieldTarget = {
  value: string;
  set: (value: string) => void;
};

export function evaluateCondition(
  condition: RuleCondition,
  values: Record<string, string>,
): boolean {
  const fieldValue = values[condition.field];
  const conditionValue = condition.value;
  const strFieldValue = fieldValue ?? "";
  const strCondValue = conditionValue;
  const numFieldValue = parseFloat(strFieldValue);
  const numCondValue = parseFloat(strCondValue);

  let matched: boolean;
  switch (condition.operator) {
    case "equals":
      matched = strFieldValue === strCondValue;
      break;
    case "not_equals":
      matched = strFieldValue !== strCondValue;
      break;
    case "contains":
      matched = strFieldValue
        .toLowerCase()
        .includes(strCondValue.toLowerCase());
      break;
    case "not_contains":
      matched = !strFieldValue
        .toLowerCase()
        .includes(strCondValue.toLowerCase());
      break;
    case "starts_with":
      matched = strFieldValue
        .toLowerCase()
        .startsWith(strCondValue.toLowerCase());
      break;
    case "ends_with":
      matched = strFieldValue
        .toLowerCase()
        .endsWith(strCondValue.toLowerCase());
      break;
    case "matches_regex":
    case "not_matches_regex": {
      try {
        const re = new RegExp(strCondValue, "i");
        const result = re.test(strFieldValue);
        matched = condition.operator === "not_matches_regex" ? !result : result;
      } catch {
        matched = false;
      }
      break;
    }
    case "greater_than":
      matched =
        !isNaN(numFieldValue) &&
        !isNaN(numCondValue) &&
        numFieldValue > numCondValue;
      break;
    case "less_than":
      matched =
        !isNaN(numFieldValue) &&
        !isNaN(numCondValue) &&
        numFieldValue < numCondValue;
      break;
    case "is_empty":
      matched = strFieldValue === "";
      break;
    case "is_not_empty":
      matched = strFieldValue !== "";
      break;
    default:
      matched = strFieldValue === strCondValue;
  }

  return condition.negated ? !matched : matched;
}

export function evaluateRule(
  rule: EvaluatableRule,
  values: Record<string, string>,
): boolean {
  if (rule.conditions && rule.conditions.length > 0) {
    const logic = rule.logic || "and";
    if (logic === "and") {
      return rule.conditions.every((cond) => evaluateCondition(cond, values));
    }
    return rule.conditions.some((cond) => evaluateCondition(cond, values));
  }

  return rule.match_field
    ? values[rule.match_field] === rule.match_pattern
    : false;
}

export function applyRuleActions(
  rule: EvaluatableRule,
  fieldMap: Record<string, FormFieldTarget>,
): void {
  if (rule.actions && rule.actions.length > 0) {
    rule.actions.forEach((action: RuleAction) => {
      const target = fieldMap[action.field];
      if (target && target.value !== action.value) {
        target.set(action.value);
      }
    });
    return;
  }

  if (rule.action_field) {
    const target = fieldMap[rule.action_field];
    if (target && target.value !== rule.action_value) {
      target.set(rule.action_value ?? "");
    }
  }
}

/** Apply rules when form field values change (highest priority first). */
export function applyMatchingRules(
  rules: EvaluatableRule[],
  currentValues: Record<string, string>,
  previousValues: Record<string, string>,
  fieldMap: Record<string, FormFieldTarget>,
): void {
  if (!rules.length) return;

  const changedFields = Object.keys(currentValues).filter(
    (key) => currentValues[key] !== previousValues[key],
  );
  if (changedFields.length === 0) return;

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedRules) {
    if (evaluateRule(rule, currentValues)) {
      applyRuleActions(rule, fieldMap);
    }
  }
}
