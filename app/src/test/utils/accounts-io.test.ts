import { describe, it, expect, vi } from "vitest";
import {
  autoMapImportColumns,
  extractAccountsFromHoneyBearJson,
  importAccounts,
  isAccountRow,
  isAccountSheetName,
  parseAccountFromJson,
  parseAccountFromRow,
  pickAccountSheet,
  pickTransactionSheet,
} from "../../utils/accounts-io";
import type { Account } from "../../api/types";

describe("accounts-io", () => {
  it("detects account sheets and rows", () => {
    expect(isAccountSheetName("Accounts")).toBe(true);
    expect(isAccountSheetName("Cuentas")).toBe(true);
    expect(isAccountSheetName("Transactions")).toBe(false);
    expect(isAccountRow(["id", "name", "balance", "currency"])).toBe(true);
    expect(isAccountRow(["Date", "Account", "Payee", "Amount"])).toBe(false);
    expect(isAccountRow(["Name", "Category", "Value", "Date"])).toBe(false);
    expect(isAccountRow(["Nombre", "Saldo", "Moneda"])).toBe(true);
    expect(isAccountRow(["Fecha", "Cuenta", "Importe"])).toBe(false);
  });

  it("auto-maps import columns from English and Spanish headers", () => {
    expect(
      autoMapImportColumns([
        "Date",
        "Account",
        "Payee",
        "Amount",
        "Category",
        "Notes",
        "Ticker",
        "Shares",
        "Price",
        "Fee",
        "Currency",
      ]),
    ).toEqual({
      date: "Date",
      account: "Account",
      payee: "Payee",
      amount: "Amount",
      category: "Category",
      notes: "Notes",
      ticker: "Ticker",
      shares: "Shares",
      price: "Price",
      fee: "Fee",
      currency: "Currency",
    });
  });

  it("auto-maps mixed-case and non-English transaction headers", () => {
    expect(
      autoMapImportColumns([
        "FECHA",
        "CUENTA",
        "DESCRIPCIÓN",
        "IMPORTE",
        "Categoría",
        "Notas",
        "Símbolo",
        "Cantidad",
        "Precio",
        "Comisión",
        "Moneda",
      ]),
    ).toEqual({
      date: "FECHA",
      account: "CUENTA",
      payee: "DESCRIPCIÓN",
      amount: "IMPORTE",
      category: "Categoría",
      notes: "Notas",
      ticker: "Símbolo",
      shares: "Cantidad",
      price: "Precio",
      fee: "Comisión",
      currency: "Moneda",
    });
  });

  it("prefers date over account when a header contains both hints", () => {
    expect(autoMapImportColumns(["Account Date", "Amount"])).toEqual({
      date: "Account Date",
      amount: "Amount",
    });
  });

  it("uses last matching column when multiple headers map to the same field", () => {
    expect(autoMapImportColumns(["Date", "Transaction Date"])).toEqual({
      date: "Transaction Date",
    });
  });

  it("parses accounts from JSON", () => {
    const account = parseAccountFromJson({
      id: 1,
      name: "Checking",
      balance: 1500.5,
      currency: "USD",
      kind: "cash",
    });

    expect(account).toEqual({
      name: "Checking",
      balance: 1500.5,
      currency: "USD",
      kind: "cash",
    });
  });

  it("parses accounts from spreadsheet rows", () => {
    const account = parseAccountFromRow({
      id: 2,
      name: "Savings",
      balance: "2500",
      currency: "EUR",
      kind: "cash",
    });

    expect(account).toEqual({
      name: "Savings",
      balance: 2500,
      currency: "EUR",
      kind: "cash",
    });
  });

  it("extracts accounts from HoneyBear JSON exports", () => {
    expect(
      extractAccountsFromHoneyBearJson({
        accounts: [
          { id: 1, name: "Checking", balance: 100, kind: "cash" },
          { id: 2, name: "Brokerage", balance: 0, kind: "brokerage" },
        ],
        transactions: [],
      }),
    ).toEqual([
      { name: "Checking", balance: 100, currency: null, kind: "cash" },
      { name: "Brokerage", balance: 0, currency: null, kind: "brokerage" },
    ]);
  });

  it("picks transaction and account sheets from multi-sheet workbooks", () => {
    const sheets = [
      {
        name: "Transactions",
        data: [
          ["Date", "Account", "Payee", "Amount"],
          ["2024-01-01", "Checking", "Store", 10],
        ],
      },
      {
        name: "Accounts",
        data: [
          ["id", "name", "balance", "currency"],
          [1, "Checking", 100, "USD"],
        ],
      },
      {
        name: "Assets",
        data: [["Name", "Category", "Value", "Date"]],
      },
    ];

    expect(pickTransactionSheet(sheets)?.name).toBe("Transactions");
    expect(pickAccountSheet(sheets)?.name).toBe("Accounts");
  });

  it("imports accounts and skips duplicates", async () => {
    const create_account = vi.fn(
      (args: {
        name: string;
        balance?: number;
        kind?: string;
        currency?: string | null;
      }) =>
        Promise.resolve({
          id: 10,
          name: args.name,
          balance: args.balance ?? 0,
          kind: args.kind ?? "cash",
        }),
    );

    const existing: Account[] = [{ id: 1, name: "Checking", balance: 100 }];

    const result = await importAccounts(
      { create_account },
      [
        { name: "Checking", balance: 100 },
        { name: "Savings", balance: 500, currency: "USD" },
      ],
      existing,
    );

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.created).toHaveLength(1);
    expect(create_account).toHaveBeenCalledTimes(1);
    expect(create_account).toHaveBeenCalledWith({
      name: "Savings",
      balance: 500,
      kind: undefined,
      currency: "USD",
    });
  });
});
