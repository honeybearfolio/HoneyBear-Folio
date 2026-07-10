import { describe, it, expect } from "vitest";
import {
  getField,
  headerMatchesAlias,
  headerMatchesFieldAlias,
  normalizeKey,
  parseNumericValue,
  rowsFromSheetData,
  stripAccents,
} from "../../utils/spreadsheet-io";

describe("spreadsheet-io", () => {
  it("strips accents from strings", () => {
    expect(stripAccents("Categoría")).toBe("Categoria");
    expect(stripAccents("Montréal")).toBe("Montreal");
  });

  it("normalizes keys for case- and accent-insensitive matching", () => {
    expect(normalizeKey("  Nombre  ")).toBe("nombre");
    expect(normalizeKey("Categoría")).toBe("categoria");
  });

  it("matches headers against aliases", () => {
    expect(headerMatchesAlias("Nombre", ["name", "nombre"])).toBe(true);
    expect(headerMatchesAlias("Balance", ["balance", "saldo"])).toBe(true);
    expect(headerMatchesAlias("Saldo", ["balance", "saldo"])).toBe(true);
    expect(headerMatchesAlias("Amount", ["balance", "saldo"])).toBe(false);
  });

  it("matches headers with exact or substring alias (field auto-mapping)", () => {
    expect(headerMatchesFieldAlias("Date", ["date", "fecha"])).toBe(true);
    expect(headerMatchesFieldAlias("Transaction Date", ["date", "fecha"])).toBe(
      true,
    );
    expect(headerMatchesFieldAlias("FECHA", ["date", "fecha"])).toBe(true);
    expect(
      headerMatchesFieldAlias("Categoría", ["category", "categoria"]),
    ).toBe(true);
    expect(headerMatchesFieldAlias("Importe", ["amount", "importe"])).toBe(
      true,
    );
    expect(headerMatchesFieldAlias("Balance", ["amount", "importe"])).toBe(
      false,
    );
  });

  it("reads fields with exact and normalized keys", () => {
    const row = { Nombre: "Casa", SALDO: 100 };

    expect(getField(row, "name", "nombre", "Nombre")).toBe("Casa");
    expect(getField(row, "balance", "saldo", "Saldo")).toBe(100);
    expect(getField(row, "currency")).toBeUndefined();
  });

  it("parses numeric values from numbers and strings", () => {
    expect(parseNumericValue(1500.5)).toBe(1500.5);
    expect(parseNumericValue("2,500.75")).toBe(2500.75);
    expect(parseNumericValue("")).toBeNull();
    expect(parseNumericValue(null)).toBeNull();
    expect(parseNumericValue("invalid")).toBeNull();
    expect(parseNumericValue(NaN)).toBeNull();
  });

  it("converts sheet rows into objects", () => {
    expect(rowsFromSheetData([])).toEqual([]);
    expect(
      rowsFromSheetData([
        ["Name", "Value"],
        ["House", 350000],
        ["Car", undefined],
      ]),
    ).toEqual([
      { Name: "House", Value: 350000 },
      { Name: "Car", Value: "" },
    ]);
  });
});
