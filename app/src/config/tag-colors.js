/**
 * Predefined color palette for category/tag badges.
 * Each entry maps a color key to Tailwind classes for light and dark mode.
 */
const TAG_COLORS = {
  slate: {
    bg: "bg-slate-100 dark:bg-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-600",
    dot: "bg-slate-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    dot: "bg-red-400",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-400",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-800",
    dot: "bg-yellow-400",
  },
  lime: {
    bg: "bg-lime-50 dark:bg-lime-900/30",
    text: "text-lime-700 dark:text-lime-300",
    border: "border-lime-200 dark:border-lime-800",
    dot: "bg-lime-400",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
    dot: "bg-green-400",
  },
  teal: {
    bg: "bg-teal-50 dark:bg-teal-900/30",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
    dot: "bg-teal-400",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
    dot: "bg-cyan-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-400",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    dot: "bg-indigo-400",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-400",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
    dot: "bg-pink-400",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-rose-400",
  },
};

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS);

export const DEFAULT_COLOR = "slate";
export const TRANSFER_DEFAULT_COLOR = "purple";

/**
 * Get the Tailwind badge classes for a given color key.
 * Returns combined bg + text + border classes.
 */
export function getColorClasses(colorKey) {
  const color = TAG_COLORS[colorKey] || TAG_COLORS[DEFAULT_COLOR];
  return `${color.bg} ${color.text} ${color.border}`;
}

/**
 * Get the dot class for a color key (used in color selector UI).
 */
export function getColorDot(colorKey) {
  const color = TAG_COLORS[colorKey] || TAG_COLORS[DEFAULT_COLOR];
  return color.dot;
}

export default TAG_COLORS;
