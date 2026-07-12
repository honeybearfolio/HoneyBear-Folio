import { describe, it, expect } from "vitest";
import {
  getJsonRows,
  parseCsvText,
  parseCsvPreview,
  parseJsonPreview,
  collectColumnsFromRows,
} from "../../utils/import-parser";

describe("import-parser", () => {
  it("extracts rows from HoneyBear JSON shape", () => {
    const parsed = {
      transactions: [{ date: "2024-01-01", amount: 10 }],
      accounts: [],
    };
    expect(getJsonRows(parsed)).toEqual([{ date: "2024-01-01", amount: 10 }]);
  });

  it("extracts rows from top-level array", () => {
    const rows = [{ payee: "Store" }];
    expect(getJsonRows(rows)).toEqual(rows);
  });

  it("extracts rows from data property", () => {
    const parsed = { data: [{ payee: "Shop" }] };
    expect(getJsonRows(parsed)).toEqual([{ payee: "Shop" }]);
  });

  it("parses CSV text into columns and rows", () => {
    const csv = "date,amount\n2024-01-01,10\n2024-01-02,20";
    const { columns, rows } = parseCsvText(csv);
    expect(columns).toEqual(["date", "amount"]);
    expect(rows).toHaveLength(2);
  });

  it("limits CSV preview to five rows", () => {
    const csv =
      "date,amount\n" +
      Array.from(
        { length: 8 },
        (_, i) => `2024-01-0${String(i + 1)},${String(i)}`,
      ).join("\n");
    const preview = parseCsvPreview(csv);
    expect(preview.previewRows).toHaveLength(5);
    expect(preview.parseError).toBeNull();
  });

  it("reports unsupported JSON structure", () => {
    const preview = parseJsonPreview(
      JSON.stringify({ meta: "only" }),
      "Unsupported JSON",
    );
    expect(preview.columns).toEqual([]);
    expect(preview.parseError).toBe("Unsupported JSON");
  });

  it("collects union of keys as columns", () => {
    const cols = collectColumnsFromRows([
      { date: "2024-01-01", amount: 1 },
      { payee: "Store", amount: 2 },
    ]);
    expect(cols.sort()).toEqual(["amount", "date", "payee"].sort());
  });
});
