import type {
  LiabilityValuation,
  LiabilityWithLatestValue,
} from "../api/types";
import {
  getField,
  headerMatchesAlias,
  normalizeKey,
  parseNumericValue,
} from "./spreadsheet-io";

export const LIABILITY_CATEGORIES = [
  "mortgage",
  "auto_loan",
  "credit_card",
  "student_loan",
  "personal_loan",
  "other",
] as const;

export type LiabilityCategory = (typeof LIABILITY_CATEGORIES)[number];

export const LIABILITY_FIELD_LABELS = {
  name: "Name",
  category: "Category",
  currency: "Currency",
  notes: "Notes",
  value: "Value",
  date: "Date",
} as const;

export const LIABILITY_CATEGORY_LABELS: Record<LiabilityCategory, string> = {
  mortgage: "Mortgage",
  auto_loan: "Auto Loan",
  credit_card: "Credit Card",
  student_loan: "Student Loan",
  personal_loan: "Personal Loan",
  other: "Other",
};

export const LEGACY_LIABILITY_CATEGORY_LABELS: Record<
  string,
  LiabilityCategory
> = {
  mortgage: "mortgage",
  hipoteca: "mortgage",
  "auto loan": "auto_loan",
  auto_loan: "auto_loan",
  "préstamo auto": "auto_loan",
  "prestamo auto": "auto_loan",
  "credit card": "credit_card",
  credit_card: "credit_card",
  "tarjeta de crédito": "credit_card",
  "tarjeta de credito": "credit_card",
  "student loan": "student_loan",
  student_loan: "student_loan",
  "préstamo estudiantil": "student_loan",
  "prestamo estudiantil": "student_loan",
  "personal loan": "personal_loan",
  personal_loan: "personal_loan",
  "préstamo personal": "personal_loan",
  "prestamo personal": "personal_loan",
  other: "other",
  otro: "other",
};

export const LIABILITY_FIELD_ALIASES = {
  name: ["name", "nombre"],
  category: ["category", "categoría", "categoria"],
  currency: ["currency", "moneda"],
  notes: ["notes", "notas"],
  value: ["value", "valor", "latest_value", "balance"],
  date: ["date", "fecha", "latest_date"],
} as const;

export interface ExportLiabilityValuation {
  date: string;
  value: number;
}

export interface ExportLiability {
  name: string;
  category: string;
  currency?: string | null;
  notes?: string | null;
  valuations: ExportLiabilityValuation[];
}

export interface ImportLiabilityResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type LiabilityApi = {
  get_liabilities: () => Promise<LiabilityWithLatestValue[]>;
  get_liability_valuations: (args: {
    liabilityId: number;
  }) => Promise<LiabilityValuation[]>;
  create_liability: (args: {
    name: string;
    category: string;
    currency?: string;
    notes?: string;
  }) => Promise<{ id: number }>;
  create_liability_valuation: (args: {
    liabilityId: number;
    date: string;
    value: number;
  }) => Promise<unknown>;
};

const CATEGORY_LABEL_TO_KEY = {
  ...Object.fromEntries(
    Object.entries(LIABILITY_CATEGORY_LABELS).map(([key, label]) => [
      label.toLowerCase(),
      key,
    ]),
  ),
  ...LEGACY_LIABILITY_CATEGORY_LABELS,
} as Record<string, LiabilityCategory>;

const LIABILITY_SHEET_NAMES = new Set(
  ["liabilities", "liability tracking", "liability tracker", "pasivos"].map(
    (s) => s.toLowerCase(),
  ),
);

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function normalizeLiabilityCategory(raw: unknown): LiabilityCategory {
  const value = normalizeKey(asText(raw));
  if ((LIABILITY_CATEGORIES as readonly string[]).includes(value)) {
    return value as LiabilityCategory;
  }
  const fromLabel = CATEGORY_LABEL_TO_KEY[value];
  if (fromLabel) return fromLabel;
  return "other";
}

export function isLiabilitySheetName(name: string): boolean {
  return LIABILITY_SHEET_NAMES.has(normalizeKey(name));
}

export function isLiabilityRow(headers: string[]): boolean {
  return (
    headers.some((h) => headerMatchesAlias(h, LIABILITY_FIELD_ALIASES.name)) &&
    headers.some((h) =>
      headerMatchesAlias(h, LIABILITY_FIELD_ALIASES.category),
    ) &&
    headers.some((h) => headerMatchesAlias(h, LIABILITY_FIELD_ALIASES.value))
  );
}

function parseDateValue(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const rawText = asText(raw);
  const parsed = new Date(rawText);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  const normalized = rawText.replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const [p0, p1, p2] = parts;
    if (!p0 || !p1 || !p2) return null;
    const alt =
      p0.length === 4
        ? new Date(`${p0}-${p1}-${p2}`)
        : new Date(`${p2}-${p1}-${p0}`);
    if (!isNaN(alt.getTime())) return alt.toISOString().slice(0, 10);
  }
  return null;
}

