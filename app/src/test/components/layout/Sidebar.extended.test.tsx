
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
}));

vi.mock("../../../features/accounts/AccountModal", () => ({
  default: () => <div data-testid="AccountModal" />,
}));

vi.mock("../../../components/shared/ImportModal", () => ({
  default: () => <div data-testid="ImportModal" />,
}));

vi.mock("../../../components/shared/ExportModal", () => ({
  default: () => <div data-testid="ExportModal" />,
}));

vi.mock("../../../features/accounts/AccountList", () => ({
  default: () => <div data-testid="AccountList" />,
}));

describe("Sidebar extended", () => {
  const mockOnSelectAccount = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSwitchSession = vi.fn();
  const mockOnChangeSettingsSection = vi.fn();

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
    accounts: [{ id: 1, name: "Checking", balance: 1000 }],
    marketValues: {},
    selectedId: "dashboard",
    onSelectAccount: mockOnSelectAccount,
    onUpdate: vi.fn(),
    onClose: mockOnClose,
    sidebarVisibility: defaultVisibility,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: false,
      togglePrivacyMode: vi.fn(),
    });
  });

  it("calls onClose when the hide sidebar button is clicked", () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("Hide Sidebar"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("navigates when overview links are clicked", () => {
    render(<Sidebar {...defaultProps} selectedId="dashboard" />);

    fireEvent.click(screen.getByText("Investments"));
    expect(mockOnSelectAccount).toHaveBeenCalledWith("investment-dashboard");

    fireEvent.click(screen.getByText("AI Assistant"));
    expect(mockOnSelectAccount).toHaveBeenCalledWith("chat");

    fireEvent.click(screen.getByText("Scheduled"));
    expect(mockOnSelectAccount).toHaveBeenCalledWith("scheduled");

    fireEvent.click(screen.getByText("All Transactions"));
    expect(mockOnSelectAccount).toHaveBeenCalledWith("all");
  });

  it("opens settings from the footer button", () => {
    render(<Sidebar {...defaultProps} selectedId="dashboard" />);

    const footerSettings = screen
      .getAllByText("Settings")
      .map((el) => el.closest("button"))
      .find((btn) => btn?.className.includes("sidebar-footer-button"));

    fireEvent.click(footerSettings!);
    expect(mockOnSelectAccount).toHaveBeenCalledWith("settings");
  });

  it("returns to dashboard from settings back button", () => {
    render(
      <Sidebar
        {...defaultProps}
        selectedId="settings"
        settingsSection="general"
        onChangeSettingsSection={mockOnChangeSettingsSection}
      />,
    );

    fireEvent.click(screen.getByText("Back"));
    expect(mockOnSelectAccount).toHaveBeenCalledWith("dashboard");
  });

  it("renders settings sub-navigation and switches sections", () => {
    render(
      <Sidebar
        {...defaultProps}
        selectedId="settings"
        settingsSection="general"
        onChangeSettingsSection={mockOnChangeSettingsSection}
      />,
    );

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Customization")).toBeInTheDocument();
    expect(screen.getByText("Formats")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Formats"));
    expect(mockOnChangeSettingsSection).toHaveBeenCalledWith("formats");
  });

  it("hides net worth card in settings mode", () => {
    render(
      <Sidebar
        {...defaultProps}
        selectedId="settings"
        totalBalance={9999}
        settingsSection="general"
        onChangeSettingsSection={mockOnChangeSettingsSection}
      />,
    );

    expect(screen.queryByText("Net Worth")).not.toBeInTheDocument();
  });

  it("shows active session and calls onSwitchSession when clicked", () => {
    render(
      <Sidebar
        {...defaultProps}
        activeSession={{ name: "My Portfolio", path: "/data/portfolio.hbf" }}
        onSwitchSession={mockOnSwitchSession}
      />,
    );

    expect(screen.getByText("My Portfolio")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Switch Session"));

    expect(mockOnSwitchSession).toHaveBeenCalledTimes(1);
  });

  it("does not render session switcher without activeSession", () => {
    render(<Sidebar {...defaultProps} onSwitchSession={mockOnSwitchSession} />);

    expect(screen.queryByTitle("Switch Session")).not.toBeInTheDocument();
  });
});
