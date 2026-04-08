import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConfirm } from "../../contexts/confirm";
import { useConfirmStore } from "../../stores/confirm";

interface TestComponentProps {
  onResult: (result: boolean) => void;
}

// Test component to consume hook
function TestComponent({ onResult }: TestComponentProps) {
  const confirm = useConfirm();
  const handleClick = async () => {
    const result = await confirm("Test confirm?");
    onResult(result);
  };
  return <button onClick={handleClick}>Confirm</button>;
}

describe("useConfirm (Zustand store)", () => {
  beforeEach(() => {
    useConfirmStore.setState({
      isOpen: false,
      message: "",
      options: {},
      resolve: null,
    });
  });

  it("returns a confirm function without any provider", () => {
    render(<TestComponent onResult={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("confirm opens the dialog in the store", async () => {
    render(<TestComponent onResult={() => {}} />);
    screen.getByRole("button").click();

    await waitFor(() => {
      expect(useConfirmStore.getState().isOpen).toBe(true);
      expect(useConfirmStore.getState().message).toBe("Test confirm?");
    });
  });

  it("handleClose(true) resolves confirm to true", async () => {
    const onResult = vi.fn();
    render(<TestComponent onResult={onResult} />);
    screen.getByRole("button").click();

    await waitFor(() => {
      expect(useConfirmStore.getState().isOpen).toBe(true);
    });

    useConfirmStore.getState().handleClose(true);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(true);
    });
  });

  it("handleClose(false) resolves confirm to false", async () => {
    const onResult = vi.fn();
    render(<TestComponent onResult={onResult} />);
    screen.getByRole("button").click();

    await waitFor(() => {
      expect(useConfirmStore.getState().isOpen).toBe(true);
    });

    useConfirmStore.getState().handleClose(false);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(false);
    });
  });
});
