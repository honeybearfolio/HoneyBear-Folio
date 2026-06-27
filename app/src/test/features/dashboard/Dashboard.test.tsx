import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Dashboard from "../../../features/dashboard/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNumberFormatStore } from "../../../stores/number-format";

const emptyHoldings = { currentHoldings: [], firstTradeDate: null };

function mockDashboardInvoke(
  handler: (cmd: string) => Promise<unknown> | undefined,
) {
  return vi.mocked(invoke).mockImplementation((cmd: string) => {
    const result = handler(cmd);
    if (result !== undefined) return result;
    if (cmd === "build_holdings_from_transactions")
      return Promise.resolve(emptyHoldings);
    if (cmd === "compute_net_worth") return Promise.resolve(0);
    return Promise.resolve(null);
  });
}

// Mock dependencies
vi.mock("../../../i18n/i18n", () => ({ t: (k: string) => k }));
vi.mock("../../../hooks/useIsDark", () => ({ default: () => false }));

// Mock Chart.js components to avoid canvas errors
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

// Mock format utils
vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number) => `fmt-${String(val)}`,
  useFormatDate: () => (_date: unknown) => "formatted-date",
  getDatePickerFormat: () => "yyyy-MM-dd",
}));

// Mock child components
vi.mock("../../../features/dashboard/SankeyDiagram", () => ({
  default: () => <div data-testid="sankey">Sankey Diagram</div>,
}));
vi.mock("../../../components/ui/CustomSelect", () => ({
  default: () => <select data-testid="select" />,
}));

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNumberFormatStore.setState({
      dateFormat: "MM/dd/yyyy",
      firstDayOfWeek: 0,
      currency: "USD",
      locale: "en-US",
    });
  });

  it("fetches data and renders charts", async () => {
    // Mock data
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([
          {
            id: 1,
            date: "2023-01-01",
            amount: 100.0,
            payee: "Shop",
            category: "Food",
            account_id: 1,
            currency: "USD",
          },
        ]);
      if (cmd === "get_accounts")
        return Promise.resolve([
          { id: 1, name: "Checking", balance: 1000, currency: "USD" },
        ]);
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_all_transactions");
      expect(invoke).toHaveBeenCalledWith("get_accounts");
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  it("uses provided accounts prop if available", async () => {
    const propAccounts = [{ id: 99, name: "Prop Account", balance: 500 }];
    mockDashboardInvoke((cmd) => {
      if (cmd === "get_all_transactions") return Promise.resolve([]);
    });

    render(<Dashboard accounts={propAccounts} />);

    // Should fetch transactions but NOT accounts
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_all_transactions");
      expect(invoke).not.toHaveBeenCalledWith("get_accounts");
    });
  });
});
