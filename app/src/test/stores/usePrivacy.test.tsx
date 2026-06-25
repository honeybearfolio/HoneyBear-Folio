import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { usePrivacy } from "../../stores/privacy";
import { usePrivacyStore } from "../../stores/privacy";

function TestComponent() {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  return (
    <div>
      <span data-testid="privacy-mode">{isPrivacyMode ? "on" : "off"}</span>
      <button onClick={togglePrivacyMode}>Toggle</button>
    </div>
  );
}

describe("usePrivacy (Zustand store)", () => {
  beforeEach(() => {
    usePrivacyStore.setState({ isPrivacyMode: false });
  });

  it("has isPrivacyMode defaulting to false", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("privacy-mode")).toHaveTextContent("off");
  });

  it("togglePrivacyMode toggles state", () => {
    render(<TestComponent />);
    screen.getByRole("button").click();
    expect(usePrivacyStore.getState().isPrivacyMode).toBe(true);
  });

  it("reflects isPrivacyMode when set to true", () => {
    usePrivacyStore.setState({ isPrivacyMode: true });
    render(<TestComponent />);
    expect(screen.getByTestId("privacy-mode")).toHaveTextContent("on");
  });

  it("can toggle privacy mode off", () => {
    usePrivacyStore.setState({ isPrivacyMode: false });
    render(<TestComponent />);
    expect(screen.getByTestId("privacy-mode")).toHaveTextContent("off");
  });
});
