import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Switch from "../../../components/ui/Switch";

describe("Switch", () => {
  it("calls onChange with toggled value when clicked", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={true} onChange={onChange} disabled />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reflects checked state via aria and styling", () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    rerender(<Switch checked={true} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("renders aria-label when provided", () => {
    render(
      <Switch
        checked={false}
        onChange={() => {}}
        aria-label="Toggle feature"
      />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute(
      "aria-label",
      "Toggle feature",
    );
  });
});
