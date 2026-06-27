import { useState } from "react";
import { rust } from "../api/tauri-client";
import CustomRateDialog from "../components/shared/CustomRateDialog";

interface CustomRateDialogState {
  isOpen: boolean;
  currency: string;
  resolve: ((value: boolean) => void) | null;
}

interface UseCustomRateReturn {
  checkAndPrompt: (currency: string) => Promise<boolean>;
  dialog: React.JSX.Element;
  isLoading: boolean;
}

export function useCustomRate(): UseCustomRateReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [dialogState, setDialogState] = useState<CustomRateDialogState>({
    isOpen: false,
    currency: "",
    resolve: null,
  });

  const checkAndPrompt = async (currency: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (!currency || currency === "USD") return true;

      let isAvailable = false;
      let existingRate: number | null = null;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => {
            reject(new Error("Currency check timed out"));
          },
          3000, // 3 second timeout
        ),
      );

      try {
        // Check availability
        isAvailable = await Promise.race([
          rust.check_currency_availability({ currency }),
          timeoutPromise,
        ]);

        // Check if we already have a custom rate
        existingRate = await rust.get_custom_exchange_rate({
          currency,
        });
      } catch (e) {
        console.error("Failed to check currency:", e);
        // Fall through to prompt
      }

      if (isAvailable || existingRate !== null) {
        return true;
      }

      // Need to prompt
      return await new Promise((resolve) => {
        setDialogState({
          isOpen: true,
          currency,
          resolve,
        });
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (rate: number): Promise<void> => {
    const { currency, resolve } = dialogState;
    try {
      await rust.set_custom_exchange_rate({ currency, rate });
      if (resolve) resolve(true);
    } catch (e) {
      console.error(e);
      if (resolve) resolve(false);
    }
    setDialogState({ isOpen: false, currency: "", resolve: null });
  };

  const handleCancel = (): void => {
    if (dialogState.resolve) dialogState.resolve(false);
    setDialogState({ isOpen: false, currency: "", resolve: null });
  };

  const dialog = (
    <CustomRateDialog
      isOpen={dialogState.isOpen}
      currency={dialogState.currency}
      onConfirm={(rate) => {
        void handleConfirm(rate);
      }}
      onCancel={handleCancel}
    />
  );

  return { checkAndPrompt, dialog, isLoading };
}
