import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Dashboard from "../../../features/dashboard/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNumberFormatStore } from "../../../stores/number-format";

const emptyHoldings = { currentHoldings: [], firstTradeDate: null };

const sampleAccounts = [
  { id: 1, name: "Checking", balance: 1000, currency: "USD" },
  { id: 2, name: "Savings", balance: 5000, currency: "USD" },
];

function recentDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sampleTransactions = [
  {
    id: 1,
    date: recentDate(5),
    amount: -50,
    payee: "Grocery",
    category: "Food",
    account_id: 1,
    currency: "USD",
  },
  {
    id: 2,
    date: recentDate(3),
    amount: 2000,
    payee: "Employer",
    category: "Salary",
    account_id: 2,
    currency: "USD",
  },
];

function getTransactionCount() {
  const card = screen.getByText("Total Transactions").closest(".summary-card");
  return card?.querySelector(".summary-card-value")?.textContent;
}

function mockDashboardInvoke(
  handler: (cmd: string) => Promise<unknown> | undefined,
) {
  return vi.mocked(invoke).mockImplementation((cmd: string) => {
    const result = handler(cmd);
    if (result !== undefined) return result;
    if (cmd === "build_holdings_from_transactions")
      return Promise.resolve(emptyHoldings);
    if (cmd === "compute_net_worth") return Promise.resolve(6000);
    return Promise.resolve(null);
  });
}

vi.mock("../../../hooks/useIsDark", () => ({ default: () => false }));

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
  ArcElement: {},
  BarElement: {},
}));

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number) => `fmt-${String(val)}`,
  useFormatDate: () => (_date: unknown) => "formatted-date",
  getDatePickerFormat: () => "yyyy-MM-dd",
}));

vi.mock("../../../features/dashboard/SankeyDiagram", () => ({
  default: () => <div data-testid="sankey">Sankey Diagram</div>,
}));

vi.mock("react-datepicker", () => ({
  default: (props: {
    selected?: Date;
    onChange: (date: Date | null) => void;
    "aria-label"?: string;
  }) => (
    <input
      data-testid="datepicker"
      aria-label={props["aria-label"]}
      value={props.selected ? props.selected.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        props.onChange(new Date(e.target.value));
      }}
    />
  ),
}));

describe("Dashboard extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNumberFormatStore.setState({
      dateFormat: "MM/dd/yyyy",
      firstDayOfWeek: 0,
      currency: "USD",
      locale: "en-US",
    });
  });

  it("shows empty state when there are no transactions", async () => {
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions") return Promise.resolve([]);
      if (cmd === "get_accounts") return Promise.resolve(sampleAccounts);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => {
      expect(screen.getByText("No transactions found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Add transactions to start tracking your finances and populate charts.",
        ),
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sankey")).not.toBeInTheDocument();
  });

  it("renders charts and sankey when transactions exist", async () => {
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => {
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("sankey")).toBeInTheDocument();
    });
  });

  it("changes time range when a preset button is clicked", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    const threeMonthBtn = screen.getByRole("button", { name: "3M" });
    expect(threeMonthBtn.className).not.toContain("time-range-button-active");

    await user.click(threeMonthBtn);

    expect(threeMonthBtn.className).toContain("time-range-button-active");
    expect(screen.getByRole("button", { name: "1Y" }).className).not.toContain(
      "time-range-button-active",
    );
  });

  it("shows custom date pickers when CUSTOM time range is selected", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    await user.click(screen.getByRole("button", { name: "Custom" }));

    expect(screen.getAllByTestId("datepicker")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Custom" }).className).toContain(
      "time-range-button-active",
    );
  });

  it("filters transactions when an account is deselected", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => {
      expect(getTransactionCount()).toBe("2");
    });

    await user.click(screen.getByRole("button", { name: /accounts/i }));
    await user.click(screen.getByLabelText("Savings"));

    await waitFor(() => {
      expect(getTransactionCount()).toBe("1");
    });
  });

  it("shows account filter badge when not all accounts are selected", async () => {
    const user = userEvent.setup();
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve(sampleTransactions);
    });

    render(<Dashboard accounts={sampleAccounts} />);

    await waitFor(() => screen.getByTestId("line-chart"));

    await user.click(screen.getByRole("button", { name: /accounts/i }));
    await user.click(screen.getByLabelText("Checking"));

    await waitFor(() => {
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });
  });
});
