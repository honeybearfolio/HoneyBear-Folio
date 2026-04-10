import { describe, it, expect, beforeEach } from "vitest";
import { useConfirmStore } from "../../stores/confirm";

describe("useConfirmStore", () => {
  beforeEach(() => {
    useConfirmStore.setState({
      isOpen: false,
      message: "",
      options: {},
      resolve: null,
    });
  });

  it("starts closed with no message", () => {
    const s = useConfirmStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.message).toBe("");
    expect(s.resolve).toBeNull();
  });

  it("confirm() opens the dialog and sets the message", async () => {
    const promise = useConfirmStore.getState().confirm("Delete item?");
    const s = useConfirmStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.message).toBe("Delete item?");
    useConfirmStore.getState().handleClose(true);
    await promise;
  });

  it("confirm() returns a promise that resolves true on OK", async () => {
    const promise = useConfirmStore.getState().confirm("Are you sure?");
    useConfirmStore.getState().handleClose(true);
    const result = await promise;
    expect(result).toBe(true);
  });

  it("confirm() returns a promise that resolves false on cancel", async () => {
    const promise = useConfirmStore.getState().confirm("Are you sure?");
    useConfirmStore.getState().handleClose(false);
    const result = await promise;
    expect(result).toBe(false);
  });

  it("handleClose closes the dialog", async () => {
    const promise = useConfirmStore.getState().confirm("Close me");
    useConfirmStore.getState().handleClose(true);
    await promise;
    expect(useConfirmStore.getState().isOpen).toBe(false);
    expect(useConfirmStore.getState().resolve).toBeNull();
  });

  it("confirm() accepts options", async () => {
    const opts = {
      title: "Confirm Delete",
      okLabel: "Yes",
      kind: "error" as const,
    };
    const promise = useConfirmStore.getState().confirm("Delete?", opts);
    expect(useConfirmStore.getState().options).toMatchObject(opts);
    useConfirmStore.getState().handleClose(false);
    await promise;
  });

  it("exposes confirm and handleClose actions", () => {
    const s = useConfirmStore.getState();
    expect(typeof s.confirm).toBe("function");
    expect(typeof s.handleClose).toBe("function");
  });
});
