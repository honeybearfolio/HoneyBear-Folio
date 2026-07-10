import { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountHeader from "../../../features/accounts/AccountHeader";
import { useNumberFormatStore } from "../../../stores/number-format";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number, opts?: { style?: string }) =>
    opts?.style === "currency" ? `$${val.toFixed(2)}` : String(val),
}));

const account = {
  id: 1,
  name: "Main Checking",
  kind: "checking",
  balance: 2500,
  currency: "USD",
};

function renderHeader(overrides: Record<string, unknown> = {}) {
  const renameInputRef = createRef<HTMLInputElement>();
  const props = {
    account,
    isRenamingAccount: false,
    setIsRenamingAccount: vi.fn(),
    renameValue: account.name,
    setRenameValue: vi.fn(),
    handleRenameAccount: vi.fn().mockResolvedValue(undefined),
    renameInputRef,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    isAdding: false,
    setIsAdding: vi.fn(),
    accountMenuOpen: false,
    setAccountMenuOpen: vi.fn(),
    handleDeleteAccount: vi.fn(),
    availableAccounts: [
      { id: 2, name: "Savings", kind: "savings", currency: "USD" },
    ],
    ...overrides,
  };

  return {
    props,
    ...render(<AccountHeader {...props} />),
  };
}

describe("AccountHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNumberFormatStore.setState({ locale: "en-US", currency: "USD" });
  });

  it("renders account name", () => {
    renderHeader();

    expect(
      screen.getByRole("heading", { name: "Main Checking" }),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderHeader();

    expect(
      screen.getByPlaceholderText("Search transactions..."),
    ).toBeInTheDocument();
  });

  it("renders add transaction button", () => {
    renderHeader();

    expect(
      screen.getByRole("button", { name: /add transaction/i }),
    ).toBeInTheDocument();
  });

  it("calls setIsAdding when add transaction is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    expect(props.setIsAdding).toHaveBeenCalledWith(true);
  });

  it("calls setIsAdding(false) when cancel is clicked while adding", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isAdding: true });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(props.setIsAdding).toHaveBeenCalledWith(false);
  });

  it("renders rename mode with input instead of heading", () => {
    renderHeader({
      isRenamingAccount: true,
      renameValue: "Renamed Account",
    });

    expect(
      screen.queryByRole("heading", { name: "Main Checking" }),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Renamed Account")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Name" }),
    ).toBeInTheDocument();
  });

  it("opens account menu and calls handleDeleteAccount", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ accountMenuOpen: true });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(props.handleDeleteAccount).toHaveBeenCalled();
  });

  it("escape cancels rename and restores account name", () => {
    const setIsRenamingAccount = vi.fn();
    const setRenameValue = vi.fn();

    renderHeader({
      isRenamingAccount: true,
      renameValue: "Draft Name",
      setIsRenamingAccount,
      setRenameValue,
    });

    const renameInput = screen.getByDisplayValue("Draft Name");
    fireEvent.keyDown(renameInput, { key: "Escape" });

    expect(setIsRenamingAccount).toHaveBeenCalledWith(false);
    expect(setRenameValue).toHaveBeenCalledWith("Main Checking");
  });

  it("enters rename mode from account menu", async () => {
    const user = userEvent.setup();
    const setIsRenamingAccount = vi.fn();
    const setRenameValue = vi.fn();
    const setAccountMenuOpen = vi.fn();

    const { props } = renderHeader({
      setIsRenamingAccount,
      setRenameValue,
      setAccountMenuOpen,
    });

    const menuButtons = screen.getAllByRole("button");
    const moreButton = menuButtons.find(
      (btn) => !btn.textContent.includes("Add Transaction"),
    );
    expect(moreButton).toBeDefined();
    await user.click(moreButton!);

    expect(props.setAccountMenuOpen).toHaveBeenCalledWith(true);
  });
});
