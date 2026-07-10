import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockChart = vi.fn(
  ({ type, data }: { type: string; data: { datasets: unknown[] } }) => (
    <div data-testid="sankey-chart" data-type={type} data-flows={data.datasets.length}>
      Sankey Chart
    </div>
  ),
);

vi.mock("react-chartjs-2", () => ({
  Chart: (props: { type: string; data: { datasets: unknown[] } }) =>
    mockChart(props),
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  Tooltip: {},
  Legend: {},
  Title: {},
  LinearScale: {},
}));

vi.mock("chartjs-chart-sankey", () => ({
  SankeyController: {},
  Flow: {},
}));

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number) => String(val),
}));

vi.mock("../../../hooks/useIsDark", () => ({
  default: () => false,
}));

vi.mock("../../../hooks/useChartColors", () => ({
  default: () => ({
    secondary: "#888",
    success: "#0a0",
    loss: "#a00",
    text: "#333",
    tooltipBg: "#fff",
    tooltipText: "#000",
  }),
}));

import SankeyDiagram from "../../../features/dashboard/SankeyDiagram";

const accountMap = {
  1: { currency: "USD" },
};

function recentDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sampleTransactions = [
  {
    amount: 3000,
    category: "Salary",
    account_id: 1,
    date: recentDate(10),
  },
  {
    amount: -120,
    category: "Food",
    account_id: 1,
    date: recentDate(8),
  },
  {
    amount: -80,
    category: "Transport",
    account_id: 1,
    date: recentDate(6),
  },
];

describe("SankeyDiagram extended", () => {
  it("renders sankey chart with sample transaction data", () => {
    render(
      <SankeyDiagram
        transactions={sampleTransactions}
        timeRange="1Y"
        accountMap={accountMap}
        getPrice={() => 1}
        appCurrency="USD"
      />,
    );

    const chart = screen.getByTestId("sankey-chart");
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute("data-type", "sankey");
    expect(mockChart).toHaveBeenCalled();
  });

  it("shows empty state when there are no transactions", () => {
    render(
      <SankeyDiagram
        transactions={[]}
        timeRange="1Y"
        accountMap={accountMap}
        getPrice={() => 1}
        appCurrency="USD"
      />,
    );

    expect(screen.queryByTestId("sankey-chart")).not.toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(
      screen.getByText("No data available for this range"),
    ).toBeInTheDocument();
  });

  it("shows empty state when transactions fall outside the time range", () => {
    render(
      <SankeyDiagram
        transactions={[
          {
            amount: -50,
            category: "Food",
            account_id: 1,
            date: "2020-01-01",
          },
        ]}
        timeRange="1M"
        accountMap={accountMap}
        getPrice={() => 1}
        appCurrency="USD"
      />,
    );

    expect(screen.queryByTestId("sankey-chart")).not.toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders with custom date range props", () => {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();

    render(
      <SankeyDiagram
        transactions={sampleTransactions}
        timeRange="CUSTOM"
        customStartDate={start}
        customEndDate={end}
        accountMap={accountMap}
        getPrice={() => 1}
        appCurrency="USD"
      />,
    );

    expect(screen.getByTestId("sankey-chart")).toBeInTheDocument();
  });
});
