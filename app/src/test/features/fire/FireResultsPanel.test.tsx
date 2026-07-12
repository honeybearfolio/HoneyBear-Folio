import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import FireResultsPanel from "../../../features/fire/FireResultsPanel";
import type { ChartData } from "chart.js";
import type { MonteCarloResult } from "../../../features/fire/fire-types";
import {
  mockNumberFormat,
  renderWithStores,
} from "../../helpers/render";

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="fire-projection-chart">Chart</div>,
}));

vi.mock("../../../hooks/useChartColors", () => ({
  default: () => ({
    text: "#000",
    grid: "#ccc",
    tooltipBg: "#fff",
    tooltipText: "#000",
    primary: "#f98c07",
  }),
}));

vi.mock("../../../utils/format", async () => {
  const { createFormatUtilsMock, currencyFormatNumber } = await import(
    "../../helpers/format-mocks"
  );
  return createFormatUtilsMock({ formatNumber: currencyFormatNumber });
});

const chartData: ChartData<"line", number[], string> = {
  labels: ["2024", "2025", "2026"],
  datasets: [
    {
      label: "Projection",
      data: [100000, 150000, 200000],
    },
  ],
};

const monteCarloResult: MonteCarloResult = {
  successRate: 87.5,
  simulationCount: 2000,
  percentiles: {
    p10: [100000, 110000],
    p25: [120000, 130000],
    p50: [150000, 160000],
    p75: [180000, 190000],
    p90: [200000, 210000],
  },
};

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    fireNumber: 1000000,
    yearsToFire: 12,
    neverReached: false,
    fireAge: 42,
    monteCarloResult,
    chartData,
    ...overrides,
  };

  return renderWithStores(<FireResultsPanel {...props} />);
}

describe("FireResultsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNumberFormat();
  });

  it("renders key result labels", () => {
    renderPanel();

    expect(screen.getByText("FIRE Number")).toBeInTheDocument();
    expect(screen.getByText("Time to FIRE")).toBeInTheDocument();
    expect(screen.getByText("Retirement Age")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Monte Carlo")).toBeInTheDocument();
  });

  it("renders fire number and years to fire values", () => {
    renderPanel();

    expect(screen.getByText("$1,000,000")).toBeInTheDocument();
    expect(screen.getByText(/12 years/)).toBeInTheDocument();
    expect(screen.getByText("Age 42")).toBeInTheDocument();
    expect(screen.getByText("87.5%")).toBeInTheDocument();
  });

  it("shows unlikely to reach FIRE when neverReached is true", () => {
    renderPanel({ neverReached: true, fireAge: null });

    expect(screen.getByText("Unlikely to reach FIRE")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders projection chart and simulation count", () => {
    renderPanel();

    expect(screen.getByTestId("fire-projection-chart")).toBeInTheDocument();
    expect(screen.getByText("Projection")).toBeInTheDocument();
    expect(screen.getByText(/Simulations run: 2000/)).toBeInTheDocument();
  });

  it("shows dash for success rate when monte carlo result is null", () => {
    renderPanel({ monteCarloResult: null });

    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
