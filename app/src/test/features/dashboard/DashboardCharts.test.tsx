import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import NetWorthChart from "../../../features/dashboard/NetWorthChart";
import ExpensesByCategoryChart from "../../../features/dashboard/ExpensesByCategoryChart";
import IncomeVsExpensesChart from "../../../features/dashboard/IncomeVsExpensesChart";
import AssetAllocationChart from "../../../features/dashboard/AssetAllocationChart";
import type { ChartData, ChartOptions } from "chart.js";

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
}));

const lineOptions = {} as ChartOptions<"line">;
const doughnutOptions = {} as ChartOptions<"doughnut">;
const barOptions = {} as ChartOptions<"bar">;

const sampleLineData: ChartData<"line"> = {
  labels: ["Jan", "Feb"],
  datasets: [{ label: "Net Worth", data: [1000, 1200] }],
};

const sampleDoughnutData: ChartData<"doughnut"> = {
  labels: ["Food", "Rent"],
  datasets: [{ data: [300, 700] }],
};

const sampleBarData: ChartData<"bar"> = {
  labels: ["Jan", "Feb"],
  datasets: [
    { label: "Income", data: [5000, 5200] },
    { label: "Expenses", data: [3000, 3100] },
  ],
};

describe("Dashboard chart components", () => {
  describe("NetWorthChart", () => {
    it("shows loading state when chartData is null", () => {
      render(<NetWorthChart chartData={null} options={lineOptions} />);

      expect(screen.getByText("Net Worth Evolution")).toBeInTheDocument();
      expect(screen.getByText("Loading data...")).toBeInTheDocument();
      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });

    it("renders line chart when chartData is provided", () => {
      render(<NetWorthChart chartData={sampleLineData} options={lineOptions} />);

      expect(screen.getByText("Net Worth Evolution")).toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      expect(screen.queryByText("Loading data...")).not.toBeInTheDocument();
    });
  });

  describe("ExpensesByCategoryChart", () => {
    it("shows loading state when data is null", () => {
      render(
        <ExpensesByCategoryChart
          expensesByCategoryData={null}
          expensesOptions={doughnutOptions}
        />,
      );

      expect(screen.getByText("Expenses by Category")).toBeInTheDocument();
      expect(screen.getByText("Loading data...")).toBeInTheDocument();
      expect(screen.queryByTestId("doughnut-chart")).not.toBeInTheDocument();
    });

    it("shows empty state when data is marked empty", () => {
      render(
        <ExpensesByCategoryChart
          expensesByCategoryData={{ ...sampleDoughnutData, empty: true }}
          expensesOptions={doughnutOptions}
        />,
      );

      expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
      expect(screen.queryByTestId("doughnut-chart")).not.toBeInTheDocument();
    });

    it("renders doughnut chart when data is provided", () => {
      render(
        <ExpensesByCategoryChart
          expensesByCategoryData={sampleDoughnutData}
          expensesOptions={doughnutOptions}
        />,
      );

      expect(screen.getByText("Expenses by Category")).toBeInTheDocument();
      expect(screen.getByTestId("doughnut-chart")).toBeInTheDocument();
    });
  });

  describe("IncomeVsExpensesChart", () => {
    it("shows loading state when data is null", () => {
      render(
        <IncomeVsExpensesChart
          incomeVsExpensesData={null}
          barOptions={barOptions}
        />,
      );

      expect(screen.getByText("Income vs Expenses")).toBeInTheDocument();
      expect(screen.getByText("Loading data...")).toBeInTheDocument();
      expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    });

    it("renders bar chart when data is provided", () => {
      render(
        <IncomeVsExpensesChart
          incomeVsExpensesData={sampleBarData}
          barOptions={barOptions}
        />,
      );

      expect(screen.getByText("Income vs Expenses")).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });
  });

  describe("AssetAllocationChart", () => {
    it("shows loading state when doughnutData is null", () => {
      render(
        <AssetAllocationChart
          doughnutData={null}
          doughnutOptions={doughnutOptions}
        />,
      );

      expect(screen.getByText("Asset Allocation")).toBeInTheDocument();
      expect(screen.getByText("Loading data...")).toBeInTheDocument();
      expect(screen.queryByTestId("doughnut-chart")).not.toBeInTheDocument();
    });

    it("renders doughnut chart when doughnutData is provided", () => {
      render(
        <AssetAllocationChart
          doughnutData={sampleDoughnutData}
          doughnutOptions={doughnutOptions}
        />,
      );

      expect(screen.getByText("Asset Allocation")).toBeInTheDocument();
      expect(screen.getByTestId("doughnut-chart")).toBeInTheDocument();
    });
  });
});
