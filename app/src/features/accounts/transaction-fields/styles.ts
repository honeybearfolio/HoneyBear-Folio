export type FieldVariant = "form" | "inline";

export function getInputClassName(variant: FieldVariant, extra = ""): string {
  const base =
    variant === "form"
      ? "form-input"
      : "w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none";
  return extra ? `${base} ${extra}` : base;
}

export function getLabelClassName(variant: FieldVariant): string {
  return variant === "form" ? "form-label" : "";
}
