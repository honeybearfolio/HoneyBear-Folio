import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock dependencies BEFORE import
vi.mock("react-chartjs-2", () => ({
  Chart: () => <div data-testid="sankey-chart">Sankey Chart</div>,
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
  useFormatNumber: () => (val: number) => `${val}`,
}));

// Provide a light NumberFormat context mock so the component can call
// `useNumberFormat()` without needing the provider in this unit test.
vi.mock("../../../stores/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    setLocale: () => {},
    currency: "USD",
    setCurrency: () => {},
    dateFormat: "YYYY-MM-DD",
    setDateFormat: () => {},
    firstDayOfWeek: 1,
    setFirstDayOfWeek: () => {},
    uiLanguage: "en",
    setUiLanguage: () => {},
  }),
}));

vi.mock("../../../i18n/i18n", () => ({
  t: (k: string) => k,
}));

vi.mock("../../../hooks/useIsDark", () => ({
  default: () => false,
}));

// Import component AFTER mocks
import SankeyDiagram from "../../../features/dashboard/SankeyDiagram";

describe("SankeyDiagram", () => {
  it("renders without crashing", () => {
    const transactions: never[] = [];
    render(
      <SankeyDiagram
        transactions={transactions}
        timeRange="1y"
        accountMap={{}}
        getPrice={() => undefined}
      />,
    );
    expect(true).toBe(true);
  });
});
