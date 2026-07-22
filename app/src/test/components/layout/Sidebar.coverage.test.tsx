import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Sidebar from "../../../components/layout/Sidebar";
import { usePrivacy } from "../../../stores/privacy";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number) => `fmt-${String(val)}`,
}));

vi.mock("../../../stores/privacy", () => ({
  usePrivacy: vi.fn(),
}));

vi.mock("../../../stores/confirm", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../../api/tauri-client", () => ({
  rust: {
    rename_account: vi.fn().mockResolvedValue(undefined),
    delete_account: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  CreditCard: () => <span>CreditCard</span>,
  TrendingUp: () => <span>TrendingUp</span>,
  LayoutDashboard: () => <span>LayoutDashboard</span>,
  List: () => <span>List</span>,
  PieChart: () => <span>PieChart</span>,
  Calculator: () => <span>Calculator</span>,
  Download: () => <span>Download</span>,
  Upload: () => <span>Upload</span>,
  Settings: () => <span>Settings</span>,
  Eye: () => <span>Eye</span>,
  EyeOff: () => <span>EyeOff</span>,
  PanelLeftClose: () => <span>Close</span>,
  ArrowUpDown: () => <span>Sort</span>,
  BookOpenCheck: () => <span>Rules</span>,
  CalendarClock: () => <span>CalendarClock</span>,
  SlidersHorizontal: () => <span>SlidersHorizontal</span>,
  Brush: () => <span>Brush</span>,
  Globe: () => <span>Globe</span>,
  Info: () => <span>Info</span>,
  ArrowLeft: () => <span>ArrowLeft</span>,
  Bot: () => <span>Bot</span>,
  RefreshCw: () => <span>RefreshCw</span>,
  Gem: () => <span>Gem</span>,
  Scale: () => <span>Scale</span>,
}));

vi.mock("../../../features/accounts/AccountModal", () => ({
  default: () => <div data-testid="AccountModal" />,
}));

vi.mock("../../../components/shared/ImportModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ImportModal">
      <button onClick={onClose}>Close Import</button>
    </div>
  ),
}));

vi.mock("../../../components/shared/ExportModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ExportModal">
      <button onClick={onClose}>Close Export</button>
    </div>
  ),
}));

vi.mock("../../../features/accounts/AccountList", () => ({
  default: () => <div data-testid="AccountList" />,
}));

describe("Sidebar coverage", () => {
  const mockOnSelectAccount = vi.fn();
  const mockOnClose = vi.fn();
  const mockTogglePrivacy = vi.fn();

  const defaultVisibility = {
    dashboard: true,
    investments: true,
    fire: true,
    rules: true,
    scheduled: true,
    all: true,
    chat: true,
    assets: true,
  };

  const defaultProps = {
    accounts: [
      { id: 1, name: "Checking", balance: 1000, currency: "USD" },
      { id: 2, name: "Savings", balance: 5000, currency: "USD" },
    ],
    marketValues: { 1: 200 },
    selectedId: "dashboard",
    onSelectAccount: mockOnSelectAccount,
    onUpdate: vi.fn(),
    onClose: mockOnClose,
    sidebarVisibility: defaultVisibility,
    totalBalance: 6200,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: false,
      togglePrivacyMode: mockTogglePrivacy,
    });
  });

  it("navigates to dashboard, assets, fire calculator, and rules", () => {
    render(<Sidebar {...defaultProps} selectedId="investment-dashboard" />);

    const navButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.className.includes("sidebar-nav-item"));

    const clickNav = (label: string) => {
      const button = navButtons.find((btn) => btn.textContent.includes(label));
      fireEvent.click(button!);
    };

    clickNav("Dashboard");
    expect(mockOnSelectAccount).toHaveBeenCalledWith("dashboard");

    clickNav("Assets");
    expect(mockOnSelectAccount).toHaveBeenCalledWith("asset-tracker");

    clickNav("Liabilities");
    expect(mockOnSelectAccount).toHaveBeenCalledWith("liability-tracker");

    clickNav("FIRE Calculator");
    expect(mockOnSelectAccount).toHaveBeenCalledWith("fire-calculator");

    clickNav("Rules");
    expect(mockOnSelectAccount).toHaveBeenCalledWith("rules");
  });

  it("toggles privacy mode from the net worth card", () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("Hide values"));

    expect(mockTogglePrivacy).toHaveBeenCalledTimes(1);
  });

  it("shows net worth and collapses sidebar on mobile close button", () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText("Net worth")).toBeInTheDocument();
    expect(screen.getByText("fmt-6200")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Hide Sidebar"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("opens import and export modals from footer actions", () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText("Import"));
    expect(screen.getByTestId("ImportModal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close Import"));

    fireEvent.click(screen.getByText("Export"));
    expect(screen.getByTestId("ExportModal")).toBeInTheDocument();
  });

  it("opens account sort menu and applies balance descending sort", () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("Sort By"));

    expect(screen.getByText("Balance (High to Low)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Balance (High to Low)"));

    const stored = localStorage.getItem("hb_account_sort_config");
    expect(stored).toContain('"field":"balance"');
    expect(stored).toContain('"direction":"desc"');
  });

  it("opens add account modal from accounts section", () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("New Account"));
    expect(screen.getByTestId("AccountModal")).toBeInTheDocument();
  });

  it("shows privacy mode toggle as show values when privacy is enabled", () => {
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: true,
      togglePrivacyMode: mockTogglePrivacy,
    });

    render(<Sidebar {...defaultProps} />);

    expect(screen.getByLabelText("Show values")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show values"));
    expect(mockTogglePrivacy).toHaveBeenCalled();
  });
});
