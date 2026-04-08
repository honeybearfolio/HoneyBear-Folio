import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RulesList from "../../../features/rules/RulesList";
import { invoke } from "@tauri-apps/api/core";

// Mock dependencies
vi.mock("../../../i18n/i18n", () => ({
  t: (key: string) => key,
}));

// Number formatting hooks are used by NumberInput — provide light mocks so
// RulesList can be exercised without wrapping providers.
vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (v: unknown) => (v == null ? "" : String(v)),
  useParseNumber: () => (s: string) => Number(s),
}));

// Provide a lightweight mock for the number-format context so components
// that call `useNumberFormat()` don't need the real provider in every test.
vi.mock("../../../contexts/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    setLocale: () => {},
    currency: "USD",
    setCurrency: () => {},
    dateFormat: "YYYY-MM-DD",
    setDateFormat: () => {},
    firstDayOfWeek: 1,
    setFirstDayOfWeek: () => {},
    uiLanguage: "en",
    setUiLanguage: () => {},
    translationVersion: 0,
  }),
}));

// Mock confirm context
const mockConfirm = vi.fn();
vi.mock("../../../contexts/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

// Mock icons
vi.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  Trash2: () => <span>Delete</span>,
  Edit: () => <span>Edit</span>,
  Save: () => <span>Save</span>,
  GripVertical: () => <span>Drag</span>,
  X: () => <span>X</span>,
}));

// Ensure Tauri `invoke` is mockable in all runners (extra-guard for CI/local differences)
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

