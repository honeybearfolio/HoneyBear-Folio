import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "../../../components/ui/Modal";

describe("Modal Component", () => {
  it("renders children when open", () => {
    render(
      <Modal onClose={vi.fn()}>
        <div data-testid="modal-content">Hello Modal</div>
      </Modal>,
    );

    expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    expect(screen.getByText("Hello Modal")).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal onClose={handleClose}>
        <div>Content</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("applies correct size classes", () => {
    render(
      <Modal onClose={vi.fn()} size="xl">
        <div>Content</div>
      </Modal>,
    );
    const modalContainer = screen.getByRole("dialog");
    expect(modalContainer).toHaveClass("max-w-xl");
  });

  it("locks body scroll when open", () => {
    render(
      <Modal onClose={vi.fn()}>
        <div>Content</div>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("moves focus to the first focusable element when opened", () => {
    render(
      <Modal onClose={vi.fn()}>
        <button data-testid="btn-one">First</button>
        <button data-testid="btn-two">Second</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByTestId("btn-one"));
  });

  it("focuses the dialog container when there are no focusable children", () => {
    render(
      <Modal onClose={vi.fn()}>
        <p>No buttons here</p>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    render(
      <Modal onClose={vi.fn()}>
        <button data-testid="btn-one">First</button>
        <button data-testid="btn-two">Second</button>
      </Modal>,
    );
    const first = screen.getByTestId("btn-one");
    const last = screen.getByTestId("btn-two");
    last.focus();
    fireEvent.keyDown(last, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first focusable element back to the last", () => {
    render(
      <Modal onClose={vi.fn()}>
        <button data-testid="btn-one">First</button>
        <button data-testid="btn-two">Second</button>
      </Modal>,
    );
    const first = screen.getByTestId("btn-one");
    const last = screen.getByTestId("btn-two");
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the previously focused element when the modal closes", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open modal";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <Modal onClose={vi.fn()}>
        <button>Inside</button>
      </Modal>,
    );

    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
