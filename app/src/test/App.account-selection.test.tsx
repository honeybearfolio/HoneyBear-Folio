import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../App";

vi.mock("../api/tauri-client", () => ({
  rust: {
    get_active_session: vi.fn().mockResolvedValue({
      path: "/test/session.hbf",
      name: "Test Session",
      file_exists: true,
    }),
    get_accounts: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Checking",
        balance: 1000,
        kind: "bank",
        currency: "USD",
      },
    ]),
    get_total_assets_value: vi.fn().mockResolvedValue(0),
    get_total_liabilities_value: vi.fn().mockResolvedValue(0),
    compute_net_worth: vi.fn().mockResolvedValue(0),
    get_system_theme: vi.fn().mockResolvedValue("light"),
  },
}));

vi.mock("../utils/market-values", () => ({
  fetchMarketValuesForAccounts: vi.fn().mockResolvedValue({}),
}));

vi.mock("../components/layout/Sidebar", () => ({
  default: ({
    accounts,
    onSelectAccount,
  }: {
    accounts: { id: number; name: string }[];
    onSelectAccount: (id: number) => void;
  }) => (
    <div data-testid="sidebar">
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          onClick={() => {
            onSelectAccount(account.id);
          }}
        >
          {account.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../features/accounts/AccountDetails", () => ({
  default: ({ account }: { account: { name: string } }) => (
    <div data-testid="account-details">{account.name}</div>
  ),
}));

vi.mock("../features/dashboard/Dashboard", () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}));

vi.mock("../features/investments/InvestmentDashboard", () => ({
  default: () => <div data-testid="investment-dashboard" />,
}));

vi.mock("../features/fire/FireCalculator", () => ({
  default: () => <div data-testid="fire-calculator" />,
}));

vi.mock("../features/rules/RulesList", () => ({
  default: () => <div data-testid="rules-list" />,
}));

vi.mock("../features/scheduled/ScheduledList", () => ({
  default: () => <div data-testid="scheduled-list" />,
}));

vi.mock("../features/chat/ChatView", () => ({
  default: () => <div data-testid="chat-view" />,
}));

vi.mock("../features/settings/SettingsView", () => ({
  default: () => <div data-testid="settings-view" />,
}));

vi.mock("../features/assets/AssetTracker", () => ({
  default: () => <div data-testid="asset-tracker" />,
}));

vi.mock("../features/liabilities/LiabilityTracker", () => ({
  default: () => <div data-testid="liability-tracker" />,
}));

vi.mock("../components/shared/WelcomeWindow", () => ({
  default: () => null,
}));

vi.mock("../components/shared/DevTools", () => ({
  default: () => null,
}));

vi.mock("../components/shared/UpdateNotification", () => ({
  default: () => null,
}));

vi.mock("../components/shared/ChartNumberFormatSync", () => ({
  default: () => null,
}));

describe("App account selection", () => {
  beforeEach(() => {
    localStorage.setItem("hb_first_run_completed", "true");
    localStorage.setItem(
      "hb_sidebar_visibility",
      JSON.stringify({
        dashboard: true,
        investments: true,
        fire: true,
        rules: true,
        scheduled: true,
        all: true,
        chat: true,
        assets: true,
      }),
    );
  });

  it("renders AccountDetails when a numeric account id is selected", async () => {
    render(<App />);

    await waitFor(
      () => {
        expect(
          screen.getByRole("button", { name: "Checking" }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByRole("button", { name: "Checking" }));

    await waitFor(() => {
      expect(screen.getByTestId("account-details")).toHaveTextContent(
        "Checking",
      );
    });

    expect(
      screen.queryByText(
        "Select an account from the sidebar to view details, or create a new one to get started.",
      ),
    ).not.toBeInTheDocument();
  });
});
