import {
  renderHook,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCustomRate } from "../../hooks/useCustomRate";
import { invoke } from "@tauri-apps/api/core";

// Mock dependencies — dialog mock now exposes confirm/cancel so the hook's
// promise-based flow can be tested end-to-end.
vi.mock("../../components/shared/CustomRateDialog", () => ({
  default: ({
    isOpen,
    currency,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    currency: string;
    onConfirm: (rate: number) => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="custom-rate-dialog">
        <div data-testid="custom-rate-currency">{currency}</div>
        <button
          data-testid="dialog-confirm"
          onClick={() => {
            onConfirm(2.5);
          }}
        >
          Confirm
        </button>
        <button
          data-testid="dialog-cancel"
          onClick={() => {
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    ) : null,
}));

describe("useCustomRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true immediately for USD or empty currency", async () => {
    const { result } = renderHook(() => useCustomRate());

    await expect(result.current.checkAndPrompt("USD")).resolves.toBe(true);
    await expect(result.current.checkAndPrompt("")).resolves.toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("checks backend for other currencies", async () => {
    // Setup: rate exists on backend
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "check_currency_availability") return Promise.resolve(false);
      if (cmd === "get_custom_exchange_rate") return Promise.resolve(1.2);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useCustomRate());

    await expect(result.current.checkAndPrompt("EUR")).resolves.toBe(true);

    expect(invoke).toHaveBeenCalledWith("check_currency_availability", {
      currency: "EUR",
    });
    expect(invoke).toHaveBeenCalledWith("get_custom_exchange_rate", {
      currency: "EUR",
    });
  });

  it("opens dialog if rate is missing and resolves after confirm", async () => {
    // Setup: rate MISSING on backend
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "check_currency_availability") return Promise.resolve(false);
      if (cmd === "get_custom_exchange_rate") return Promise.resolve(null);
      if (cmd === "set_custom_exchange_rate") return Promise.resolve();
      return Promise.resolve(null);
    });

    // Render a component that uses the hook so the dialog is mounted
    let resolvedValue: boolean | undefined = undefined;
    function TestComponent() {
      const { checkAndPrompt, dialog } = useCustomRate();
      return (
        <div>
          <button
            data-testid="trigger"
            onClick={() => {
              void checkAndPrompt("GBP").then((v) => {
                resolvedValue = v;
              });
            }}
          />
          {dialog}
        </div>
      );
    }

    render(<TestComponent />);

    // trigger the prompt and wait for the dialog to appear in the DOM
    fireEvent.click(screen.getByTestId("trigger"));

    const dialogEl = await screen.findByTestId("custom-rate-dialog");
    expect(dialogEl).toBeInTheDocument();
    expect(screen.getByTestId("custom-rate-currency")).toHaveTextContent("GBP");

    // confirm and assert the original promise resolved
    fireEvent.click(screen.getByTestId("dialog-confirm"));
    await waitFor(() => {
      expect(resolvedValue).toBe(true);
    });

    expect(invoke).toHaveBeenCalledWith("set_custom_exchange_rate", {
      currency: "GBP",
      rate: 2.5,
    });
  });
});
