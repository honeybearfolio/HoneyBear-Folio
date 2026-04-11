import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AccountList from "../../../features/accounts/AccountList";

// Mock dependencies
vi.mock("lucide-react", () => ({
  GripVertical: () => <span data-testid="grip-icon">::</span>,
  Banknote: () => <span data-testid="banknote-icon">$</span>,
  Edit: () => <span>Edit</span>,
  Trash2: () => <span>Delete</span>,
}));

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (v: number | string) => String(v),
}));

describe("AccountList", () => {
  const mockAccounts = [
    { id: "1", name: "Account A", balance: 1000, currency: "USD" },
    { id: "2", name: "Account B", balance: 2000, currency: "EUR" },
  ];

  it("renders list of accounts", () => {
    render(
      <AccountList
        accounts={mockAccounts}
        onSelectAccount={vi.fn()}
        Icon={() => <span>Icon</span>}
      />,
    );

    expect(screen.getByText("Account A")).toBeInTheDocument();
    expect(screen.getByText("Account B")).toBeInTheDocument();
  });

  it("handles drag and drop reordering", () => {
    const onReorder = vi.fn();
    render(
      <AccountList
        accounts={mockAccounts}
        onReorder={onReorder}
        isDraggable={true}
        onSelectAccount={vi.fn()}
        Icon={() => <span>Icon</span>}
      />,
    );

    // Find the grip icons or the list items
    // The items have draggable={true} (implied by implementation details usually found in map)
    // Wait, let's check AccountList implementation again for where draggable attribute is.
    // Assuming loop generates items.

    const accountA = screen
      .getByText("Account A")
      .closest('div[draggable="true"]');
    const accountB = screen
      .getByText("Account B")
      .closest('div[draggable="true"]');

    // Simulate Drag Start on Account A
    fireEvent.dragStart(accountA!, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: "move",
      },
    });

    // Simulate Drag Enter on Account B
    // We provide a timestamp > 50 to pass the throttle check
    fireEvent.dragEnter(accountB!, {
      dataTransfer: { dropEffect: "move" },
      timeStamp: 100,
    });

    // Check if onReorder was called with swapped array
    // Original: A (id 1), B (id 2)
    // Drag A to B -> B should be first, A second (splice logic)
    expect(onReorder).toHaveBeenCalled();
    const newItems = onReorder.mock.calls[0][0];
    expect(newItems[0].id).toBe("2");
    expect(newItems[1].id).toBe("1");
  });

  it("calls onSelectAccount when clicked", () => {
    const onSelectAccount = vi.fn();
    render(
      <AccountList
        accounts={mockAccounts}
        onSelectAccount={onSelectAccount}
        selectedId="2"
        Icon={() => <span>Icon</span>}
      />,
    );

    fireEvent.click(screen.getByText("Account A"));
    expect(onSelectAccount).toHaveBeenCalledWith("1");
  });

  it("right-clicking an account shows Rename and Delete in a context menu", async () => {
    const onRenameAccount = vi.fn();
    const onDeleteAccount = vi.fn();
    render(
      <AccountList
        accounts={mockAccounts}
        onSelectAccount={vi.fn()}
        Icon={() => <span>Icon</span>}
        onRenameAccount={onRenameAccount}
        onDeleteAccount={onDeleteAccount}
      />,
    );

    const accountItem = screen
      .getByText("Account A")
      .closest(".account-list-menu-container");
    fireEvent.contextMenu(accountItem!);

    await waitFor(() => {
      expect(
        document.querySelector(".account-list-menu-portal"),
      ).not.toBeNull();
    });
    const portal = document.querySelector(".account-list-menu-portal");
    expect(portal!.textContent).toContain("Rename");
    expect(portal!.textContent).toContain("Delete");
  });

  it("clicking Rename in context menu shows an inline input", async () => {
    const onRenameAccount = vi.fn();
    render(
      <AccountList
        accounts={mockAccounts}
        onSelectAccount={vi.fn()}
        Icon={() => <span>Icon</span>}
        onRenameAccount={onRenameAccount}
        onDeleteAccount={vi.fn()}
      />,
    );

    const accountItem = screen
      .getByText("Account A")
      .closest(".account-list-menu-container");
    fireEvent.contextMenu(accountItem!);

    await waitFor(() => {
      expect(
        document.querySelector(".account-list-menu-portal"),
      ).not.toBeNull();
    });

    const renameBtn = Array.from(
      document
        .querySelector(".account-list-menu-portal")!
        .querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Rename"));
    fireEvent.click(renameBtn!);

    const input = await screen.findByRole("textbox");
    expect((input as HTMLInputElement).value).toBe("Account A");

    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.submit(input.closest("form")!);

    expect(onRenameAccount).toHaveBeenCalledWith("1", "New Name");
  });

  it("clicking Delete in context menu calls onDeleteAccount", async () => {
    const onDeleteAccount = vi.fn();
    render(
      <AccountList
        accounts={mockAccounts}
        onSelectAccount={vi.fn()}
        Icon={() => <span>Icon</span>}
        onRenameAccount={vi.fn()}
        onDeleteAccount={onDeleteAccount}
      />,
    );

    const accountItem = screen
      .getByText("Account A")
      .closest(".account-list-menu-container");
    fireEvent.contextMenu(accountItem!);

    await waitFor(() => {
      expect(
        document.querySelector(".account-list-menu-portal"),
      ).not.toBeNull();
    });

    const deleteBtn = Array.from(
      document
        .querySelector(".account-list-menu-portal")!
        .querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Delete"));
    fireEvent.click(deleteBtn!);

    expect(onDeleteAccount).toHaveBeenCalledWith("1");
  });

  it("context menu closes when clicking outside", async () => {
    render(
      <AccountList
        accounts={mockAccounts}
        onSelectAccount={vi.fn()}
        Icon={() => <span>Icon</span>}
        onRenameAccount={vi.fn()}
        onDeleteAccount={vi.fn()}
      />,
    );

    const accountItem = screen
      .getByText("Account A")
      .closest(".account-list-menu-container");
    fireEvent.contextMenu(accountItem!);

    await waitFor(() => {
      expect(
        document.querySelector(".account-list-menu-portal"),
      ).not.toBeNull();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(document.querySelector(".account-list-menu-portal")).toBeNull();
    });
  });
});
