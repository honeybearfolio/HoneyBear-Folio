import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ErrorBoundary from "../../../components/layout/ErrorBoundary";

// Mock i18n
vi.mock("../../../i18n/i18n", () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "error.something_went_wrong": "Something went wrong",
      "error.check_console": "Check the console for details",
      "error.show_details": "Show details",
      "error.copy": "Copy",
      "error.reload": "Reload",
    };
    return translations[key] || key;
  },
}));

// Component that throws an error
function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress console.error for expected errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello World</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test error" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("Check the console for details"),
    ).toBeInTheDocument();
  });

  it("shows error details when expanded", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Detailed error message" />
      </ErrorBoundary>,
    );

    // Click to expand details
    fireEvent.click(screen.getByText("Show details"));

    // Error stack should be visible
    expect(screen.getByText(/Detailed error message/)).toBeInTheDocument();
  });

  it("has a Copy button in error details", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Copy test" />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Show details"));

    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("has a Reload button in error details", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Reload test" />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Show details"));

    expect(screen.getByText("Reload")).toBeInTheDocument();
  });

  it("copies error to clipboard when Copy is clicked", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Clipboard test" />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Show details"));
    fireEvent.click(screen.getByText("Copy"));

    expect(mockWriteText).toHaveBeenCalled();
    expect(mockWriteText.mock.calls[0][0]).toContain("Clipboard test");
  });

  it("reloads page when Reload is clicked", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Reload test" />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Show details"));
    fireEvent.click(screen.getByText("Reload"));

    expect(window.location.reload).toHaveBeenCalled();

    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("logs error to console", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Console test" />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalledWith(
      "ErrorBoundary caught an error:",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("renders null children without error", () => {
    render(<ErrorBoundary>{null}</ErrorBoundary>);

    // Should not throw, component should be in document
    expect(document.body).toBeInTheDocument();
  });
});
