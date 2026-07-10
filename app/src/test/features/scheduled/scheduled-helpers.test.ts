import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import {
  toScheduledPayload,
  getRecurrenceSummary,
  getAccountName,
} from "../../../features/scheduled/scheduled-helpers";
import { createDefaultScheduledForm } from "../../../constants/app";

const t = ((key: string, opts?: Record<string, unknown>) => {
  if (opts) {
    return `${key}:${JSON.stringify(opts)}`;
  }
  return key;
}) as TFunction;

describe("toScheduledPayload", () => {
  it("maps cash transaction fields", () => {
    const form = {
      ...createDefaultScheduledForm(),
      payee: "Rent",
      amount: "1200",
      category: "Housing",
      notes: "Monthly",
      currency: "USD",
      recurrenceType: "monthly",
    };

    const payload = toScheduledPayload(form, t);

    expect(payload.payee).toBe("Rent");
    expect(payload.amount).toBe(1200);
    expect(payload.category).toBe("Housing");
    expect(payload.notes).toBe("Monthly");
    expect(payload.transactionType).toBe("regular");
    expect(payload.ticker).toBeNull();
  });

  it("computes investment buy amount as negative total", () => {
    const form = {
      ...createDefaultScheduledForm(),
      transactionType: "investment",
      isBuy: true,
      shares: "10",
      pricePerShare: "50",
      fee: "5",
      payee: "",
      category: "",
    };

    const payload = toScheduledPayload(form, t);

    expect(payload.amount).toBe(-505);
    expect(payload.payee).toBe("scheduled.field.buy");
    expect(payload.category).toBe("scheduled.field.investment_category");
    expect(payload.ticker).toBe("");
    expect(payload.isBuy).toBe(true);
  });

  it("computes investment sell amount as positive net", () => {
    const form = {
      ...createDefaultScheduledForm(),
      transactionType: "investment",
      isBuy: false,
      shares: "10",
      pricePerShare: "50",
      fee: "5",
      payee: "Sell AAPL",
      category: "Investments",
    };

    const payload = toScheduledPayload(form, t);

    expect(payload.amount).toBe(495);
    expect(payload.payee).toBe("Sell AAPL");
    expect(payload.category).toBe("Investments");
    expect(payload.isBuy).toBe(false);
  });

  it("maps recurrence-specific fields", () => {
    const everyN = {
      ...createDefaultScheduledForm(),
      recurrenceType: "every_n",
      intervalValue: 2,
      intervalUnit: "week",
    };
    expect(toScheduledPayload(everyN, t).intervalValue).toBe(2);
    expect(toScheduledPayload(everyN, t).intervalUnit).toBe("week");

    const dow = {
      ...createDefaultScheduledForm(),
      recurrenceType: "day_of_week",
      daysOfWeek: [1, 3],
    };
    expect(toScheduledPayload(dow, t).daysOfWeek).toEqual([1, 3]);

    const ordinal = {
      ...createDefaultScheduledForm(),
      recurrenceType: "ordinal_weekday",
      ordinal: 2,
      weekday: 5,
    };
    expect(toScheduledPayload(ordinal, t).ordinal).toBe(2);
    expect(toScheduledPayload(ordinal, t).weekday).toBe(5);
  });
});

describe("getRecurrenceSummary", () => {
  it("summarizes every_n recurrence", () => {
    const summary = getRecurrenceSummary(
      { recurrence_type: "every_n", interval_value: 2, interval_unit: "week" },
      t,
    );
    expect(summary).toContain("scheduled.summary.every_n");
  });

  it("summarizes day_of_week recurrence", () => {
    const summary = getRecurrenceSummary(
      { recurrence_type: "day_of_week", days_of_week: [1, 3] },
      t,
    );
    expect(summary).toContain("scheduled.summary.days_of_week");
  });

  it("summarizes ordinal_weekday recurrence", () => {
    const summary = getRecurrenceSummary(
      {
        recurrence_type: "ordinal_weekday",
        ordinal: 1,
        weekday: 2,
      },
      t,
    );
    expect(summary).toContain("scheduled.summary.ordinal_weekday");
  });

  it("returns empty string for unknown recurrence", () => {
    expect(getRecurrenceSummary({ recurrence_type: "unknown" }, t)).toBe("");
  });
});

describe("getAccountName", () => {
  it("returns account name when found", () => {
    expect(getAccountName([{ id: 1, name: "Checking" }], 1)).toBe("Checking");
  });

  it("returns id as string when account missing", () => {
    expect(getAccountName([], "acc-99")).toBe("acc-99");
  });
});
