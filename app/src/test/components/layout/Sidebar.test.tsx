import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Sidebar from "../../../components/layout/Sidebar";
import { usePrivacy } from "../../../stores/privacy";

// Mock dependencies
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

// Mock lucide icons
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

// Mock child components that might use contexts or API
vi.mock("../../../features/accounts/AccountModal", () => ({
  default: () => <div data-testid="AccountModal" />,
}));
vi.mock("../../../shared/ImportModal", () => ({
  default: () => <div data-testid="ImportModal" />,
}));
vi.mock("../../../shared/ExportModal", () => ({
  default: () => <div data-testid="ExportModal" />,
}));

vi.mock("../../../features/accounts/AccountList", () => ({
  default: () => <div data-testid="AccountList" />,
}));

const renderWithContext = (ui: React.ReactElement) => {
  return render(ui);
};

describe("Sidebar", () => {
  const mockTogglePrivacy = vi.fn();
  const mockOnSelectAccount = vi.fn();
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: false,
      togglePrivacyMode: mockTogglePrivacy,
    });
  });

  it("renders navigation links correctly", () => {
    renderWithContext(
      <Sidebar
        accounts={[]}
        onSelectAccount={mockOnSelectAccount}
        sidebarVisibility={defaultVisibility}
        marketValues={{}}
        selectedId=""
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Investments")).toBeInTheDocument();
    expect(screen.getByText("FIRE Calculator")).toBeInTheDocument();
    expect(screen.getAllByText("Rules").length).toBeGreaterThanOrEqual(1);
  });

  it("displays computed net worth", () => {
    renderWithContext(
      <Sidebar
        accounts={[]}
        onSelectAccount={mockOnSelectAccount}
        sidebarVisibility={defaultVisibility}
        marketValues={{}}
        totalBalance={12345.67}
        selectedId=""
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("fmt-12345.67")).toBeInTheDocument();
  });

  it("toggles privacy mode", () => {
    renderWithContext(
      <Sidebar
        accounts={[]}
        onSelectAccount={mockOnSelectAccount}
        sidebarVisibility={defaultVisibility}
        marketValues={{}}
        selectedId=""
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // The eye icon button
    const toggleBtn = screen.getByTitle("Hide values");
    fireEvent.click(toggleBtn);

    expect(mockTogglePrivacy).toHaveBeenCalled();
  });

  it("renders EyeOff when privacy mode is enabled", () => {
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: true,
      togglePrivacyMode: mockTogglePrivacy,
    });

    renderWithContext(
      <Sidebar
        accounts={[]}
        onSelectAccount={mockOnSelectAccount}
        sidebarVisibility={defaultVisibility}
        marketValues={{}}
        selectedId=""
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("EyeOff")).toBeInTheDocument();
  });

  it("navigates when clicking dashboard link", () => {
    renderWithContext(
      <Sidebar
        accounts={[]}
        onSelectAccount={mockOnSelectAccount}
        selectedId="investments"
        sidebarVisibility={defaultVisibility}
        marketValues={{}}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Dashboard"));
    expect(mockOnSelectAccount).toHaveBeenCalledWith("dashboard");
  });

  it("highlights active link", () => {
    // Need to check class names or active state style
    renderWithContext(
      <Sidebar
        accounts={[]}
        onSelectAccount={mockOnSelectAccount}
        selectedId="fire-calculator"
        sidebarVisibility={defaultVisibility}
        marketValues={{}}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const link = screen.getByText("FIRE Calculator").closest("button");
    expect(link!.className).toContain("sidebar-nav-item-active");
  });
});
