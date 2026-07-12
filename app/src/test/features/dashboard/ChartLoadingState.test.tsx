import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ChartLoadingState from "../../../features/dashboard/ChartLoadingState";

describe("ChartLoadingState", () => {
  it("renders default loading message", () => {
    render(<ChartLoadingState />);

    expect(screen.getByText("Loading data...")).toBeInTheDocument();
    expect(document.querySelector(".loading-container")).toBeInTheDocument();
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("renders custom message when provided", () => {
    render(<ChartLoadingState message="Fetching chart data..." />);

    expect(screen.getByText("Fetching chart data...")).toBeInTheDocument();
  });
});
