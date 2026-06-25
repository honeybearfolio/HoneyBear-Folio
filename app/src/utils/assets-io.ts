import type { AssetValuation, AssetWithLatestValue } from "../api/types";
import {
  getField,
  headerMatchesAlias,
  normalizeKey,
  parseNumericValue,
} from "./spreadsheet-io";

export const ASSET_CATEGORIES = [
  "real_estate",
  "vehicle",
  "jewelry",
  "art",
  "collectible",
  "other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** English display labels used in XLSX export (assets.field.* / assets.category.*). */
export const ASSET_FIELD_LABELS = {
  name: "Name",
  category: "Category",
  currency: "Currency",
  notes: "Notes",
  value: "Value",
  date: "Date",
} as const;

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  real_estate: "Real Estate",
  vehicle: "Vehicle",
  jewelry: "Jewelry",
  art: "Art",
  collectible: "Collectible",
  other: "Other",
};

/** Localized category display labels from previous export versions. */
export const LEGACY_ASSET_CATEGORY_LABELS: Record<string, AssetCategory> = {
  "real estate": "real_estate",
  inmueble: "real_estate",
  vehicle: "vehicle",
  vehiculo: "vehicle",
  vehículo: "vehicle",
  jewelry: "jewelry",
  joyeria: "jewelry",
  joyería: "jewelry",
  art: "art",
  arte: "art",
  collectible: "collectible",
  coleccionable: "collectible",
  other: "other",
  otro: "other",
};

/** Column header aliases from previous localized XLSX exports. */
export const ASSET_FIELD_ALIASES = {
  name: ["name", "nombre"],
  category: ["category", "categoría", "categoria"],
  currency: ["currency", "moneda"],
  notes: ["notes", "notas"],
  value: ["value", "valor", "latest_value"],
  date: ["date", "fecha", "latest_date"],
} as const;

export interface ExportValuation {
  date: string;
  value: number;
}

export interface ExportAsset {
  name: string;
  category: string;
  currency?: string | null;
  notes?: string | null;
  valuations: ExportValuation[];
}

export interface ImportAssetResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type AssetApi = {
  get_assets: () => Promise<AssetWithLatestValue[]>;
  get_valuations: (args: { assetId: number }) => Promise<AssetValuation[]>;
  create_asset: (args: {
    name: string;
    category: string;
    currency?: string;
    notes?: string;
  }) => Promise<{ id: number }>;
  create_valuation: (args: {
    assetId: number;
    date: string;
    value: number;
  }) => Promise<unknown>;
};

const CATEGORY_LABEL_TO_KEY = {
  ...Object.fromEntries(
    Object.entries(ASSET_CATEGORY_LABELS).map(([key, label]) => [
      label.toLowerCase(),
      key,
    ]),
  ),
  ...LEGACY_ASSET_CATEGORY_LABELS,
} as Record<string, AssetCategory>;

const ASSET_SHEET_NAMES = new Set(
  ["assets", "asset tracking", "asset tracker", "activos"].map((s) =>
    s.toLowerCase(),
  ),
);

export function normalizeAssetCategory(raw: unknown): AssetCategory {
  const value = normalizeKey(String(raw ?? ""));
  if ((ASSET_CATEGORIES as readonly string[]).includes(value)) {
    return value as AssetCategory;
  }
  const fromLabel = CATEGORY_LABEL_TO_KEY[value];
  if (fromLabel) return fromLabel;
  return "other";
}

export function isAssetSheetName(name: string): boolean {
  return ASSET_SHEET_NAMES.has(normalizeKey(name));
}

export function isAssetRow(headers: string[]): boolean {
  return (
    headers.some((h) => headerMatchesAlias(h, ASSET_FIELD_ALIASES.name)) &&
    headers.some((h) => headerMatchesAlias(h, ASSET_FIELD_ALIASES.category)) &&
    headers.some((h) => headerMatchesAlias(h, ASSET_FIELD_ALIASES.value))
  );
}

function parseDateValue(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = new Date(String(raw));
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  const normalized = String(raw).replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const alt =
      parts[0].length === 4
        ? new Date(`${parts[0]}-${parts[1]}-${parts[2]}`)
        : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(alt.getTime())) return alt.toISOString().slice(0, 10);
  }
  return null;
}

function getAssetField(
  row: Record<string, unknown>,
  field: keyof typeof ASSET_FIELD_ALIASES,
): unknown {
  return getField(
    row,
    ASSET_FIELD_LABELS[field],
    ...ASSET_FIELD_ALIASES[field],
  );
}

