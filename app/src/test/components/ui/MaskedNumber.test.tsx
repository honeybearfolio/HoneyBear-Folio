import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MaskedNumber from "../../../components/ui/MaskedNumber";
import { usePrivacy } from "../../../contexts/privacy";
import { useFormatNumber } from "../../../utils/format";

// Mock hooks
vi.mock("../../../contexts/privacy", () => ({
  usePrivacy: vi.fn(),
}));

vi.mock("../../../utils/format", () => ({
  useFormatNumber: vi.fn(),
}));

describe("MaskedNumber", () => {
  const mockFormatNumber = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFormatNumber).mockReturnValue(mockFormatNumber);
  });

  it("renders the formatted number when privacy mode is off", () => {
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: false,
      togglePrivacyMode: vi.fn(),
    });
    mockFormatNumber.mockReturnValue("$1,234.56");

    render(<MaskedNumber value={1234.56} options={{ style: "currency" }} />);

    expect(mockFormatNumber).toHaveBeenCalledWith(1234.56, {
      style: "currency",
    });
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
    // Should not have title attribute or should not depend on it for basic rendering
    const span = screen.getByText("$1,234.56");
    if (span.tagName === "SPAN" && span.className === "") {
      // current impl renders fragment if no classname
      // If Fragment, we can't check attribute on text node.
      // The current implementation:
      /*
       if (className) { return <span className={className} ...>{formattedValue}</span> }
       return <>{formattedValue}</>;
       */
    }
  });

  it("does not reveal value on hover when privacy mode is on", () => {
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: true,
      togglePrivacyMode: vi.fn(),
    });

    mockFormatNumber.mockReturnValue("****");

    render(<MaskedNumber value={1234.56} options={{ style: "currency" }} />);

    const el = screen.getByText("****");
    expect(el).toBeInTheDocument();
    expect(el).not.toHaveAttribute("title"); // Should not have tooltip

    // Hover should NOT reveal the value
    fireEvent.mouseEnter(el);
    expect(el).toHaveTextContent("****");

    fireEvent.mouseLeave(el);
    expect(el).toHaveTextContent("****");
  });

  it("passes className and other props to the span", () => {
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: false,
      togglePrivacyMode: vi.fn(),
    });
    mockFormatNumber.mockReturnValue("123");

    render(
      <MaskedNumber
        value={123}
        className="text-red-500"
        data-testid="masked-number"
      />,
    );

    const el = screen.getByTestId("masked-number");
    expect(el).toHaveClass("text-red-500");
    expect(el).toHaveTextContent("123");
  });

  it("combines className with privacy mode span (no hover cursor classes)", () => {
    vi.mocked(usePrivacy).mockReturnValue({
      isPrivacyMode: true,
      togglePrivacyMode: vi.fn(),
    });
    mockFormatNumber.mockReturnValue("***");

    render(
      <MaskedNumber
        value={123}
        className="text-blue-500"
        data-testid="masked-number"
      />,
    );

    const el = screen.getByTestId("masked-number");
    expect(el).toHaveClass("text-blue-500");
    expect(el).not.toHaveClass("cursor-help");
    expect(el).not.toHaveClass("cursor-pointer");
    expect(el).toHaveTextContent("***");

    // Hover should NOT reveal the value
    fireEvent.mouseEnter(el);
    expect(el).toHaveTextContent("***");
  });
});
