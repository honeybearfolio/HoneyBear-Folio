/**
 * Centralized frontend error handling.
 *
 * ## Conventions
 *
 * | Surface               | User feedback             | Logging    |
 * |-----------------------|---------------------------|------------|
 * | Full-page load        | `setError` → ErrorState   | `logError` |
 * | Mutations / actions   | `toast` with i18n message | `logError` |
 * | Background / optional | none                      | `logError` |
 *
 * Never pass raw `String(error)` to toasts — supply an i18n `userMessage` instead.
 * `toUserMessage` is for inline ErrorState detail text only.
 */

const IS_DEV = import.meta.env.DEV;

/** Log an error to the developer console (dev builds only). */
export function logError(context: string, error: unknown): void {
  if (IS_DEV) {
    console.error(`[${context}]`, error);
  }
}

/** Extract a human-readable message from an unknown thrown value. */
export function toUserMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) {
    return error.message.trim() || fallback;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    return message || fallback;
  }
  return fallback;
}

export interface HandleAsyncErrorOptions {
  /** Short label for dev console logs, e.g. `"Failed to fetch rules"`. */
  context: string;
  error: unknown;
  /** User-facing message for toasts (should be i18n-translated). */
  userMessage?: string;
  /** Show a toast notification with `userMessage`. */
  toast?: (message: string) => void;
  /** Set inline error state for full-page ErrorState surfaces. */
  setError?: (message: string) => void;
  /** Fallback when extracting detail text for `setError`. */
  detailFallback?: string;
}

/**
 * Handle a caught async error with consistent logging and user feedback.
 *
 * When both `toast` and `setError` are provided, the toast receives `userMessage`
 * while `setError` receives `toUserMessage(error)` for expandable detail.
 */
export function handleAsyncError({
  context,
  error,
  userMessage,
  toast,
  setError,
  detailFallback,
}: HandleAsyncErrorOptions): void {
  logError(context, error);

  if (setError) {
    setError(
      toUserMessage(error, detailFallback ?? userMessage ?? "Unknown error"),
    );
  }

  if (toast) {
    toast(userMessage ?? toUserMessage(error));
  }
}
