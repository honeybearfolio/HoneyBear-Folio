import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { callRust, rust } from "../../api/tauri-client";

describe("tauri-client", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it("callRust invokes without args", async () => {
    await callRust("get_accounts");
    expect(invoke).toHaveBeenCalledWith("get_accounts");
  });

  it("callRust invokes with args", async () => {
    await callRust("get_transactions", { accountId: "acc1" });
    expect(invoke).toHaveBeenCalledWith("get_transactions", {
      accountId: "acc1",
    });
  });

  describe("scheduled occurrences", () => {
    it("forwards all occurrence commands", async () => {
      await rust.apply_scheduled_occurrence({
        scheduledTxId: 1,
        applyDate: "2024-01-01",
      });
      expect(invoke).toHaveBeenCalledWith("apply_scheduled_occurrence", {
        scheduledTxId: 1,
        applyDate: "2024-01-01",
      });

      await rust.skip_scheduled_occurrence({
        scheduledTxId: 2,
        skipDate: "2024-01-02",
      });
      expect(invoke).toHaveBeenCalledWith("skip_scheduled_occurrence", {
        scheduledTxId: 2,
        skipDate: "2024-01-02",
      });

      await rust.get_pending_occurrences({ accountId: "acc1" });
      expect(invoke).toHaveBeenCalledWith("get_pending_occurrences", {
        accountId: "acc1",
      });
    });
  });

  describe("currency and exchange rates", () => {
    it("forwards all currency commands", async () => {
      await rust.check_currency_availability({ currency: "EUR" });
      expect(invoke).toHaveBeenCalledWith("check_currency_availability", {
        currency: "EUR",
      });

      await rust.get_all_exchange_rates({ appCurrency: "USD" });
      expect(invoke).toHaveBeenCalledWith("get_all_exchange_rates", {
        appCurrency: "USD",
      });

      await rust.get_custom_exchange_rate({ currency: "GBP" });
      expect(invoke).toHaveBeenCalledWith("get_custom_exchange_rate", {
        currency: "GBP",
      });

      await rust.set_custom_exchange_rate({ currency: "GBP", rate: 1.25 });
      expect(invoke).toHaveBeenCalledWith("set_custom_exchange_rate", {
        currency: "GBP",
        rate: 1.25,
      });

      await rust.delete_custom_exchange_rate({ currency: "GBP" });
      expect(invoke).toHaveBeenCalledWith("delete_custom_exchange_rate", {
        currency: "GBP",
      });
    });
  });

  describe("rust-side compute helpers", () => {
    it("forwards all compute commands", async () => {
      const accounts = [{ id: 1, name: "A", balance: 0 }];
      await rust.compute_net_worth({
        accounts,
        marketValues: { AAPL: 100 },
      });
      expect(invoke).toHaveBeenCalledWith("compute_net_worth", {
        accounts,
        marketValues: { AAPL: 100 },
      });

      const transactions = [
        { id: 1, account_id: 1, amount: 10, date: "2024-01-01" },
      ];
      await rust.build_holdings_from_transactions({ transactions });
      expect(invoke).toHaveBeenCalledWith("build_holdings_from_transactions", {
        transactions,
      });

      const holdings = [{ ticker: "AAPL", shares: 1, costBasis: 100 }];
      const quotes = [{ ticker: "AAPL", price: 150 }];
      await rust.merge_holdings_with_quotes({ holdings, quotes });
      expect(invoke).toHaveBeenCalledWith("merge_holdings_with_quotes", {
        holdings,
        quotes,
      });

      const merged = [{ ticker: "AAPL", shares: 1, currentValue: 150 }];
      await rust.compute_portfolio_totals({ holdings: merged });
      expect(invoke).toHaveBeenCalledWith("compute_portfolio_totals", {
        holdings: merged,
      });

      await rust.compute_net_worth_market_values({ transactions, quotes });
      expect(invoke).toHaveBeenCalledWith("compute_net_worth_market_values", {
        transactions,
        quotes,
      });
    });
  });

  describe("FIRE projections", () => {
    it("forwards projection commands", async () => {
      const input = { currentAge: 30 };
      await rust.calculate_deterministic_projection({ input });
      expect(invoke).toHaveBeenCalledWith(
        "calculate_deterministic_projection",
        {
          input,
        },
      );

      await rust.run_monte_carlo_simulation({ input });
      expect(invoke).toHaveBeenCalledWith("run_monte_carlo_simulation", {
        input,
      });
    });
  });

  describe("reports", () => {
    it("forwards report commands", async () => {
      const input = {
        accounts: [],
        transactions: [],
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        appCurrency: "USD",
        exchangeRates: {},
        quotes: [],
        labels: {},
      };
      await rust.compute_report_data({ input });
      expect(invoke).toHaveBeenCalledWith("compute_report_data", { input });

      const data = {
        date_range_start: "2024-01-01",
        date_range_end: "2024-12-31",
      };
      await rust.generate_pdf_report({ filePath: "/tmp/report.pdf", data });
      expect(invoke).toHaveBeenCalledWith("generate_pdf_report", {
        filePath: "/tmp/report.pdf",
        data,
      });
    });
  });

  describe("accounts", () => {
    it("forwards all account commands", async () => {
      await rust.create_account({ name: "Checking" });
      expect(invoke).toHaveBeenCalledWith("create_account", {
        name: "Checking",
      });

      await rust.get_accounts({ targetCurrency: "EUR" });
      expect(invoke).toHaveBeenCalledWith("get_accounts", {
        targetCurrency: "EUR",
      });

      await rust.rename_account({ id: 1, newName: "Savings" });
      expect(invoke).toHaveBeenCalledWith("rename_account", {
        id: 1,
        newName: "Savings",
      });

      await rust.update_account({ id: 1, name: "Savings", currency: "USD" });
      expect(invoke).toHaveBeenCalledWith("update_account", {
        id: 1,
        name: "Savings",
        currency: "USD",
      });

      await rust.delete_account({ id: 1 });
      expect(invoke).toHaveBeenCalledWith("delete_account", { id: 1 });
    });
  });

  describe("sessions", () => {
    it("forwards all session commands", async () => {
      await rust.create_session({ path: "/data/session" });
      expect(invoke).toHaveBeenCalledWith("create_session", {
        path: "/data/session",
      });

      await rust.open_session({ path: "/data/session" });
      expect(invoke).toHaveBeenCalledWith("open_session", {
        path: "/data/session",
      });

      await rust.get_active_session();
      expect(invoke).toHaveBeenCalledWith("get_active_session");

      await rust.get_recent_sessions();
      expect(invoke).toHaveBeenCalledWith("get_recent_sessions");

      await rust.remove_recent_session({ path: "/old" });
      expect(invoke).toHaveBeenCalledWith("remove_recent_session", {
        path: "/old",
      });

      await rust.rename_session({ path: "/data/session", newName: "Main" });
      expect(invoke).toHaveBeenCalledWith("rename_session", {
        path: "/data/session",
        newName: "Main",
      });
    });
  });

  describe("transactions", () => {
    it("forwards all transaction commands", async () => {
      const txArgs = { args: { accountId: 1, amount: 10 } };
      await rust.create_transaction(txArgs);
      expect(invoke).toHaveBeenCalledWith("create_transaction", txArgs);

      await rust.create_investment_transaction(txArgs);
      expect(invoke).toHaveBeenCalledWith(
        "create_investment_transaction",
        txArgs,
      );

      await rust.get_transactions({ accountId: 1 });
      expect(invoke).toHaveBeenCalledWith("get_transactions", { accountId: 1 });

      await rust.get_all_transactions();
      expect(invoke).toHaveBeenCalledWith("get_all_transactions");

      await rust.update_transaction(txArgs);
      expect(invoke).toHaveBeenCalledWith("update_transaction", txArgs);

      await rust.update_investment_transaction(txArgs);
      expect(invoke).toHaveBeenCalledWith(
        "update_investment_transaction",
        txArgs,
      );

      await rust.delete_transaction({ id: 5 });
      expect(invoke).toHaveBeenCalledWith("delete_transaction", { id: 5 });
    });
  });

  describe("rules", () => {
    it("forwards all rule commands", async () => {
      const ruleArgs = { args: { name: "Rule 1" } };
      await rust.create_rule(ruleArgs);
      expect(invoke).toHaveBeenCalledWith("create_rule", ruleArgs);

      await rust.get_rules();
      expect(invoke).toHaveBeenCalledWith("get_rules");

      await rust.update_rule(ruleArgs);
      expect(invoke).toHaveBeenCalledWith("update_rule", ruleArgs);

      await rust.update_rules_order({ ruleIds: [2, 1] });
      expect(invoke).toHaveBeenCalledWith("update_rules_order", {
        ruleIds: [2, 1],
      });

      await rust.delete_rule({ id: 1 });
      expect(invoke).toHaveBeenCalledWith("delete_rule", { id: 1 });
    });
  });

  describe("scheduled transactions", () => {
    it("forwards all scheduled transaction commands", async () => {
      const schedArgs = { args: { payee: "Rent" } };
      await rust.create_scheduled_transaction(schedArgs);
      expect(invoke).toHaveBeenCalledWith(
        "create_scheduled_transaction",
        schedArgs,
      );

      await rust.get_scheduled_transactions();
      expect(invoke).toHaveBeenCalledWith("get_scheduled_transactions");

      await rust.update_scheduled_transaction(schedArgs);
      expect(invoke).toHaveBeenCalledWith(
        "update_scheduled_transaction",
        schedArgs,
      );

      await rust.delete_scheduled_transaction({ id: 3 });
      expect(invoke).toHaveBeenCalledWith("delete_scheduled_transaction", {
        id: 3,
      });
    });
  });

  describe("stock quotes and daily prices", () => {
    it("forwards all market data commands", async () => {
      await rust.get_stock_quotes({ tickers: ["AAPL", "MSFT"] });
      expect(invoke).toHaveBeenCalledWith("get_stock_quotes", {
        tickers: ["AAPL", "MSFT"],
      });

      await rust.get_daily_stock_prices({ ticker: "AAPL" });
      expect(invoke).toHaveBeenCalledWith("get_daily_stock_prices", {
        ticker: "AAPL",
      });

      await rust.update_daily_stock_prices({ tickers: ["AAPL"] });
      expect(invoke).toHaveBeenCalledWith("update_daily_stock_prices", {
        tickers: ["AAPL"],
      });

      await rust.search_ticker({ query: "app" });
      expect(invoke).toHaveBeenCalledWith("search_ticker", { query: "app" });
    });
  });

  describe("lookups", () => {
    it("forwards lookup commands", async () => {
      await rust.get_categories();
      expect(invoke).toHaveBeenCalledWith("get_categories");

      await rust.get_payees();
      expect(invoke).toHaveBeenCalledWith("get_payees");

      await rust.get_system_theme();
      expect(invoke).toHaveBeenCalledWith("get_system_theme");
    });
  });

  describe("database path", () => {
    it("forwards database path commands", async () => {
      await rust.get_db_path_command();
      expect(invoke).toHaveBeenCalledWith("get_db_path_command");

      await rust.set_db_path({ path: "/custom/db.sqlite" });
      expect(invoke).toHaveBeenCalledWith("set_db_path", {
        path: "/custom/db.sqlite",
      });

      await rust.reset_db_path();
      expect(invoke).toHaveBeenCalledWith("reset_db_path");
    });
  });

  describe("xlsx import/export", () => {
    it("forwards xlsx commands", async () => {
      await rust.read_xlsx({ data: [1, 2, 3] });
      expect(invoke).toHaveBeenCalledWith("read_xlsx", { data: [1, 2, 3] });

      const sheets = [{ name: "Sheet1", data: [{ a: 1 }] }];
      await rust.write_xlsx({ filePath: "/tmp/out.xlsx", sheets });
      expect(invoke).toHaveBeenCalledWith("write_xlsx", {
        filePath: "/tmp/out.xlsx",
        sheets,
      });
    });
  });

  describe("LLM and chat", () => {
    it("forwards all LLM commands", async () => {
      await rust.llm_chat({
        conversationId: "c1",
        userMessage: "Hello",
        think: true,
      });
      expect(invoke).toHaveBeenCalledWith("llm_chat", {
        conversationId: "c1",
        userMessage: "Hello",
        think: true,
      });

      await rust.cancel_llm_chat({ conversationId: "c1" });
      expect(invoke).toHaveBeenCalledWith("cancel_llm_chat", {
        conversationId: "c1",
      });

      await rust.get_llm_settings();
      expect(invoke).toHaveBeenCalledWith("get_llm_settings");

      await rust.set_llm_settings({
        ollamaUrl: "http://localhost:11434",
        ollamaModel: "llama3",
      });
      expect(invoke).toHaveBeenCalledWith("set_llm_settings", {
        ollamaUrl: "http://localhost:11434",
        ollamaModel: "llama3",
      });

      await rust.list_ollama_models();
      expect(invoke).toHaveBeenCalledWith("list_ollama_models");

      await rust.check_ollama_connection();
      expect(invoke).toHaveBeenCalledWith("check_ollama_connection");

      await rust.get_conversations();
      expect(invoke).toHaveBeenCalledWith("get_conversations");

      await rust.get_conversation_messages({ conversationId: "c1" });
      expect(invoke).toHaveBeenCalledWith("get_conversation_messages", {
        conversationId: "c1",
      });

      await rust.create_conversation({ title: "New chat" });
      expect(invoke).toHaveBeenCalledWith("create_conversation", {
        title: "New chat",
      });

      await rust.delete_conversation({ conversationId: "c1" });
      expect(invoke).toHaveBeenCalledWith("delete_conversation", {
        conversationId: "c1",
      });

      await rust.rename_conversation({
        conversationId: "c1",
        title: "Renamed",
      });
      expect(invoke).toHaveBeenCalledWith("rename_conversation", {
        conversationId: "c1",
        title: "Renamed",
      });

      await rust.delete_all_conversations();
      expect(invoke).toHaveBeenCalledWith("delete_all_conversations");
    });
  });

  describe("assets", () => {
    it("forwards all asset commands", async () => {
      await rust.create_asset({
        name: "House",
        category: "real_estate",
        currency: "USD",
      });
      expect(invoke).toHaveBeenCalledWith("create_asset", {
        name: "House",
        category: "real_estate",
        currency: "USD",
      });

      await rust.get_assets({ targetCurrency: "EUR" });
      expect(invoke).toHaveBeenCalledWith("get_assets", {
        targetCurrency: "EUR",
      });

      await rust.update_asset({
        id: 1,
        name: "House",
        category: "real_estate",
      });
      expect(invoke).toHaveBeenCalledWith("update_asset", {
        id: 1,
        name: "House",
        category: "real_estate",
      });

      await rust.delete_asset({ id: 1 });
      expect(invoke).toHaveBeenCalledWith("delete_asset", { id: 1 });

      await rust.create_valuation({
        assetId: 1,
        date: "2024-01-01",
        value: 100,
      });
      expect(invoke).toHaveBeenCalledWith("create_valuation", {
        assetId: 1,
        date: "2024-01-01",
        value: 100,
      });

      await rust.get_valuations({ assetId: 1 });
      expect(invoke).toHaveBeenCalledWith("get_valuations", { assetId: 1 });

      await rust.update_valuation({ id: 1, date: "2024-06-01", value: 120 });
      expect(invoke).toHaveBeenCalledWith("update_valuation", {
        id: 1,
        date: "2024-06-01",
        value: 120,
      });

      await rust.delete_valuation({ id: 1 });
      expect(invoke).toHaveBeenCalledWith("delete_valuation", { id: 1 });

      await rust.get_total_assets_value({ targetCurrency: "USD" });
      expect(invoke).toHaveBeenCalledWith("get_total_assets_value", {
        targetCurrency: "USD",
      });
    });
  });
});
