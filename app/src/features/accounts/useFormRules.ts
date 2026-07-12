import { useEffect, useRef } from "react";
import {
  applyMatchingRules,
  type EvaluatableRule,
  type FormFieldTarget,
} from "../rules/rule-engine";

export function useFormRules(
  rules: EvaluatableRule[],
  fields: Record<string, FormFieldTarget>,
): void {
  const prevValues = useRef<Record<string, string>>({});

  const valueKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.value]),
    ),
  );

  useEffect(() => {
    const currentValues = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.value]),
    );
    applyMatchingRules(rules, currentValues, prevValues.current, fields);
    prevValues.current = currentValues;
    // fields identity changes each render; valueKey tracks value changes. Setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, valueKey]);
}
