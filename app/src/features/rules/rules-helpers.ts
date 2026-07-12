import type { TFunction } from "i18next";
import type { RuleAction, RuleCondition, RuleRecord } from "../../api/types";
import {
  DEFAULT_RULE_ACTION,
  DEFAULT_RULE_CONDITION,
  type RuleFormState,
} from "../../constants/app";

type TranslateFn = TFunction;

export function toRuleFormState(rule: RuleRecord): RuleFormState {
  const conditions: RuleCondition[] =
    (rule.conditions?.length ?? 0) > 0
      ? rule.conditions!
      : [
          {
            field: rule.match_field ?? "",
            operator: "equals",
            value: rule.match_pattern ?? "",
            negated: false,
          },
        ];

  const actions: RuleAction[] =
    (rule.actions?.length ?? 0) > 0
      ? rule.actions!
      : [{ field: rule.action_field ?? "", value: rule.action_value ?? "" }];

  return {
    id: rule.id,
    priority: rule.priority,
    logic: rule.logic || "and",
    conditions,
    actions,
  };
}

export function toRulePayload(
  formState: RuleFormState,
  rules: RuleRecord[],
): { payload: Record<string, unknown>; maxPriority: number } {
  const firstCondition = formState.conditions[0] || DEFAULT_RULE_CONDITION;
  const firstAction = formState.actions[0] || DEFAULT_RULE_ACTION;

  const payload = {
    match_field: firstCondition.field,
    match_pattern: firstCondition.value,
    action_field: firstAction.field,
    action_value: firstAction.value,
    logic: formState.logic,
    conditions: formState.conditions,
    actions: formState.actions.map((a) => ({ ...a })),
  };

  const maxPriority =
    rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) : 0;

  return { payload, maxPriority };
}

export function reorderRules(
  rules: RuleRecord[],
  dragRuleId: number,
  targetIndex: number,
): (RuleRecord & { priority: number })[] {
  const dragIndex = rules.findIndex((r) => r.id === dragRuleId);
  if (dragIndex === -1 || dragIndex === targetIndex) {
    return rules;
  }

  const newItems = [...rules];
  const item = newItems[dragIndex]!;
  newItems.splice(dragIndex, 1);
  newItems.splice(targetIndex, 0, item);

  const total = newItems.length;
  return newItems.map((rule, idx) => ({ ...rule, priority: total - idx }));
}

export function isValuelessOperator(operator: string): boolean {
  return operator === "is_empty" || operator === "is_not_empty";
}

export function isRegexOperator(operator: string): boolean {
  return operator === "matches_regex" || operator === "not_matches_regex";
}

export function isValidRegex(pattern: string): boolean {
  if (!pattern) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function formatCondition(
  condition: RuleCondition,
  translate: TranslateFn,
): string {
  const fieldLabel =
    translate(`rules.field.${condition.field}`) || condition.field;
  const operatorLabel =
    translate(`rules.operator.${condition.operator}`) || condition.operator;
  if (isValuelessOperator(condition.operator)) {
    return `${fieldLabel} ${operatorLabel}`;
  }
  if (isRegexOperator(condition.operator)) {
    return `${fieldLabel} ${operatorLabel} /${condition.value}/`;
  }
  return `${fieldLabel} ${operatorLabel} "${condition.value}"`;
}

export function formatAction(
  action: RuleAction,
  translate: TranslateFn,
): string {
  const fieldLabel = translate(`rules.field.${action.field}`) || action.field;
  return `${fieldLabel} = "${action.value}"`;
}
