import {
  DEFAULT_RULE_ACTION,
  DEFAULT_RULE_CONDITION,
  createDefaultRuleFormState,
} from "../../constants/app";

export {
  createDefaultRuleFormState,
  DEFAULT_RULE_CONDITION,
  DEFAULT_RULE_ACTION,
};

export function toRuleFormState(rule) {
  const conditions =
    rule.conditions?.length > 0
      ? rule.conditions
      : [
          {
            field: rule.match_field,
            operator: "equals",
            value: rule.match_pattern,
            negated: false,
          },
        ];

  const actions =
    rule.actions?.length > 0
      ? rule.actions
      : [{ field: rule.action_field, value: rule.action_value }];

  return {
    id: rule.id,
    priority: rule.priority,
    logic: rule.logic || "and",
    conditions,
    actions,
  };
}

export function toRulePayload(formState, rules) {
  const firstCondition = formState.conditions[0] || DEFAULT_RULE_CONDITION;
  const firstAction = formState.actions[0] || DEFAULT_RULE_ACTION;

  const payload = {
    match_field: firstCondition.field,
    match_pattern: firstCondition.value,
    action_field: firstAction.field,
    action_value: String(firstAction.value),
    logic: formState.logic,
    conditions: formState.conditions,
    actions: formState.actions.map((a) => ({ ...a, value: String(a.value) })),
  };

  const maxPriority =
    rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) : 0;

  return { payload, maxPriority };
}

export function reorderRules(rules, dragRuleId, targetIndex) {
  const dragIndex = rules.findIndex((r) => r.id === dragRuleId);
  if (dragIndex === -1 || dragIndex === targetIndex) {
    return rules;
  }

  const newItems = [...rules];
  const item = newItems[dragIndex];
  newItems.splice(dragIndex, 1);
  newItems.splice(targetIndex, 0, item);

  const total = newItems.length;
  return newItems.map((rule, idx) => ({ ...rule, priority: total - idx }));
}

export function isValuelessOperator(operator) {
  return operator === "is_empty" || operator === "is_not_empty";
}

export function isRegexOperator(operator) {
  return operator === "matches_regex" || operator === "not_matches_regex";
}

export function isValidRegex(pattern) {
  if (!pattern) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function formatCondition(condition, translate) {
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

export function formatAction(action, translate) {
  const fieldLabel = translate(`rules.field.${action.field}`) || action.field;
  return `${fieldLabel} = "${action.value}"`;
}
