import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomSelect from "../../../components/ui/CustomSelect";
import { Modal } from "../../../components/ui/Modal";

describe("CustomSelect", () => {
  const options = [
    { value: "opt1", label: "Option One" },
    { value: "opt2", label: "Option Two" },
    { value: "opt3", label: "Option Three" },
  ];

  it("renders placeholder when no value is selected", () => {
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );
    expect(screen.getByText("Select something")).toBeInTheDocument();
  });

  it("renders selected option label", () => {
    render(
      <CustomSelect
        value="opt2"
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );
    expect(screen.getByText("Option Two")).toBeInTheDocument();
  });

  it("opens menu on click and displays options", () => {
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );

    const trigger = screen.getByText("Select something");
    fireEvent.click(trigger);

    // Options are rendered in a portal, but screen queries should find them
    expect(screen.getAllByText("Option One")).toHaveLength(1);
    expect(screen.getAllByText("Option Two")).toHaveLength(1);
    expect(screen.getAllByText("Option Three")).toHaveLength(1);
  });

  it("calls onChange when an option is clicked", () => {
    const handleChange = vi.fn();
    render(
      <CustomSelect
        value=""
        onChange={handleChange}
        options={options}
        placeholder="Select something"
      />,
    );

    const trigger = screen.getByText("Select something");
    fireEvent.click(trigger);

    const option = screen.getByText("Option Two");
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith("opt2");
  });

  it("filters options when typing in search", async () => {
    const user = userEvent.setup();
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );

    const trigger = screen.getByText("Select something");
    await user.click(trigger);

    // Find search input and type "Two"
    const searchInput = screen.getByRole("textbox");
    await user.type(searchInput, "Two");

    expect(screen.getByText("Option Two")).toBeInTheDocument();
    expect(screen.queryByText("Option One")).not.toBeInTheDocument();
  });

  it("clears selection when value is not in options", () => {
    render(
      <CustomSelect
        value="opt99"
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );
    expect(screen.getByText("Select something")).toBeInTheDocument();
  });

  it("renders aria-label on trigger button when provided", () => {
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Select something"
        aria-label="Choose option"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Choose option" });
    expect(trigger).toHaveAttribute("aria-label", "Choose option");
  });

  it("renders aria-label on search input when menu is open", () => {
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );
    fireEvent.click(screen.getByText("Select something"));
    const searchInput = screen.getByRole("textbox");
    expect(searchInput).toHaveAttribute("aria-label");
  });

  it("supports Home and End keys for navigation", () => {
    const handleChange = vi.fn();
    render(
      <CustomSelect
        value=""
        onChange={handleChange}
        options={options}
        placeholder="Select something"
      />,
    );

    const trigger = screen.getByText("Select something");
    fireEvent.click(trigger);

    const searchInput = screen.getByRole("textbox");

    // Press End to go to last option
    fireEvent.keyDown(searchInput, { key: "End" });
    // Press Enter to select the last option
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(handleChange).toHaveBeenCalledWith("opt3");
  });

  it("allows searching when CustomSelect is inside a Modal without focus being stolen", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <Modal onClose={handleClose}>
        <input data-testid="modal-first-input" defaultValue="Initial" />
        <CustomSelect
          value=""
          onChange={() => {}}
          options={options}
          placeholder="Select an account"
        />
      </Modal>,
    );

    const trigger = screen.getByText("Select an account");
    await user.click(trigger);

    const searchInput = screen.getByRole("textbox", { name: "Search..." });

    // Verify search input is focused automatically
    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });

    // Type in search bar
    await user.type(searchInput, "Two");

    expect(searchInput).toHaveValue("Two");
    expect(screen.getByText("Option Two")).toBeInTheDocument();
    expect(screen.queryByText("Option One")).not.toBeInTheDocument();
  });

  it("closes dropdown and restores focus to trigger on Escape inside a Modal without closing the Modal", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <Modal onClose={handleClose}>
        <input data-testid="modal-first-input" />
        <CustomSelect
          value=""
          onChange={() => {}}
          options={options}
          placeholder="Select an account"
        />
      </Modal>,
    );

    const trigger = screen.getByRole("button", { name: "Select an account" });
    await user.click(trigger);

    const searchInput = screen.getByRole("textbox", { name: "Search..." });
    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });

    // Press Escape
    fireEvent.keyDown(searchInput, { key: "Escape" });

    // The modal should NOT have closed
    expect(handleClose).not.toHaveBeenCalled();
    // Dropdown options should be closed
    expect(
      screen.queryByRole("textbox", { name: "Search..." }),
    ).not.toBeInTheDocument();
    // Focus should be restored to trigger button
    expect(document.activeElement).toBe(trigger);
  });

  it("advances focus to next focusable element on Tab inside a Modal", async () => {
    const user = userEvent.setup();
    render(
      <Modal onClose={vi.fn()}>
        <input data-testid="before-input" />
        <CustomSelect
          value=""
          onChange={() => {}}
          options={options}
          placeholder="Select an account"
        />
        <input data-testid="after-input" />
      </Modal>,
    );

    const trigger = screen.getByRole("button", { name: "Select an account" });
    await user.click(trigger);

    const searchInput = screen.getByRole("textbox", { name: "Search..." });
    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });

    // Press Tab
    fireEvent.keyDown(searchInput, { key: "Tab" });

    // Dropdown closes and focus moves to next focusable element
    expect(
      screen.queryByRole("textbox", { name: "Search..." }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId("after-input"));
  });

  it("opens menu via ArrowDown key on trigger button", () => {
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={options}
        placeholder="Select something"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Select something" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(
      screen.getByRole("textbox", { name: "Search..." }),
    ).toBeInTheDocument();
  });
});
