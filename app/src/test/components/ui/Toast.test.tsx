import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToastContainer } from "../../../components/ui/Toast";
import { useToastStore } from "../../../stores/toast";

describe("ToastContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders toast container element", () => {
    render(<ToastContainer />);
    const container = document.querySelector(".toast-container");
    expect(container).toBeInTheDocument();
  });

  it("shows info toast when showToast is called", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("Test message");
    });

    expect(screen.getByText("Test message")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("toast-info");
  });

  it("shows success toast with correct styling", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("Success!", { type: "success" });
    });

    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("toast-success");
  });

  it("shows error toast with correct styling", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("Error!", { type: "error" });
    });

    expect(screen.getByText("Error!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("toast-error");
  });

  it("auto-dismisses toast after duration", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("Test message");
    });

    expect(screen.getByText("Test message")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.queryByText("Test message")).not.toBeInTheDocument();
  });

  it("does not auto-dismiss when duration is 0", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("No auto-dismiss", { duration: 0 });
    });

    expect(screen.getByText("No auto-dismiss")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText("No auto-dismiss")).toBeInTheDocument();
  });

  it("removes toast when dismiss button is clicked", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("Test message");
    });

    expect(screen.getByText("Test message")).toBeInTheDocument();

    act(() => {
      screen.getByLabelText("Dismiss").click();
    });

    expect(screen.queryByText("Test message")).not.toBeInTheDocument();
  });

  it("shows multiple toasts simultaneously", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().showToast("Test message");
      useToastStore.getState().showToast("Success!", { type: "success" });
      useToastStore.getState().showToast("Error!", { type: "error" });
    });

    expect(screen.getByText("Test message")).toBeInTheDocument();
    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("Error!")).toBeInTheDocument();
  });

  it("returns toast id from showToast", () => {
    render(<ToastContainer />);

    let toastId: string | undefined;
    act(() => {
      toastId = useToastStore.getState().showToast("Test message");
    });

    expect(toastId).toBeDefined();
    expect(typeof toastId).toBe("string");
  });

  it("has accessible toast container", () => {
    render(<ToastContainer />);

    const container = document.querySelector(".toast-container");
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute("aria-atomic", "true");
    expect(container!.parentElement).toBe(document.body);
  });
});