// Mock CustomSelect
vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
        onChange(e.target.value)
      }
    >
      <option value="">{placeholder}</option>
      {options.map((opt: { value: string; label: string }) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

describe("RulesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders rules on mount", async () => {
    const mockRules = [
      {
        id: 1,
        priority: 1,
        match_field: "payee",
        match_pattern: "Uber",
        action_field: "category",
        action_value: "Transport",
      },
      {
        id: 2,
        priority: 2,
        match_field: "description",
        match_pattern: "Salary",
        action_field: "category",
        action_value: "Income",
      },
    ];

    vi.mocked(invoke).mockResolvedValueOnce(mockRules);

    render(<RulesList />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_rules");
    });

    expect(screen.getByText(/Uber/)).toBeInTheDocument();
    expect(screen.getByText(/Salary/)).toBeInTheDocument();
  });

  it("handles rule creation", async () => {
    vi.mocked(invoke).mockResolvedValue([]); // Initial fetch

    render(<RulesList />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // open the create-rule form (header Add button)
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    // Fill new rule form
    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const patternInput = within(conditionGroup!).getByPlaceholderText("Value");
    fireEvent.change(patternInput, { target: { value: "Netflix" } });

    const actionGroup = screen.getAllByText("rules.then_set")[0].closest("div");
    const valueInput = within(actionGroup!).getByPlaceholderText("Value");
    fireEvent.change(valueInput, { target: { value: "Entertainment" } });

    // Find submit/add button (disambiguate from other 'add' buttons)
    const addButton = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") === "submit");
    expect(addButton).toBeTruthy();
    fireEvent.click(addButton!);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_rule",
        expect.objectContaining({
          args: expect.objectContaining({
            match_pattern: "Netflix",
            action_value: "Entertainment",
          }),
        }),
      );
    });
  });

  it("handles rule deletion with confirmation", async () => {
    const mockRules = [
      {
        id: 10,
        priority: 1,
        match_field: "payee",
        match_pattern: "Test Rule",
        action_field: "category",
        action_value: "Test",
      },
    ];
    vi.mocked(invoke).mockResolvedValue(mockRules);
    mockConfirm.mockResolvedValue(true);

    render(<RulesList />);

    await waitFor(() =>
      expect(screen.getByText(/"Test Rule"/)).toBeInTheDocument(),
    );

    // Find delete button
    const deleteBtn = screen.getByText("Delete").closest("button");
    fireEvent.click(deleteBtn!);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("delete_rule", { id: 10 });
    });
  });

  it("reorders rules via drag and calls update_rules_order", async () => {
    const mockRules = [
      {
        id: 1,
        priority: 2,
        match_field: "A",
        match_pattern: "a",
        action_field: "category",
        action_value: "c",
      },
      {
        id: 2,
        priority: 1,
        match_field: "B",
        match_pattern: "b",
        action_field: "category",
        action_value: "d",
      },
    ];
    vi.mocked(invoke).mockResolvedValueOnce(mockRules); // initial fetch
    render(<RulesList />);

    await waitFor(() => expect(screen.getByText(/"a"/)).toBeInTheDocument());

    const rows = screen.getAllByRole("row");
    const firstRow = rows.find((r) => r.getAttribute("data-index") === "0");
    const secondRow = rows.find((r) => r.getAttribute("data-index") === "1");

    // create a basic DataTransfer mock
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(key: string, value: string) {
        this.data[key] = value;
      },
      getData(key: string) {
        return this.data[key];
      },
      effectAllowed: "move",
    };

    // drag the first row to position 1
    fireEvent.dragStart(firstRow!, { dataTransfer });
    fireEvent.dragEnter(secondRow!, {
      dataTransfer,
      timeStamp: Date.now() + 100,
    });
    fireEvent.dragEnd(firstRow!, { dataTransfer });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_rules_order", {
        ruleIds: [2, 1],
      });
    });
  });

  it("edits a legacy rule (populates form) and updates it", async () => {
    const legacy = {
      id: 11,
      priority: 2,
      match_field: "payee",
      match_pattern: "Old Payee",
      action_field: "category",
      action_value: "OldCat",
    };
    vi.mocked(invoke).mockResolvedValueOnce([legacy]);

    render(<RulesList />);

    await waitFor(() =>
      expect(screen.getByText(/"Old Payee"/)).toBeInTheDocument(),
    );

    // Click edit and assert form populated
    const editBtn = screen.getByText("Edit").closest("button");
    fireEvent.click(editBtn!);

    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const patternInput = within(conditionGroup!).getByPlaceholderText("Value");
    expect((patternInput as HTMLInputElement).value).toBe("Old Payee");

    const actionGroup = screen.getAllByText("rules.then_set")[0].closest("div");
    const actionInput = within(actionGroup!).getByPlaceholderText("Value");
    expect((actionInput as HTMLInputElement).value).toBe("OldCat");

    // Change values and submit
    fireEvent.change(patternInput, { target: { value: "New Payee" } });
    fireEvent.change(actionInput, { target: { value: "NewCat" } });

    const submit = screen.getByRole("button", { name: /rules.update/ });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "update_rule",
        expect.objectContaining({
          args: expect.objectContaining({
            id: 11,
            match_pattern: "New Payee",
            action_value: "NewCat",
          }),
        }),
      );
    });
  });

  it("adds/removes conditions & actions, toggles logic, and submits correct payload", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]); // initial fetch

    render(<RulesList />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // open the create-rule form
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    // Add a second condition
    const addCond = screen.getByRole("button", { name: /rules.add_condition/ });
    fireEvent.click(addCond);
    expect(screen.getAllByText("rules.if").length).toBe(2);

    // Logic selector should appear in the conditions header
    const logicContainer = screen.getByText(/rules\.logic\s*:/).closest("div");
    const logicSelect = within(logicContainer!).getByTestId("select");
    fireEvent.change(logicSelect, { target: { value: "or" } });

    // Fill both conditions and an action
    const conds = screen.getAllByText("rules.if");
    const firstCond = conds[0].closest("div");
    const firstPattern = within(firstCond!).getByPlaceholderText("Value");
    fireEvent.change(firstPattern, { target: { value: "A" } });

    const secondCond = conds[1].closest("div");
    const secondPattern = within(secondCond!).getByPlaceholderText("Value");
    fireEvent.change(secondPattern, { target: { value: "B" } });

    const actionGroup = screen.getAllByText("rules.then_set")[0].closest("div");
    const actionInput = within(actionGroup!).getByPlaceholderText("Value");
    fireEvent.change(actionInput, { target: { value: "SomeCat" } });

    // Submit while both conditions present and assert payload includes logic: 'or' and two conditions
    const submit = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") === "submit");
    expect(submit).toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_rule",
        expect.objectContaining({
          args: expect.objectContaining({
            logic: "or",
            conditions: expect.any(Array),
            actions: expect.any(Array),
          }),
        }),
      );
      const payload = (
        vi
          .mocked(invoke)
          .mock.calls.find((c) => c[0] === "create_rule")![1] as Record<
          string,
          unknown
        > as { args: { conditions: unknown[] } }
      ).args;
      expect(payload.conditions.length).toBe(2);
    });

    // Re-open create form to test add/remove UI (form closes after submit)
    const headerAddBtnAgain = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtnAgain) fireEvent.click(headerAddBtnAgain);

    await waitFor(() =>
      expect(screen.getAllByText("rules.if").length).toBeGreaterThan(0),
    );

    // Add then remove a condition and assert UI updates
    const addCond2 = screen.getByRole("button", {
      name: /rules.add_condition/,
    });
    fireEvent.click(addCond2);
    await waitFor(() => expect(screen.getAllByText("rules.if").length).toBe(2));

    const condsAfter = screen.getAllByText("rules.if");
    const secondCondAfter = condsAfter[1].closest("div");
    const removeBtns2 = within(secondCondAfter!).getByTitle(
      "rules.remove_condition",
    );
    fireEvent.click(removeBtns2);
    await waitFor(() => expect(screen.getAllByText("rules.if").length).toBe(1));

    // Add & remove action (UI) and assert updates
    const addAction = screen.getByRole("button", { name: /rules.add_action/ });
    fireEvent.click(addAction);
    await waitFor(() =>
      expect(screen.getAllByText("rules.then_set").length).toBe(2),
    );

    const removeActionBtn = within(
      screen.getAllByText("rules.then_set")[1].closest("div") as HTMLElement,
    ).getByTitle("rules.remove_action");
    fireEvent.click(removeActionBtn);
    await waitFor(() =>
      expect(screen.getAllByText("rules.then_set").length).toBe(1),
    );
  });

  it("supports numeric fields for condition and action (NumberInput) and stringifies action values", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);

    render(<RulesList />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // open the create-rule form
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    // there are two selects inside the condition: [0] = field, [1] = operator
    const selects = within(conditionGroup!).getAllByTestId("select");
    const fieldSelect = selects[0];
    // choose the numeric 'amount' field
    fireEvent.change(fieldSelect, { target: { value: "amount" } });

    const numInput = within(conditionGroup!).getByPlaceholderText("0.00");
    fireEvent.focus(numInput);
    fireEvent.change(numInput, { target: { value: "123.45" } });
    fireEvent.blur(numInput);

    const actionGroup = screen.getAllByText("rules.then_set")[0].closest("div");
    const actionInput = within(actionGroup!).getByPlaceholderText("Value");
    fireEvent.change(actionInput, { target: { value: "42" } });

    const submitBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") === "submit");
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_rule",
        expect.objectContaining({
          args: expect.objectContaining({
            match_pattern: "123.45",
            actions: expect.any(Array),
          }),
        }),
      );
      // action values are stringified by the component
      const payload = (
        vi
          .mocked(invoke)
          .mock.calls.find((c) => c[0] === "create_rule")![1] as Record<
          string,
          unknown
        > as { args: { actions: { value: string }[] } }
      ).args;
      expect(payload.actions[0].value).toBe("42");
    });
  });

  it("hides value input for valueless operators and submits empty matchPattern", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);

    render(<RulesList />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // open the create-rule form
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const operatorSelect = within(conditionGroup!).getAllByTestId("select")[1];
    // choose valueless operator
    fireEvent.change(operatorSelect, { target: { value: "is_empty" } });

    expect(within(conditionGroup!).queryByPlaceholderText("Value")).toBeNull();

    const submitBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") === "submit");
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_rule",
        expect.objectContaining({
          args: expect.objectContaining({ match_pattern: "" }),
        }),
      );
    });
  });

  it("reorders rules via drag and calls update_rules_order with new order", async () => {
    const mockRules = [
      {
        id: 1,
        priority: 2,
        match_field: "payee",
        match_pattern: "First",
        action_field: "category",
        action_value: "A",
      },
      {
        id: 2,
        priority: 1,
        match_field: "payee",
        match_pattern: "Second",
        action_field: "category",
        action_value: "B",
      },
    ];
    vi.mocked(invoke).mockResolvedValueOnce(mockRules);

    render(<RulesList />);

    await waitFor(() =>
      expect(screen.getByText(/"First"/)).toBeInTheDocument(),
    );

    const row1 = screen.getByText(/"First"/).closest("tr");
    const row2 = screen.getByText(/"Second"/).closest("tr");

    // minimal DataTransfer stub
    const dt = {
      data: {} as Record<string, string>,
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k];
      },
      dropEffect: "",
      effectAllowed: "move",
    };

    fireEvent.dragStart(row1!, { dataTransfer: dt, timeStamp: 0 });
    // simulate entering the second row (timeStamp increased to bypass throttle)
    fireEvent.dragEnter(row2!, { dataTransfer: dt, timeStamp: 200 });
    fireEvent.dragEnd(row1!, { dataTransfer: dt });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_rules_order", {
        ruleIds: [2, 1],
      });
    });
  });

  it("shows regex operators in the operator list for text fields", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    render(<RulesList />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // Open the create-rule form
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    // Regex operators should appear in the operator select for text fields
    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const operatorSelect = within(conditionGroup!).getAllByTestId("select")[1];
    const options = within(operatorSelect).getAllByRole("option");
    const optionValues = options.map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toContain("matches_regex");
    expect(optionValues).toContain("not_matches_regex");
  });

  it("shows validation error for invalid regex and disables submit", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    render(<RulesList />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // Open the create-rule form
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    // Select matches_regex operator
    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const operatorSelect = within(conditionGroup!).getAllByTestId("select")[1];
    fireEvent.change(operatorSelect, { target: { value: "matches_regex" } });

    // Enter invalid regex
    const patternInput = within(conditionGroup!).getByPlaceholderText(
      "^pattern.*$",
    );
    fireEvent.change(patternInput, { target: { value: "[invalid" } });

    // Should show validation error
    expect(screen.getByText("rules.regex_invalid")).toBeInTheDocument();

    // Submit button should be disabled
    const submitBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") === "submit");
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("allows submit with valid regex pattern", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    render(<RulesList />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // Open the create-rule form
    const headerAddBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") !== "submit");
    if (headerAddBtn) fireEvent.click(headerAddBtn);

    // Select matches_regex operator
    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const operatorSelect = within(conditionGroup!).getAllByTestId("select")[1];
    fireEvent.change(operatorSelect, { target: { value: "matches_regex" } });

    // Enter valid regex
    const patternInput = within(conditionGroup!).getByPlaceholderText(
      "^pattern.*$",
    );
    fireEvent.change(patternInput, { target: { value: "^Star.*Coffee$" } });

    // Should show help text as title, not error
    expect(screen.queryByText("rules.regex_invalid")).toBeNull();
    expect(patternInput.getAttribute("title")).toBe("rules.regex_help");

    // Fill action value
    const actionGroup = screen.getAllByText("rules.then_set")[0].closest("div");
    const actionInput = within(actionGroup!).getByPlaceholderText("Value");
    fireEvent.change(actionInput, { target: { value: "Coffee" } });

    // Submit button should be enabled
    const submitBtn = screen
      .getAllByRole("button", { name: /rules.add/ })
      .find((b) => b.getAttribute("type") === "submit");
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_rule",
        expect.objectContaining({
          args: expect.objectContaining({
            conditions: expect.arrayContaining([
              expect.objectContaining({
                operator: "matches_regex",
                value: "^Star.*Coffee$",
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("renders regex operator correctly when editing a rule with regex", async () => {
    const regexRule = {
      id: 20,
      priority: 1,
      match_field: "payee",
      match_pattern: "",
      action_field: "category",
      action_value: "",
      logic: "and",
      conditions: [
        {
          field: "payee",
          operator: "matches_regex",
          value: "^Star.*$",
          negated: false,
        },
      ],
      actions: [{ field: "category", value: "Coffee" }],
    };
    vi.mocked(invoke).mockResolvedValueOnce([regexRule]);
    render(<RulesList />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // Click edit
    const editBtn = screen.getByText("Edit").closest("button");
    fireEvent.click(editBtn!);

    // The regex operator should be visible and selected
    const conditionGroup = screen.getAllByText("rules.if")[0].closest("div");
    const operatorSelect = within(conditionGroup!).getAllByTestId("select")[1];
    expect((operatorSelect as HTMLSelectElement).value).toBe("matches_regex");
  });

  it("right-clicking a rule row opens a context menu with Edit and Delete", async () => {
    const rule = {
      id: 1,
      priority: 1,
      match_field: "payee",
      match_pattern: "Coffee",
      action_field: "category",
      action_value: "Drinks",
      logic: "and",
      conditions: [{ field: "payee", operator: "contains", value: "Coffee" }],
      actions: [{ field: "category", value: "Drinks" }],
    };
    vi.mocked(invoke).mockResolvedValueOnce([rule]);
    render(<RulesList />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // The condition badge renders: "rules.field.payee rules.operator.contains "Coffee""
    const conditionBadge = await screen.findByText(
      'rules.field.payee rules.operator.contains "Coffee"',
    );
    const ruleRow = conditionBadge.closest("tr");
    fireEvent.contextMenu(ruleRow!);

    // The portal menu should appear with Edit and Delete actions
    await waitFor(() => {
      expect(document.querySelector(".rule-action-menu-portal")).not.toBeNull();
    });
    const portal = document.querySelector(".rule-action-menu-portal");
    expect(
      within(portal as HTMLElement).getByRole("button", {
        name: /rules\.edit/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(portal as HTMLElement).getByRole("button", {
        name: /rules\.delete/i,
      }),
    ).toBeInTheDocument();
  });

  it("rule context menu closes when clicking outside", async () => {
    const rule = {
      id: 2,
      priority: 1,
      match_field: "payee",
      match_pattern: "Test",
      action_field: "category",
      action_value: "Other",
      logic: "and",
      conditions: [{ field: "payee", operator: "equals", value: "Test" }],
      actions: [{ field: "category", value: "Other" }],
    };
    vi.mocked(invoke).mockResolvedValueOnce([rule]);
    render(<RulesList />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_rules"));

    // The condition badge renders: "rules.field.payee rules.operator.equals "Test""
    const conditionBadge = await screen.findByText(
      'rules.field.payee rules.operator.equals "Test"',
    );
    const ruleRow = conditionBadge.closest("tr");
    fireEvent.contextMenu(ruleRow!);

    // Context menu portal should be open
    await waitFor(() => {
      expect(document.querySelector(".rule-action-menu-portal")).not.toBeNull();
    });

    // Click outside to close
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(document.querySelector(".rule-action-menu-portal")).toBeNull();
    });
  });
});
