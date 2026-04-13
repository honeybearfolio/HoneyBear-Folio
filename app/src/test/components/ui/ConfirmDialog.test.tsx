import { describe, it, expect, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { ConfirmDialogContainer } from "../../../components/ui/ConfirmDialog";
import { useConfirmStore } from "../../../stores/confirm";

describe("ConfirmDialogContainer", () => {
  beforeEach(() => {
    useConfirmStore.setState({
      isOpen: false,
      message: "",
      options: {},
      resolve: null,
    });
  });

  it("shows dialog when confirm is called", async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      useConfirmStore.getState().confirm("Are you sure?");
    });

    expect(await screen.findByText("Are you sure?")).toBeInTheDocument();
  });

  it("resolves to true when confirmed", async () => {
    render(<ConfirmDialogContainer />);

    let result: boolean | undefined;
    act(() => {
      useConfirmStore
        .getState()
        .confirm("Are you sure?")
        .then((r) => {
          result = r;
        });
    });

    const confirmBtn = await screen.findByRole("button", { name: "OK" });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(result).toBe(true));
  });

  it("resolves to false when canceled", async () => {
    render(<ConfirmDialogContainer />);

    let result: boolean | undefined;
    act(() => {
      useConfirmStore
        .getState()
        .confirm("Are you sure?")
        .then((r) => {
          result = r;
        });
    });

    const cancelBtn = await screen.findByRole("button", { name: /cancel|no/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => expect(result).toBe(false));
  });

  it("focuses the Cancel button for destructive (warning) dialogs", async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      useConfirmStore
        .getState()
        .confirm("Delete this item?", { kind: "warning" });
    });

    const cancelBtn = await screen.findByRole("button", { name: /cancel/i });
    await waitFor(() => expect(document.activeElement).toBe(cancelBtn));
  });

  it("focuses the Cancel button for destructive (error) dialogs", async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      useConfirmStore
        .getState()
        .confirm("Delete this item?", { kind: "error" });
    });

    const cancelBtn = await screen.findByRole("button", { name: /cancel/i });
    await waitFor(() => expect(document.activeElement).toBe(cancelBtn));
  });

  it("focuses the OK button for non-destructive (info) dialogs", async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      useConfirmStore.getState().confirm("Proceed?", { kind: "info" });
    });

    const okBtn = await screen.findByRole("button", { name: "OK" });
    await waitFor(() => expect(document.activeElement).toBe(okBtn));
  });
});
