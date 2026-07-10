import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountFilterPopover from "../../../features/dashboard/AccountFilterPopover";

const accounts = [
  {
    id: "acc1",
    name: "Checking",
    balance: 1000,
    currency: "USD",
    kind: "cash",
  },
  { id: "acc2", name: "Savings", balance: 5000, currency: "USD", kind: "cash" },
];

function renderPopover(overrides: Record<string, unknown> = {}) {
  const toggleAccountVisibility = vi.fn();
  const setAllAccountsVisibility = vi.fn();

  const props = {
    accounts,
    toggledAccounts: { acc1: true, acc2: true },
    selectedAccountIds: new Set(["acc1", "acc2"]),
    toggleAccountVisibility,
    setAllAccountsVisibility,
    marketValues: {},
    appCurrency: "USD",
    chartDatasets: [
      { accountId: "acc1", _color: "rgb(255, 0, 0)" },
      { accountId: "acc2", _color: "rgb(0, 255, 0)" },
    ],
    ...overrides,
  };

  return {
    props,
    toggleAccountVisibility,
    setAllAccountsVisibility,
    ...render(<AccountFilterPopover {...props} />),
  };
}

describe("AccountFilterPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders filter trigger button", () => {
    renderPopover();

    expect(
      screen.getByRole("button", { name: /accounts/i }),
    ).toBeInTheDocument();
  });

  it("shows badge when not all accounts are selected", () => {
    renderPopover({
      selectedAccountIds: new Set(["acc1"]),
      toggledAccounts: { acc1: true, acc2: false },
    });

    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("opens popover with account list on click", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: /accounts/i }));

    expect(screen.getByLabelText("Checking")).toBeInTheDocument();
    expect(screen.getByLabelText("Savings")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide all" }),
    ).toBeInTheDocument();
  });

  it("toggles account visibility via checkbox", async () => {
    const user = userEvent.setup();
    const { toggleAccountVisibility } = renderPopover();

    await user.click(screen.getByRole("button", { name: /accounts/i }));
    await user.click(screen.getByLabelText("Checking"));

    expect(toggleAccountVisibility).toHaveBeenCalledWith("acc1");
  });

  it("calls setAllAccountsVisibility for show/hide all", async () => {
    const user = userEvent.setup();
    const { setAllAccountsVisibility } = renderPopover();

    await user.click(screen.getByRole("button", { name: /accounts/i }));
    await user.click(screen.getByRole("button", { name: "Hide all" }));

    expect(setAllAccountsVisibility).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Show all" }));

    expect(setAllAccountsVisibility).toHaveBeenCalledWith(true);
  });

  it("closes popover when clicking outside", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: /accounts/i }));
    expect(screen.getByLabelText("Checking")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByLabelText("Checking")).not.toBeInTheDocument();
  });
});
