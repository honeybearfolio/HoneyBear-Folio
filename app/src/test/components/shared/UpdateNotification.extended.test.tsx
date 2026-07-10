import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdateNotification from "../../../components/shared/UpdateNotification";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue({ available: false }),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock("../../../config/dev-settings", () => ({
  getDevSetting: (key: string) => {
    if (key === "FORCE_SHOW_UPDATE_POPUP") return true;
    if (key === "FORCE_HIDE_UPDATE_POPUP") return false;
    return false;
  },
}));

describe("UpdateNotification extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows forced dev update popup and completes download flow", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UpdateNotification />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(await screen.findByText("Update Available")).toBeInTheDocument();
    expect(screen.getByText(/2\.0\.0-dev-test/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Update Now" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restart to Apply Update" }),
      ).toBeInTheDocument();
    });
  });

  it("toggles release notes section", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UpdateNotification />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    const notesToggle = await screen.findByRole("button", {
      name: "Show release notes",
    });
    await user.click(notesToggle);

    expect(screen.getByText(/Dev Test Update/)).toBeInTheDocument();
  });
});
