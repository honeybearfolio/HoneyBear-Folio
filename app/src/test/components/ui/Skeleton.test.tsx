import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonTable,
  DashboardSkeleton,
  ListSkeleton,
  ErrorState,
} from "../../../components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders base skeleton with custom class", () => {
    const { container } = render(<Skeleton className="h-4 w-8" />);

    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("animate-pulse", "h-4", "w-8");
  });

  it("renders SkeletonCard with placeholder blocks", () => {
    const { container } = render(<SkeletonCard />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(3);
  });

  it("renders SkeletonChart with title and chart area", () => {
    const { container } = render(<SkeletonChart />);

    expect(container.querySelector(".h-64")).toBeInTheDocument();
  });

  it("renders SkeletonTable with default row count", () => {
    const { container } = render(<SkeletonTable />);

    expect(container.querySelectorAll(".flex.items-center.gap-4").length).toBe(6);
  });

  it("renders DashboardSkeleton layout sections", () => {
    const { container } = render(<DashboardSkeleton />);

    expect(container.querySelector(".summary-cards-grid") ?? container.querySelector(".grid")).toBeTruthy();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });

  it("renders ListSkeleton with optional title", () => {
    render(<ListSkeleton title="Accounts" />);

    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("renders ErrorState with retry action", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState title="Failed to load" message="Network error" onRetry={onRetry} />,
    );

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();

    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
