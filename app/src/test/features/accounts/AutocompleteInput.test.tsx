import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AutocompleteInput from "../../../features/accounts/AutocompleteInput";

const suggestions = [
  { value: "Grocery Store", type: "payee" as const },
  { value: "Salary", type: "payee" as const },
  { value: "Savings", type: "account" as const },
];

describe("AutocompleteInput", () => {
  it("renders with placeholder and current value", () => {
    const onChange = vi.fn();
    render(
      <AutocompleteInput
        value="Gro"
        onChange={onChange}
        suggestions={suggestions}
        placeholder="Payee"
      />,
    );

    expect(screen.getByPlaceholderText("Payee")).toHaveValue("Gro");
  });

  it("filters suggestions as the user types", async () => {
    const user = userEvent.setup();

    function ControlledInput() {
      const [value, setValue] = useState("");
      return (
        <AutocompleteInput
          value={value}
          onChange={setValue}
          suggestions={suggestions}
          placeholder="Payee"
        />
      );
    }

    render(<ControlledInput />);

    const input = screen.getByPlaceholderText("Payee");
    await user.click(input);

    expect(screen.getByText("Grocery Store")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();

    await user.type(input, "sal");

    expect(screen.queryByText("Grocery Store")).not.toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("selects a suggestion on click", async () => {
    const onChange = vi.fn();
    render(
      <AutocompleteInput
        value=""
        onChange={onChange}
        suggestions={suggestions}
        placeholder="Payee"
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText("Payee"));
    fireEvent.mouseDown(screen.getByText("Grocery Store"));

    expect(onChange).toHaveBeenCalledWith("Grocery Store");
  });

  it("shows transfer badge for account suggestions", () => {
    render(
      <AutocompleteInput
        value=""
        onChange={vi.fn()}
        suggestions={suggestions}
        placeholder="Payee"
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText("Payee"));

    expect(screen.getByText("Transfer")).toBeInTheDocument();
  });

  it("respects disabled attribute on input", () => {
    render(
      <AutocompleteInput
        value=""
        onChange={vi.fn()}
        suggestions={suggestions}
        placeholder="Payee"
        disabled
      />,
    );

    expect(screen.getByPlaceholderText("Payee")).toBeDisabled();
  });
});
