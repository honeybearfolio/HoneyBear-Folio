import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SummaryCards from "../../../features/dashboard/SummaryCards";

describe("SummaryCards", () => {
  it("renders net worth, account count, and transaction count", () => {
    render(
      <SummaryCards
        netWorth={12345.67}
        totalAccounts={3}
        totalTransactions={42}
      />,
    );

    expect(screen.getByText("Current Net Worth")).toBeInTheDocument();
    expect(screen.getByText("Total Accounts")).toBeInTheDocument();
    expect(screen.getByText("Total Transactions")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
