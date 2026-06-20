import { describe, it, expect, vi } from "vitest";
import {
  extractAssetsFromHoneyBearJson,
  fetchAssetsForExport,
  importAssets,
  isAssetRow,
  isAssetSheetName,
  normalizeAssetCategory,
  parseAssetFromJson,
  parseAssetFromRow,
  rowsFromSheetData,
  toLegacyJsonAsset,
} from "../../utils/assets-io";
import type { AssetValuation, AssetWithLatestValue } from "../../api/types";

describe("assets-io", () => {
  it("normalizes category keys and display labels", () => {
    expect(normalizeAssetCategory("real_estate")).toBe("real_estate");
    expect(normalizeAssetCategory("Real Estate")).toBe("real_estate");
    expect(normalizeAssetCategory("Inmueble")).toBe("real_estate");
    expect(normalizeAssetCategory("unknown")).toBe("other");
  });

  it("detects asset sheets and rows", () => {
    expect(isAssetSheetName("Assets")).toBe(true);
    expect(isAssetSheetName("Activos")).toBe(true);
    expect(isAssetSheetName("Transactions")).toBe(false);
    expect(isAssetRow(["Name", "Category", "Value", "Date"])).toBe(true);
    expect(isAssetRow(["Nombre", "Categoría", "Valor", "Fecha"])).toBe(true);
    expect(isAssetRow(["Date", "Payee", "Amount"])).toBe(false);
  });

  it("parses assets from JSON with valuations", () => {
    const asset = parseAssetFromJson({
      name: "House",
      category: "real_estate",
      currency: "USD",
      notes: "Primary",
      valuations: [
        { date: "2024-01-01", value: 300000 },
        { date: "2024-06-01", value: 350000 },
      ],
    });

    expect(asset).toEqual({
      name: "House",
      category: "real_estate",
      currency: "USD",
      notes: "Primary",
      valuations: [
        { date: "2024-01-01", value: 300000 },
        { date: "2024-06-01", value: 350000 },
      ],
    });
  });

  it("parses assets from JSON with latest value fallback", () => {
    const asset = parseAssetFromJson({
      name: "Car",
      category: "Vehicle",
      latest_value: 25000,
      latest_date: "2024-03-15",
    });

    expect(asset?.category).toBe("vehicle");
    expect(asset?.valuations).toEqual([{ date: "2024-03-15", value: 25000 }]);
  });

  it("parses legacy JSON assets with id and exchange_rate", () => {
    const asset = parseAssetFromJson({
      id: 42,
      name: "House",
      category: "real_estate",
      currency: "USD",
      notes: null,
      latest_value: 350000,
      latest_date: "2024-06-01",
      exchange_rate: 1,
    });

    expect(asset).toEqual({
      name: "House",
      category: "real_estate",
      currency: "USD",
      notes: null,
      valuations: [{ date: "2024-06-01", value: 350000 }],
    });
  });

  it("parses Spanish spreadsheet rows from previous exports", () => {
    const asset = parseAssetFromRow({
      Nombre: "Casa",
      Categoría: "Inmueble",
      Moneda: "EUR",
      Valor: "250000",
      Fecha: "2024-04-01",
      Notas: "Principal",
    });

    expect(asset).toEqual({
      name: "Casa",
      category: "real_estate",
      currency: "EUR",
      notes: "Principal",
      valuations: [{ date: "2024-04-01", value: 250000 }],
    });
  });

  it("extracts assets from HoneyBear exports without assets", () => {
    expect(
      extractAssetsFromHoneyBearJson({
        accounts: [],
        transactions: [],
        exportDate: "2024-01-01",
      }),
    ).toEqual([]);
  });

  it("exports JSON assets with legacy fields for compatibility", () => {
    const legacy = toLegacyJsonAsset({
      name: "House",
      category: "real_estate",
      currency: "USD",
      notes: null,
      valuations: [
        { date: "2024-01-01", value: 300000 },
        { date: "2024-06-01", value: 350000 },
      ],
    });

    expect(legacy).toEqual({
      name: "House",
      category: "real_estate",
      currency: "USD",
      notes: null,
      valuations: [
        { date: "2024-01-01", value: 300000 },
        { date: "2024-06-01", value: 350000 },
      ],
      latest_value: 350000,
      latest_date: "2024-06-01",
    });
  });

  it("imports metadata-only legacy assets without valuations", async () => {
    const createAsset = vi.fn().mockResolvedValue({ id: 10 });
    const createValuation = vi.fn();
    const api = {
      get_assets: vi.fn(),
      get_valuations: vi.fn(),
      create_asset: createAsset,
      create_valuation: createValuation,
    };

    const result = await importAssets(api, [
      {
        name: "Land",
        category: "other",
        currency: null,
        notes: "Empty lot",
        valuations: [],
      },
    ]);

    expect(result.imported).toBe(1);
    expect(createAsset).toHaveBeenCalledWith({
      name: "Land",
      category: "other",
      currency: undefined,
      notes: "Empty lot",
    });
    expect(createValuation).not.toHaveBeenCalled();
  });

  it("parses assets from spreadsheet rows", () => {
    const asset = parseAssetFromRow({
      Name: "Watch",
      Category: "Jewelry",
      Currency: "EUR",
      Value: "12000",
      Date: "2024-05-01",
      Notes: "Vintage",
    });

    expect(asset).toEqual({
      name: "Watch",
      category: "jewelry",
      currency: "EUR",
      notes: "Vintage",
      valuations: [{ date: "2024-05-01", value: 12000 }],
    });
  });

  it("converts sheet rows into objects", () => {
    const rows = rowsFromSheetData([
      ["Name", "Value"],
      ["House", 350000],
    ]);

    expect(rows).toEqual([{ Name: "House", Value: 350000 }]);
  });

  it("exports assets with valuation history", async () => {
    const assets: AssetWithLatestValue[] = [
      {
        id: 1,
        name: "House",
        category: "real_estate",
        currency: "USD",
        notes: null,
        latest_value: 350000,
        latest_date: "2024-06-01",
        exchange_rate: 1,
      },
    ];
    const valuations: AssetValuation[] = [
      { id: 1, asset_id: 1, date: "2024-01-01", value: 300000 },
      { id: 2, asset_id: 1, date: "2024-06-01", value: 350000 },
    ];

    const api = {
      get_assets: vi.fn().mockResolvedValue(assets),
      get_valuations: vi.fn().mockResolvedValue(valuations),
      create_asset: vi.fn(),
      create_valuation: vi.fn(),
    };

    const exported = await fetchAssetsForExport(api);
    expect(exported).toEqual([
      {
        name: "House",
        category: "real_estate",
        currency: "USD",
        notes: null,
        valuations: [
          { date: "2024-01-01", value: 300000 },
          { date: "2024-06-01", value: 350000 },
        ],
      },
    ]);
  });

  it("imports assets and skips duplicates by name", async () => {
    const createAsset = vi.fn().mockResolvedValue({ id: 10 });
    const createValuation = vi.fn().mockResolvedValue({});
    const api = {
      get_assets: vi.fn(),
      get_valuations: vi.fn(),
      create_asset: createAsset,
      create_valuation: createValuation,
    };

    const existing: AssetWithLatestValue[] = [
      {
        id: 1,
        name: "House",
        category: "real_estate",
        exchange_rate: 1,
      },
    ];

    const result = await importAssets(
      api,
      [
        {
          name: "House",
          category: "real_estate",
          valuations: [{ date: "2024-06-01", value: 350000 }],
        },
        {
          name: "Car",
          category: "vehicle",
          valuations: [{ date: "2024-06-01", value: 20000 }],
        },
      ],
      existing,
    );

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(createAsset).toHaveBeenCalledTimes(1);
    expect(createAsset).toHaveBeenCalledWith({
      name: "Car",
      category: "vehicle",
      currency: undefined,
      notes: undefined,
    });
    expect(createValuation).toHaveBeenCalledWith({
      assetId: 10,
      date: "2024-06-01",
      value: 20000,
    });
  });
});
