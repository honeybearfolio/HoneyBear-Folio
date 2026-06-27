import type { RuleCondition } from "../../api/types";
import type { Rule } from "./account-details-types";

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
  rule: Rule,
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