function getLiabilityField(
  row: Record<string, unknown>,
  field: keyof typeof LIABILITY_FIELD_ALIASES,
): unknown {
  return getField(
    row,
    LIABILITY_FIELD_LABELS[field],
    ...LIABILITY_FIELD_ALIASES[field],
  );
}

export function parseLiabilityFromRow(
  row: Record<string, unknown>,
): ExportLiability | null {
  const name = asText(getLiabilityField(row, "name")).trim();
  if (!name) return null;

  const category = normalizeLiabilityCategory(
    getLiabilityField(row, "category"),
  );
  const currencyRaw = getLiabilityField(row, "currency");
  const notesRaw = getLiabilityField(row, "notes");
  const value = parseNumericValue(getLiabilityField(row, "value"));
  const date =
    parseDateValue(getLiabilityField(row, "date")) ??
    new Date().toISOString().slice(0, 10);

  const valuations: ExportLiabilityValuation[] = [];
  if (value !== null) {
    valuations.push({ date, value });
  }

  return {
    name,
    category,
    currency: currencyRaw ? asText(currencyRaw) : null,
    notes: notesRaw ? asText(notesRaw) : null,
    valuations,
  };
}

function parseValuationsFromJson(
  record: Record<string, unknown>,
): ExportLiabilityValuation[] {
  const valuations: ExportLiabilityValuation[] = [];

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

export function parseLiabilityFromJson(item: unknown): ExportLiability | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = asText(record.name).trim();
  if (!name) return null;

  return {
    name,
    category: normalizeLiabilityCategory(record.category),
    currency: record.currency ? asText(record.currency) : null,
    notes: record.notes ? asText(record.notes) : null,
    valuations: parseValuationsFromJson(record),
  };
}

export function extractLiabilitiesFromHoneyBearJson(
  parsed: unknown,
): ExportLiability[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const liabilities = (parsed as Record<string, unknown>).liabilities;
  if (!Array.isArray(liabilities)) return [];

  return liabilities
    .map(parseLiabilityFromJson)
    .filter((liability): liability is ExportLiability => liability !== null);
}

export function toLegacyJsonLiability(
  liability: ExportLiability,
): Record<string, unknown> {
  const latest = liability.valuations.length
    ? [...liability.valuations].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  return {
    name: liability.name,
    category: liability.category,
    currency: liability.currency,
    notes: liability.notes,
    valuations: liability.valuations,
    latest_value: latest?.value ?? null,
    latest_date: latest?.date ?? null,
  };
}

export async function fetchLiabilitiesForExport(
  api: LiabilityApi,
): Promise<ExportLiability[]> {
  const liabilities = await api.get_liabilities();
  const exported: ExportLiability[] = [];

  for (const liability of liabilities) {
    const valuations = await api.get_liability_valuations({
      liabilityId: liability.id,
    });
    const valuationEntries: ExportLiabilityValuation[] = valuations.map(
      (v) => ({
        date: v.date,
        value: v.value,
      }),
    );

    if (valuationEntries.length === 0 && liability.latest_value != null) {
      valuationEntries.push({
        date: liability.latest_date || new Date().toISOString().slice(0, 10),
        value: liability.latest_value,
      });
    }

    exported.push({
      name: liability.name,
      category: liability.category,
      currency: liability.currency ?? null,
      notes: liability.notes ?? null,
      valuations: valuationEntries,
    });
  }

  return exported;
}

export async function importLiabilities(
  api: LiabilityApi,
  liabilities: ExportLiability[],
  existingLiabilities: LiabilityWithLatestValue[] = [],
): Promise<ImportLiabilityResult> {
  const result: ImportLiabilityResult = { imported: 0, skipped: 0, errors: [] };
  const knownNames = new Set(
    existingLiabilities.map((l) => l.name.trim().toLowerCase()),
  );

  for (const liability of liabilities) {
    const key = liability.name.trim().toLowerCase();
    if (knownNames.has(key)) {
      result.skipped++;
      continue;
    }

    try {
      const created = await api.create_liability({
        name: liability.name,
        category: liability.category,
        ...(liability.currency ? { currency: liability.currency } : {}),
        ...(liability.notes ? { notes: liability.notes } : {}),
      });

      for (const valuation of liability.valuations) {
        await api.create_liability_valuation({
          liabilityId: created.id,
          date: valuation.date,
          value: valuation.value,
        });
      }

      knownNames.add(key);
      result.imported++;
    } catch (e) {
      result.errors.push(`${liability.name}: ${String(e)}`);
    }
  }

  return result;
}
