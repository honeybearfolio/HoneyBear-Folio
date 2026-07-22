import { describe, it, expect, vi } from "vitest";
import {
  extractLiabilitiesFromHoneyBearJson,
  fetchLiabilitiesForExport,
  importLiabilities,
  isLiabilityRow,
  isLiabilitySheetName,
  normalizeLiabilityCategory,
  parseLiabilityFromJson,
  parseLiabilityFromRow,
  toLegacyJsonLiability,
} from "../../utils/liabilities-io";
import type {
  LiabilityValuation,
  LiabilityWithLatestValue,
} from "../../api/types";

describe("liabilities-io", () => {
  it("normalizes category keys and display labels", () => {
    expect(normalizeLiabilityCategory("mortgage")).toBe("mortgage");
    expect(normalizeLiabilityCategory("Mortgage")).toBe("mortgage");
    expect(normalizeLiabilityCategory("Hipoteca")).toBe("mortgage");
    expect(normalizeLiabilityCategory("unknown")).toBe("other");
  });

  it("detects liability sheets and rows", () => {
    expect(isLiabilitySheetName("Liabilities")).toBe(true);
    expect(isLiabilitySheetName("Pasivos")).toBe(true);
    expect(isLiabilitySheetName("Transactions")).toBe(false);
    expect(isLiabilityRow(["Name", "Category", "Value", "Date"])).toBe(true);
    expect(isLiabilityRow(["Nombre", "Categoría", "Valor", "Fecha"])).toBe(
      true,
    );
    expect(isLiabilityRow(["Date", "Payee", "Amount"])).toBe(false);
  });

  it("parses liabilities from JSON with valuations", () => {
    const liability = parseLiabilityFromJson({
      name: "Mortgage",
      category: "mortgage",
      currency: "USD",
      notes: "Home",
      valuations: [
        { date: "2024-01-01", value: 260000 },
        { date: "2024-06-01", value: 250000 },
      ],
    });

    expect(liability).toEqual({
      name: "Mortgage",
      category: "mortgage",
      currency: "USD",
      notes: "Home",
      valuations: [
        { date: "2024-01-01", value: 260000 },
        { date: "2024-06-01", value: 250000 },
      ],
    });
  });

  it("parses liabilities from JSON with latest value fallback", () => {
    const liability = parseLiabilityFromJson({
      name: "Credit Card",
      category: "Credit Card",
      latest_value: 3000,
      latest_date: "2024-03-15",
    });

    expect(liability?.category).toBe("credit_card");
    expect(liability?.valuations).toEqual([
      { date: "2024-03-15", value: 3000 },
    ]);
  });

  it("extracts liabilities from HoneyBear exports without liabilities", () => {
    expect(
      extractLiabilitiesFromHoneyBearJson({
        accounts: [],
        transactions: [],
        exportDate: "2024-01-01",
      }),
    ).toEqual([]);
  });

  it("exports JSON liabilities with legacy fields for compatibility", () => {
    const legacy = toLegacyJsonLiability({
      name: "Mortgage",
      category: "mortgage",
      currency: "USD",
      notes: null,
      valuations: [{ date: "2024-06-01", value: 250000 }],
    });

    expect(legacy).toMatchObject({
      name: "Mortgage",
      category: "mortgage",
      latest_value: 250000,
      latest_date: "2024-06-01",
    });
  });

  it("parses Spanish spreadsheet rows", () => {
    const liability = parseLiabilityFromRow({
      Nombre: "Hipoteca",
      Categoría: "Hipoteca",
      Moneda: "EUR",
      Valor: "150000",
      Fecha: "2024-04-01",
      Notas: "Principal",
    });

    expect(liability).toEqual({
      name: "Hipoteca",
      category: "mortgage",
      currency: "EUR",
      notes: "Principal",
      valuations: [{ date: "2024-04-01", value: 150000 }],
    });
  });

  it("fetches liabilities for export", async () => {
    const api = {
      get_liabilities: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Mortgage",
          category: "mortgage",
          currency: "USD",
          latest_value: 250000,
          latest_date: "2024-06-01",
          exchange_rate: 1,
        } satisfies LiabilityWithLatestValue,
      ]),
      get_liability_valuations: vi
        .fn()
        .mockResolvedValue([
          { id: 1, liability_id: 1, date: "2024-06-01", value: 250000 },
        ] satisfies LiabilityValuation[]),
      create_liability: vi.fn(),
      create_liability_valuation: vi.fn(),
    };

    const exported = await fetchLiabilitiesForExport(api);
    expect(exported).toHaveLength(1);
    expect(exported[0]?.name).toBe("Mortgage");
    expect(exported[0]?.valuations).toHaveLength(1);
  });

  it("imports liabilities and skips duplicates", async () => {
    const api = {
      get_liabilities: vi.fn(),
      get_liability_valuations: vi.fn(),
      create_liability: vi.fn().mockResolvedValue({ id: 2 }),
      create_liability_valuation: vi.fn(),
    };

    const existing: LiabilityWithLatestValue[] = [
      {
        id: 1,
        name: "Mortgage",
        category: "mortgage",
        exchange_rate: 1,
      },
    ];

    const result = await importLiabilities(
      api,
      [
        {
          name: "Mortgage",
          category: "mortgage",
          valuations: [{ date: "2024-01-01", value: 100 }],
        },
        {
          name: "Car Loan",
          category: "auto_loan",
          valuations: [{ date: "2024-01-01", value: 15000 }],
        },
      ],
      existing,
    );

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(api.create_liability).toHaveBeenCalledTimes(1);
  });
});
