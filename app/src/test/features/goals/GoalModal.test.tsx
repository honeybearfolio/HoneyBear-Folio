import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GoalModal from "../../../features/goals/GoalModal";
import type { Account, Goal } from "../../../api/types";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    "aria-label": ariaLabel,
  }: {
    value: string | number;
    onChange: (value: string | number) => void;
    options: { value: string | number; label: string }[];
    "aria-label"?: string;
  }) => (
    <select
      aria-label={ariaLabel}
      value={String(value)}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {typeof option.label === "string"
            ? option.label
            : String(option.value)}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("lucide-react", () => ({
  Trash2: () => <span>Delete</span>,
  X: () => <span>X</span>,
  Check: () => <span>Check</span>,
  ChevronDown: () => <span>Down</span>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockShowToast = vi.fn();
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockedInvoke = vi.mocked(invoke);

const accounts: Account[] = [
  { id: 1, name: "Savings", balance: 8000, currency: "USD" },
  { id: 2, name: "Brokerage", balance: 1500, currency: "USD" },
];

const holdingValues = {
  "1": { AAPL: 1000 },
  "2": { AAPL: 1800 },
};

const existing: Goal = {
  id: 4,
  name: "House",
  target_amount: 20000,
  currency: "EUR",
  target_date: "2028-12-31",
  monthly_contribution: 500,
  notes: "Down payment",
  color: "emerald",
  created_at: "2026-01-01",
  archived: false,
  exchange_rate: 1.1,
  links: [
    {
      id: 1,
      goal_id: 4,
      source_type: "account",
      account_id: 1,
      ticker: null,
      allocation_percent: 100,
    },
  ],
};

function renderModal(goal?: Goal) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <GoalModal
      {...(goal ? { goal } : {})}
      accounts={accounts}
      holdingValues={holdingValues}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { onClose, onSaved };
}

async function create() {
  const form = document.querySelector("form");
  expect(form).not.toBeNull();
  if (!form) return;
  fireEvent.submit(form);
  await waitFor(() => {
    expect(mockShowToast).toHaveBeenCalled();
  });
}

describe("GoalModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockResolvedValue(1);
  });

  it("rejects an empty name, a bad target, and a bad monthly contribution", async () => {
    const user = userEvent.setup();
    renderModal();

    await create();
    expect(mockShowToast).toHaveBeenCalledWith("Enter a name.", {
      type: "warning",
    });

    await user.type(screen.getByLabelText("Name"), "House");
    await user.type(screen.getByLabelText("Target amount"), "0");
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Enter a target greater than zero.",
      { type: "warning" },
    );

    fireEvent.change(screen.getByLabelText("Target amount"), {
      target: { value: "2000" },
    });
    fireEvent.change(screen.getByLabelText("Monthly contribution"), {
      target: { value: "0" },
    });
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Monthly contribution must be greater than zero.",
      { type: "warning" },
    );
  });

  it("rejects a bad allocation, a missing account, and a duplicate link", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText("Name"), "House");
    await user.type(screen.getByLabelText("Target amount"), "2000");
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );

    fireEvent.change(screen.getByLabelText("Allocation percent"), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText("Allocation percent")).toHaveValue(0);
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Allocation must be between 1 and 100.",
      { type: "warning" },
    );

    fireEvent.change(screen.getByLabelText("Allocation percent"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Select an account"), {
      target: { value: "" },
    });
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Choose an account for each account link.",
      { type: "warning" },
    );

    fireEvent.change(screen.getByLabelText("Select an account"), {
      target: { value: "1" },
    });
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "That account or investment is already linked.",
      { type: "warning" },
    );
  });

  it("rejects a holding without a ticker and a duplicated ticker", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText("Name"), "House");
    await user.type(screen.getByLabelText("Target amount"), "2000");
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );
    fireEvent.change(screen.getByLabelText("Funding type"), {
      target: { value: "holding" },
    });
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Choose an investment for each investment link.",
      { type: "warning" },
    );

    fireEvent.change(screen.getByLabelText("Select an investment"), {
      target: { value: "AAPL" },
    });
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );
    const fundingTypes = screen.getAllByLabelText("Funding type");
    const secondType = fundingTypes[1];
    expect(secondType).toBeDefined();
    if (!secondType) return;
    fireEvent.change(secondType, { target: { value: "holding" } });
    const tickers = screen.getAllByLabelText("Select an investment");
    const secondTicker = tickers[1];
    expect(secondTicker).toBeDefined();
    if (!secondTicker) return;
    fireEvent.change(secondTicker, { target: { value: "AAPL" } });
    await create();
    expect(mockShowToast).toHaveBeenCalledWith(
      "That account or investment is already linked.",
      { type: "warning" },
    );
  });

  it("saves a goal with an account, an investment, and a color", async () => {
    const user = userEvent.setup();
    const { onSaved } = renderModal();
    await user.type(screen.getByLabelText("Name"), "House");
    await user.type(screen.getByLabelText("Target amount"), "20000");
    fireEvent.change(screen.getByLabelText("Target date"), {
      target: { value: "2028-12-31" },
    });
    fireEvent.change(screen.getByLabelText("Monthly contribution"), {
      target: { value: "500" },
    });
    await user.type(screen.getByLabelText("Notes"), "Down payment");
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "EUR" },
    });
    await user.click(screen.getByRole("button", { name: "Green" }));
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );

    const fundingTypes = screen.getAllByLabelText("Funding type");
    const secondType = fundingTypes[1];
    expect(secondType).toBeDefined();
    if (!secondType) return;
    fireEvent.change(secondType, { target: { value: "holding" } });
    const accountSelects = screen.getAllByLabelText("Select an account");
    const holdingAccount = accountSelects[1];
    expect(holdingAccount).toBeDefined();
    if (!holdingAccount) return;
    fireEvent.change(holdingAccount, { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Select an investment"), {
      target: { value: "AAPL" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create goal" }));
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("create_goal", {
        args: {
          name: "House",
          targetAmount: 20000,
          currency: "EUR",
          targetDate: "2028-12-31",
          monthlyContribution: 500,
          notes: "Down payment",
          color: "emerald",
          links: [
            {
              sourceType: "account",
              accountId: 1,
              ticker: null,
              allocationPercent: 100,
            },
            {
              sourceType: "holding",
              accountId: 2,
              ticker: "AAPL",
              allocationPercent: 100,
            },
          ],
        },
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("warns before the overlap is real and can remove a link", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add account or investment" }),
    );
    const fundingTypes = screen.getAllByLabelText("Funding type");
    const secondType = fundingTypes[1];
    expect(secondType).toBeDefined();
    if (!secondType) return;
    fireEvent.change(secondType, { target: { value: "holding" } });
    expect(
      screen.getByText(
        "A linked investment is already included in a linked account. Both amounts are counted.",
      ),
    ).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", {
      name: "Remove funding",
    });
    const firstRemove = removeButtons[0];
    expect(firstRemove).toBeDefined();
    if (!firstRemove) return;
    fireEvent.click(firstRemove);
    expect(
      screen.queryByText(
        "A linked investment is already included in a linked account. Both amounts are counted.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No accounts or investments linked yet."),
    ).not.toBeInTheDocument();
  });

  it("updates an existing goal and reports a save failure", async () => {
    const user = userEvent.setup();
    const { onSaved, onClose } = renderModal(existing);
    expect(screen.getByLabelText("Name")).toHaveValue("House");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Cabin");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("update_goal", {
        args: {
          id: 4,
          archived: false,
          name: "Cabin",
          targetAmount: 20000,
          currency: "EUR",
          targetDate: "2028-12-31",
          monthlyContribution: 500,
          notes: "Down payment",
          color: "emerald",
          links: [
            {
              sourceType: "account",
              accountId: 1,
              ticker: null,
              allocationPercent: 100,
            },
          ],
        },
      });
    });
    expect(onSaved).toHaveBeenCalled();

    onSaved.mockClear();
    mockedInvoke.mockRejectedValueOnce(new Error("disk"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        "Failed to save. Please try again.",
        { type: "error" },
      );
    });
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