export function parseAssetFromRow(
  row: Record<string, unknown>,
): ExportAsset | null {
  const name = String(getAssetField(row, "name") ?? "").trim();
  if (!name) return null;

  const category = normalizeAssetCategory(getAssetField(row, "category"));
  const currencyRaw = getAssetField(row, "currency");
  const notesRaw = getAssetField(row, "notes");
  const value = parseNumericValue(getAssetField(row, "value"));
  const date =
    parseDateValue(getAssetField(row, "date")) ??
    new Date().toISOString().slice(0, 10);

  const valuations: ExportValuation[] = [];
  if (value !== null) {
    valuations.push({ date, value });
  }

  return {
    name,
    category,
    currency: currencyRaw ? String(currencyRaw) : null,
    notes: notesRaw ? String(notesRaw) : null,
    valuations,
  };
}

function parseValuationsFromJson(
  record: Record<string, unknown>,
): ExportValuation[] {
  const valuations: ExportValuation[] = [];

  if (Array.isArray(record.valuations)) {
    for (const entry of record.valuations) {
      if (!entry || typeof entry !== "object") continue;
      const val = parseNumericValue((entry as Record<string, unknown>).value);
      const date = parseDateValue((entry as Record<string, unknown>).date);
      if (val !== null && date) valuations.push({ date, value: val });
    }
  }

  if (valuations.length === 0) {
    const value = parseNumericValue(record.latest_value ?? record.value);
    const date =
      parseDateValue(record.latest_date ?? record.date) ??
      new Date().toISOString().slice(0, 10);
    if (value !== null) valuations.push({ date, value });
  }

  return valuations;
}

export function parseAssetFromJson(item: unknown): ExportAsset | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = String(record.name ?? "").trim();
  if (!name) return null;

  return {
    name,
    category: normalizeAssetCategory(record.category),
    currency: record.currency ? String(record.currency) : null,
    notes: record.notes ? String(record.notes) : null,
    valuations: parseValuationsFromJson(record),
  };
}

/** Extract assets from HoneyBear JSON exports across versions. */
export function extractAssetsFromHoneyBearJson(parsed: unknown): ExportAsset[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const assets = (parsed as Record<string, unknown>).assets;
  if (!Array.isArray(assets)) return [];

  return assets
    .map(parseAssetFromJson)
    .filter((asset): asset is ExportAsset => asset !== null);
}

export function toLegacyJsonAsset(asset: ExportAsset): Record<string, unknown> {
  const latest = asset.valuations.length
    ? [...asset.valuations].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  return {
    name: asset.name,
    category: asset.category,
    currency: asset.currency,
    notes: asset.notes,
    valuations: asset.valuations,
    latest_value: latest?.value ?? null,
    latest_date: latest?.date ?? null,
  };
}

export async function fetchAssetsForExport(
  api: AssetApi,
): Promise<ExportAsset[]> {
  const assets = await api.get_assets();
  const exported: ExportAsset[] = [];

  for (const asset of assets) {
    const valuations = await api.get_valuations({ assetId: asset.id });
    const valuationEntries: ExportValuation[] = valuations.map((v) => ({
      date: v.date,
      value: v.value,
    }));

    if (valuationEntries.length === 0 && asset.latest_value != null) {
      valuationEntries.push({
        date: asset.latest_date || new Date().toISOString().slice(0, 10),
        value: asset.latest_value,
      });
    }

    exported.push({
      name: asset.name,
      category: asset.category,
      currency: asset.currency ?? null,
      notes: asset.notes ?? null,
      valuations: valuationEntries,
    });
  }

  return exported;
}

export async function importAssets(
  api: AssetApi,
  assets: ExportAsset[],
  existingAssets: AssetWithLatestValue[] = [],
): Promise<ImportAssetResult> {
  const result: ImportAssetResult = { imported: 0, skipped: 0, errors: [] };
  const knownNames = new Set(
    existingAssets.map((a) => a.name.trim().toLowerCase()),
  );

  for (const asset of assets) {
    const key = asset.name.trim().toLowerCase();
    if (knownNames.has(key)) {
      result.skipped++;
      continue;
    }

    try {
      const created = await api.create_asset({
        name: asset.name,
        category: asset.category,
        currency: asset.currency || undefined,
        notes: asset.notes || undefined,
      });

      for (const valuation of asset.valuations) {
        await api.create_valuation({
          assetId: created.id,
          date: valuation.date,
          value: valuation.value,
        });
      }

      knownNames.add(key);
      result.imported++;
    } catch (e) {
      result.errors.push(`${asset.name}: ${String(e)}`);
    }
  }

  return result;
}
