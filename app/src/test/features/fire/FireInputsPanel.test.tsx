import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FireInputsPanel from "../../../features/fire/FireInputsPanel";

vi.mock("../../../components/ui/NumberInput", () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: number;
    onChange: (v: number) => void;
    placeholder?: string;
  }) => (
    <input
      type="text"
      role="textbox"
      aria-label={placeholder ?? "number"}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value) || 0);
      }}
    />
  ),
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: () => <select data-testid="custom-select" />,
}));

vi.mock("react-datepicker", () => ({
  default: () => <input data-testid="datepicker" />,
}));

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    currentNetWorth: 100000,
    setCurrentNetWorth: vi.fn(),
    annualExpenses: 40000,
    setAnnualExpenses: vi.fn(),
    annualSavings: 20000,
    setAnnualSavings: vi.fn(),
    expectedReturn: 7,
    setExpectedReturn: vi.fn(),
    inflation: 2,
    setInflation: vi.fn(),
    withdrawalRate: 4,
    setWithdrawalRate: vi.fn(),
    currentAge: 30,
    setCurrentAge: vi.fn(),
    retirementAge: 55,
    setRetirementAge: vi.fn(),
    retirementDuration: 30,
    setRetirementDuration: vi.fn(),
    showAdvanced: false,
    setShowAdvanced: vi.fn(),
    volatility: 15,
    setVolatility: vi.fn(),
    simulationCount: 1000,
    setSimulationCount: vi.fn(),
    markUserModified: vi.fn(),
    resetToHistoric: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<FireInputsPanel {...props} />) };
}

describe("FireInputsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders parameters heading and key input labels", () => {
    renderPanel();

    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText("Current Net Worth")).toBeInTheDocument();
    expect(screen.getByText("Annual Expenses")).toBeInTheDocument();
    expect(screen.getByText("Annual Savings")).toBeInTheDocument();
    expect(screen.getByText("Expected Annual Return")).toBeInTheDocument();
    expect(screen.getByText("Safe Withdrawal Rate")).toBeInTheDocument();
    expect(screen.getByText("Age & Timeline")).toBeInTheDocument();
  });

  it("renders reset button and calls resetToHistoric", () => {
    const { props } = renderPanel();

    const resetBtn = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(resetBtn);

    expect(props.resetToHistoric).toHaveBeenCalled();
  });

  it("updates current net worth on input change", () => {
    const { props } = renderPanel();
    const inputs = screen.getAllByRole("textbox");
    const netWorthInput = inputs[0]!;

    fireEvent.change(netWorthInput, { target: { value: "150000" } });

    expect(props.setCurrentNetWorth).toHaveBeenCalledWith(150000);
    expect(props.markUserModified).toHaveBeenCalledWith("currentNetWorth");
  });

  it("updates annual expenses on input change", () => {
    const { props } = renderPanel();
    const inputs = screen.getAllByRole("textbox");
    const expensesInput = inputs[1]!;

    fireEvent.change(expensesInput, { target: { value: "50000" } });

    expect(props.setAnnualExpenses).toHaveBeenCalledWith(50000);
    expect(props.markUserModified).toHaveBeenCalledWith("annualExpenses");
  });

  it("updates current age on input change", () => {
    const { props } = renderPanel();
    const inputs = screen.getAllByRole("textbox");
    const ageInput = inputs[6]!;

    fireEvent.change(ageInput, { target: { value: "35" } });

    expect(props.setCurrentAge).toHaveBeenCalledWith(35);
    expect(props.markUserModified).toHaveBeenCalledWith("currentAge");
  });

  it("toggles advanced parameters section", () => {
    const { props } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /show advanced/i }));

    expect(props.setShowAdvanced).toHaveBeenCalledWith(true);
  });

  it("shows advanced inputs when showAdvanced is true", () => {
    renderPanel({ showAdvanced: true });

    expect(screen.getByText("Return Volatility (Std Dev)")).toBeInTheDocument();
    expect(screen.getByText("Simulation Count")).toBeInTheDocument();
  });
});
