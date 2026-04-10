import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useToastStore } from "../../stores/toast";

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with an empty toasts array", () => {
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("showToast adds a toast with default type 'info'", () => {
    useToastStore.getState().showToast("Hello");
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Hello");
    expect(toasts[0].type).toBe("info");
    expect(toasts[0].id).toBeDefined();
  });

  it("showToast accepts a custom type", () => {
    useToastStore.getState().showToast("Saved!", { type: "success" });
    expect(useToastStore.getState().toasts[0].type).toBe("success");
  });

  it("showToast accepts error type", () => {
    useToastStore.getState().showToast("Oops", { type: "error" });
    expect(useToastStore.getState().toasts[0].type).toBe("error");
  });

  it("showToast returns a string id", () => {
    const id = useToastStore.getState().showToast("Hi");
    expect(typeof id).toBe("string");
  });

  it("removeToast removes the toast by id", () => {
    const id = useToastStore.getState().showToast("Hello");
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("removeToast ignores unknown ids", () => {
    useToastStore.getState().showToast("Hello");
    useToastStore.getState().removeToast("nonexistent-id");
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("toast auto-removes after duration", () => {
    useToastStore.getState().showToast("Temporary", { duration: 2000 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2001);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("toast with duration=0 does not auto-remove", () => {
    useToastStore.getState().showToast("Persistent", { duration: 0 });
    vi.advanceTimersByTime(10000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("multiple toasts accumulate", () => {
    useToastStore.getState().showToast("First");
    useToastStore.getState().showToast("Second");
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it("each toast gets a unique id", () => {
    const id1 = useToastStore.getState().showToast("A");
    const id2 = useToastStore.getState().showToast("B");
    expect(id1).not.toBe(id2);
  });
});
