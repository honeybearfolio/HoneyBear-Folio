export const GOAL_COLORS = [
  "brand",
  "emerald",
  "sky",
  "amber",
  "rose",
  "violet",
] as const;

export interface GoalColorClasses {
  bar: string;
  dot: string;
  swatch: string;
}

const COLOR_CLASSES: Record<string, GoalColorClasses> = {
  brand: {
    bar: "bg-brand-500",
    dot: "bg-brand-500",
    swatch: "bg-brand-500",
  },
  emerald: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    swatch: "bg-emerald-500",
  },
  sky: {
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    swatch: "bg-sky-500",
  },
  amber: {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    swatch: "bg-amber-500",
  },
  rose: {
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    swatch: "bg-rose-500",
  },
  violet: {
    bar: "bg-violet-500",
    dot: "bg-violet-500",
    swatch: "bg-violet-500",
  },
};

const FALLBACK_COLOR: GoalColorClasses = {
  bar: "bg-brand-500",
  dot: "bg-brand-500",
  swatch: "bg-brand-500",
};

export function goalColorClasses(color: string): GoalColorClasses {
  return COLOR_CLASSES[color] ?? FALLBACK_COLOR;
}
