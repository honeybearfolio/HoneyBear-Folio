import { createContext, useContext } from "react";

type ConfirmKind = "info" | "warning" | "error";

export interface ConfirmOptions {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmKind;
  showCancel?: boolean;
}

export interface ConfirmContextValue {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): (message: string, options?: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback if provider is missing
    return () => Promise.resolve(false);
  }
  return ctx.confirm;
}
