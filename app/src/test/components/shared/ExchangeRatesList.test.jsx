import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExchangeRatesList from "../../../components/shared/ExchangeRatesList";

// Lightweight i18n mock for keys used by the component
vi.mock("../../../i18n/i18n", () => ({
  t: (k, opts) => {
    const map = {
      "settings.exchange_rates_empty": "No custom exchange rates configured.",
      "settings.exchange_rates_custom": "custom",
      "settings.exchange_rate_edit": "Edit rate",
      "settings.exchange_rate_delete": "Remove custom rate",
      "settings.exchange_rate_delete_confirm": `Remove custom rate for ${opts?.currency}?`,
      "confirm.save": "Save",
      "account.cancel": "Cancel",
    };
    return map[k] || k;
  },
}));

// Mock confirm context used for delete flow
const mockConfirm = vi.fn();
vi.mock("../../../contexts/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

// We'll provide a mutable in-memory store so multiple `invoke` calls
// behave like a small backend (get_all_exchange_rates, set_custom_exchange_rate, delete_custom_exchange_rate)
let inMemoryRates = [];
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd, args) => {
    if (cmd === "get_all_exchange_rates") {
      // return a shallow copy to emulate serialization
      return Promise.resolve(inMemoryRates.slice());
    }

    if (cmd === "set_custom_exchange_rate") {
      const { currency, rate } = args;
      const idx = inMemoryRates.findIndex((r) => r.currency === currency);
      if (idx >= 0) inMemoryRates[idx].rate = rate;
      else inMemoryRates.push({ currency, rate });
      return Promise.resolve();
    }

    if (cmd === "delete_custom_exchange_rate") {
      const { currency } = args;
      inMemoryRates = inMemoryRates.filter((r) => r.currency !== currency);
      return Promise.resolve();
    }

    return Promise.resolve(null);
  }),
}));

describe("ExchangeRatesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset store
    inMemoryRates = [];
  });

  it("shows empty state when there are no custom rates", async () => {
    inMemoryRates = [];
    render(<ExchangeRatesList />);

    expect(
      await screen.findByText(/No custom exchange rates configured\./i),
    ).toBeInTheDocument();
  });

  it("lists custom rates (sorted) and shows badges", async () => {
    inMemoryRates = [
      { currency: "EUR", rate: 0.987654 },
      { currency: "ABC", rate: 1.2345 },
    ];

    render(<ExchangeRatesList />);

    // should show both currencies in alphabetical order: ABC then EUR
    const rows = await screen.findAllByText(/custom/i);
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const abc = screen.getByText("ABC");
    const eur = screen.getByText("EUR");
    expect(abc).toBeInTheDocument();
    expect(eur).toBeInTheDocument();

    // values should be shown with 6 decimal places
    expect(screen.getByText("1.234500")).toBeInTheDocument();
    expect(screen.getByText("0.987654")).toBeInTheDocument();
  });

  it("allows editing a rate and calls backend then refreshes list", async () => {
    inMemoryRates = [{ currency: "GBP", rate: 1.1 }];
    const { invoke } = await import("@tauri-apps/api/core");

    render(<ExchangeRatesList />);

    // wait for row
    expect(await screen.findByText("GBP")).toBeInTheDocument();

    // click edit
    const editBtn = screen.getByRole("button", { name: /Edit rate/i });
    fireEvent.click(editBtn);

    // input should appear with current value
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(1.1);

    // change value and press Enter (save)
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      // set_custom_exchange_rate should have been called
      expect(invoke).toHaveBeenCalledWith("set_custom_exchange_rate", {
        currency: "GBP",
        rate: 2.5,
      });
    });

    // the displayed value should update (to 6 decimals)
    expect(await screen.findByText("2.500000")).toBeInTheDocument();
  });

  it("asks for confirmation and deletes a custom rate", async () => {
    inMemoryRates = [{ currency: "JPY", rate: 150.0 }];
    mockConfirm.mockResolvedValueOnce(true);
    const { invoke } = await import("@tauri-apps/api/core");

    render(<ExchangeRatesList />);

    expect(await screen.findByText("JPY")).toBeInTheDocument();

    const delBtn = screen.getByRole("button", { name: /Remove custom rate/i });
    fireEvent.click(delBtn);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("delete_custom_exchange_rate", {
        currency: "JPY",
      });
    });

    // ensure it's removed from the UI
    await waitFor(() => {
      expect(screen.queryByText("JPY")).not.toBeInTheDocument();
    });
  });
});
