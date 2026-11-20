import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BudgetView from "../../../features/budget/BudgetView";
import { useNumberFormatStore } from "../../../stores/number-format";

vi.mock("../../../api/tauri-client", () => ({
  loadAllTransactions: vi.fn().mockResolvedValue([]),
  rust: {
    get_accounts: vi.fn().mockResolvedValue([]),
    get_categories: vi.fn().mockResolvedValue(["Groceries", "Dining"]),
  },
}));

describe("BudgetView", () => {
  beforeEach(() => {
    localStorage.clear();
    useNumberFormatStore.setState({ uiLanguage: "en", locale: "de-DE" });
  });

  it("formats the month name using the application language", async () => {
    render(<BudgetView />);

    const expectedMonth = new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
    }).format(new Date());
    expect(await screen.findByText(expectedMonth)).toBeInTheDocument();
  });

  it("offers existing categories and saves the selected budget", async () => {
    render(<BudgetView />);

    await screen.findByText("No category budgets yet");
    const categoryInput = screen.getByPlaceholderText("Category");
    fireEvent.focus(categoryInput);
    fireEvent.mouseDown(screen.getByText("Groceries"));
    expect(categoryInput).toHaveValue("Groceries");
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "250,50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add budget" }));

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("hb_budget_limits") ?? "{}"),
    ).toEqual({ Groceries: 250.5 });
  });
});
