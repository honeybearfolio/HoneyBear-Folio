import { describe, it, expect, vi, beforeEach } from "vitest";
import { importTransactionsFromRows } from "../../utils/import-transactions";
import { parseNumberWithLocale } from "../../utils/format";
import type { FieldMapping } from "../../components/shared/import-types";

const mockInvoke = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();
vi.mock("../../api/tauri-client", () => ({
  rust: {
    get_accounts: (): Promise<unknown> => mockInvoke("get_accounts"),
    get_assets: (): Promise<unknown> => mockInvoke("get_assets"),
    create_account: (args: unknown): Promise<unknown> =>
      mockInvoke("create_account", args),
    create_transaction: (args: unknown): Promise<unknown> =>
      mockInvoke("create_transaction", args),
  },
}));

const mapping: FieldMapping = {
  date: "date",
  payee: "payee",
  amount: "amount",
  category: "category",
  notes: "notes",
  account: "account",
  ticker: "",
  shares: "",
  price: "",
  fee: "",
  currency: "",
};

describe("importTransactionsFromRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_accounts") {
        return Promise.resolve([
          { id: 1, name: "Checking", balance: 0, kind: "cash" },
        ]);
      }
      if (cmd === "get_assets") return Promise.resolve([]);
      if (cmd === "create_transaction") return Promise.resolve({});
      return Promise.resolve([]);
    });
  });

  it("parses CSV amounts using user locale (de-DE comma decimal)", async () => {
    const parseNumber = (value: unknown) =>
      parseNumberWithLocale(value, "de-DE");

    const rows = [
      {
        date: "2024-01-15",
        payee: "Store",
        amount: "12,50",
        account: "Checking",
        category: "Food",
      },
    ];

    await importTransactionsFromRows(rows, mapping, [], [], {
      parseNumber,
      t: (key: string) => key,
      onProgress: vi.fn(),
    });

    const createCall = mockInvoke.mock.calls.find(
      ([cmd]) => cmd === "create_transaction",
    );
    expect(createCall?.[1]).toMatchObject({
      args: { amount: 12.5 },
    });
  });

  it("parses en-US amounts with dot decimal", async () => {
    const parseNumber = (value: unknown) =>
      parseNumberWithLocale(value, "en-US");

    const rows = [
      {
        date: "2024-01-15",
        payee: "Store",
        amount: "12.50",
        account: "Checking",
        category: "Food",
      },
    ];

    await importTransactionsFromRows(rows, mapping, [], [], {
      parseNumber,
      t: (key: string) => key,
      onProgress: vi.fn(),
    });

    const createCall = mockInvoke.mock.calls.find(
      ([cmd]) => cmd === "create_transaction",
    );
    expect(createCall?.[1]).toMatchObject({
      args: { amount: 12.5 },
    });
  });
});
