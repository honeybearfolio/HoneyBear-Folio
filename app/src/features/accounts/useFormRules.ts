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
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const valueSnapshot = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.value]),
  );
  const valueKey = JSON.stringify(valueSnapshot);

  useEffect(() => {
    const fieldMap = fieldsRef.current;
    const currentValues = Object.fromEntries(
      Object.entries(fieldMap).map(([key, field]) => [key, field.value]),
    );
    applyMatchingRules(rules, currentValues, prevValues.current, fieldMap);
    prevValues.current = currentValues;
    // valueKey captures field value changes; field setters are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, valueKey]);
}
