import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useToast } from "../../contexts/toast";
import { useToastStore } from "../../stores/toast";

// Test component to consume hook
function TestComponent() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Test message")}>Show Toast</button>
    </div>
  );
}

describe("useToast (Zustand store)", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("provides showToast without any provider", () => {
    render(<TestComponent />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("showToast does not throw when called", () => {
    const capturedShowToastRef: {
      current: ((...args: any[]) => void) | null;
    } = { current: null };
    function CaptureComponent() {
      const { showToast } = useToast();
      React.useEffect(() => {
        capturedShowToastRef.current = showToast;
      }, [showToast]);
      return null;
    }

    render(<CaptureComponent />);

    expect(() => capturedShowToastRef.current!("message")).not.toThrow();
  });

  it("showToast adds a toast to the store", () => {
    render(<TestComponent />);

    act(() => {
      screen.getByRole("button").click();
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe("Test message");
  });
});
