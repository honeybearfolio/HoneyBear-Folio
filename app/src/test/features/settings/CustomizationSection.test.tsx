import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CustomizationSection from "../../../features/settings/CustomizationSection";
import { rust } from "../../../api/tauri-client";

const mockSetTheme = vi.fn();

vi.mock("../../../stores/theme", () => ({
  useTheme: () => ({ theme: "system", setTheme: mockSetTheme }),
}));

vi.mock("../../../api/tauri-client", () => ({
  rust: {
    get_categories: vi.fn(),
  },
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select
      data-testid="theme-select"
      aria-label={placeholder}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

describe("CustomizationSection", () => {
  const onChangeSidebarVisibility = vi.fn();
  const setFontSize = vi.fn();
  const showTooltip = vi.fn();
  const hideTooltip = vi.fn();

  const sidebarVisibility = {
    dashboard: true,
    investments: true,
    fire: true,
    rules: true,
    scheduled: true,
    all: true,
    chat: true,
    assets: true,
    liabilities: true,
  };

  const defaultProps = {
    sidebarVisibility,
    onChangeSidebarVisibility,
    showTooltip,
    hideTooltip,
    fontSize: 1,
    setFontSize,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(rust.get_categories).mockResolvedValue(["Food", "Rent"]);
  });

  it("renders theme, font size, and sidebar controls", () => {
    render(<CustomizationSection {...defaultProps} />);

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByTestId("theme-select")).toBeInTheDocument();
    expect(screen.getByText("Font size")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByText("Sidebar Items")).toBeInTheDocument();
    expect(screen.getByText("Tag Colors")).toBeInTheDocument();
  });

  it("calls setTheme when theme changes", async () => {
    const user = userEvent.setup();
    render(<CustomizationSection {...defaultProps} />);

    await user.selectOptions(screen.getByTestId("theme-select"), "dark");

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setFontSize when slider changes", () => {
    render(<CustomizationSection {...defaultProps} />);

    fireEvent.change(screen.getByRole("slider"), { target: { value: "1.1" } });

    expect(setFontSize).toHaveBeenCalledWith(1.1);
  });

  it("loads categories and allows tag color selection", async () => {
    const user = userEvent.setup();
    render(<CustomizationSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
      expect(screen.getByText("Rent")).toBeInTheDocument();
      expect(screen.getByText("Transfer")).toBeInTheDocument();
    });

    const redButtons = screen.getAllByRole("button", { name: "red" });
    await user.click(redButtons[0]!);

    expect(JSON.parse(localStorage.getItem("hb_tag_colors")!)).toEqual({
      Food: "red",
    });
  });

  it("toggles sidebar visibility via switch", async () => {
    const user = userEvent.setup();
    render(<CustomizationSection {...defaultProps} />);

    const dashboardSwitch = screen.getByRole("switch", { name: "Dashboard" });
    await user.click(dashboardSwitch);

    expect(onChangeSidebarVisibility).toHaveBeenCalledWith({
      ...sidebarVisibility,
      dashboard: false,
    });
  });
});
