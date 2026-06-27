import { parseNumberWithLocale } from "./format";

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeKey(value: string): string {
  return stripAccents(value.trim().toLowerCase());
}

export function headerMatchesAlias(
  header: string,
  aliases: readonly string[],
): boolean {
  const normalized = normalizeKey(header);
  return aliases.some((alias) => normalizeKey(alias) === normalized);
}

export function getField(
  row: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  const lowerMap = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeKey(k), v]),
  );
  for (const key of keys) {
    const val = lowerMap[normalizeKey(key)];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

export function parseNumericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  const parsed = parseNumberWithLocale(raw, "en-US");
  return isNaN(parsed) ? null : parsed;
}

export function rowsFromSheetData(
  data: unknown[][],
): Record<string, unknown>[] {
  if (!data.length) return [];
  const headers = (data[0] as unknown[]).map((h) => asText(h));
  return data.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? row[index] : "";
    });
    return obj;
  });
}
