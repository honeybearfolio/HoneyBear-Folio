import { useState, useEffect, useCallback } from "react";

import { rust } from "./api/tauri-client";
import Sidebar from "./components/layout/Sidebar";
import { computeNetWorth } from "./utils/networth";
import AccountDetails from "./features/accounts/AccountDetails";
import Dashboard from "./features/dashboard/Dashboard";
import InvestmentDashboard from "./features/investments/InvestmentDashboard";
import FireCalculator from "./features/fire/FireCalculator";
import RulesList from "./features/rules/RulesList";
import ScheduledList from "./features/scheduled/ScheduledList";
import ChatView from "./features/chat/ChatView";
import SettingsView from "./features/settings/SettingsView";
import SessionPicker from "./features/session/SessionPicker";
import { Wallet, PanelLeftOpen } from "lucide-react";
import "./styles/App.css";
import { ToastContainer } from "./components/ui/Toast";
import { ConfirmDialogContainer } from "./components/ui/ConfirmDialog";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import { NumberFormatEffects } from "./stores/number-format";
import { ThemeEffects } from "./stores/theme";
import ChartNumberFormatSync from "./components/shared/ChartNumberFormatSync";
import UpdateNotification from "./components/shared/UpdateNotification";
import WelcomeWindow from "./components/shared/WelcomeWindow";
import DevTools from "./components/shared/DevTools";
import { useTranslation } from "react-i18next";
import {
  APP_DEFAULTS,
  DEFAULT_SIDEBAR_VISIBILITY,
  STORAGE_KEYS,
} from "./constants/app";
import { fetchMarketValuesForAccounts } from "./utils/market-values";

function App() {
  // Session management — "picking" shows the session picker, "active" shows the main app
  const [sessionState, setSessionState] = useState<
    "loading" | "picking" | "active"
  >("loading");
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null,
  );

  useEffect(() => {
    rust
      .get_active_session()
      .then((_session) => {
        const session = _session as ActiveSession | null;
        if (session && session.file_exists) {
          setActiveSession(session);
          setSessionState("active");
        } else {
          setSessionState("picking");
        }
      })
      .catch(() => {
        setSessionState("picking");
      });
  }, []);

  function handleSessionReady(session: ActiveSession) {
    setActiveSession(session);
    setSessionState("active");
  }

  function handleSwitchSession() {
    setSessionState("picking");
  }

  if (sessionState === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900" />
    );
  }

  if (sessionState === "picking") {
    return (
      <>
        <NumberFormatEffects />
        <ThemeEffects />
        <SessionPicker onSessionReady={handleSessionReady} />
      </>
    );
  }

  return (
    <MainApp
      key={activeSession?.path || "default"}
      activeSession={activeSession}
      onSwitchSession={handleSwitchSession}
    />
  );
}

interface ActiveSession {
  path?: string;
  name?: string;
  file_exists?: boolean;
}

interface Account {
  id: string | number;
  name: string;
  balance: number;
  totalValue?: number;
  currency?: string;
  kind?: string;
  exchange_rate?: number;
}

type SettingsSection = "general" | "customization" | "formats" | "about";

interface MainAppProps {
  activeSession: ActiveSession | null;
  onSwitchSession: () => void;
}

function MainApp({ activeSession, onSwitchSession }: MainAppProps) {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState<number>(
    APP_DEFAULTS.SIDEBAR_WIDTH,
  );
  const [isResizing, setIsResizing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [marketValues, setMarketValues] = useState<Record<string, number>>({});
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("general");
  const [sidebarVisibility, setSidebarVisibility] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_VISIBILITY);
      const defaults = DEFAULT_SIDEBAR_VISIBILITY;
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
      return defaults;
    } catch {
      return DEFAULT_SIDEBAR_VISIBILITY;
    }
  });

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SIDEBAR_VISIBILITY,
      JSON.stringify(sidebarVisibility),
    );
  }, [sidebarVisibility]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        if (
          newWidth >= APP_DEFAULTS.SIDEBAR_MIN_WIDTH &&
          newWidth <= APP_DEFAULTS.SIDEBAR_MAX_WIDTH
        ) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, [isResizing]);

  const handleAccountUpdate = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  async function fetchAccounts(): Promise<Account[]> {
    try {
      const currency =
        localStorage.getItem(STORAGE_KEYS.CURRENCY) || APP_DEFAULTS.CURRENCY;
      const accs = (await rust.get_accounts({
        targetCurrency: currency,
      })) as Account[];
      accs.sort((a: Account, b: Account) => b.balance - a.balance);
      setAccounts(accs);
      return accs;
    } catch (e) {
      console.error("Failed to fetch accounts:", e);
      return [];
    }
  }

  async function fetchMarketValues(currentAccounts: Account[] = []) {
    try {
      const appCurrency =
        localStorage.getItem(STORAGE_KEYS.CURRENCY) || APP_DEFAULTS.CURRENCY;
      const values = await fetchMarketValuesForAccounts(
        currentAccounts as { id: number; currency?: string }[],
        appCurrency,
      );
      setMarketValues(values);
    } catch (e) {
      console.error("Failed to fetch market values:", e);
    }
  }

  useEffect(() => {
    const loadData = async () => {
      const accs = await fetchAccounts();
      await fetchMarketValues(accs);
    };
    loadData();
  }, [refreshTrigger]);

  // Clear saved FIRE calculator state at app startup so user inputs reset after the
  // app is closed and re-opened. We keep session persistence during the running
  // session (switching tabs) since `sessionStorage` is still used by the
  // `FireCalculator` component.
  useEffect(() => {
    try {
      sessionStorage.removeItem("fireCalculatorState");
    } catch (e) {
      // sessionStorage may be unavailable in some environments; ignore errors
      console.debug("Could not clear fireCalculatorState on startup:", e);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
      const fontSize = stored ? parseFloat(stored) : APP_DEFAULTS.FONT_SIZE;
      document.documentElement.style.setProperty(
        "--hb-font-size",
        String(fontSize),
      );
    } catch (e) {
      console.debug("Failed to apply font size:", e);
    }
  }, []);

  // Calculate total balance

  const totalBalance = computeNetWorth(
    accounts as { id: number; balance?: unknown; exchange_rate?: number }[],
    marketValues,
  );

  const totalCashBalance = accounts.reduce((sum, acc) => {
    const balance = Number(acc.balance) || 0;
    const rate = acc.exchange_rate || 1.0;
    return sum + balance * rate;
  }, 0);

  // Derive selectedAccount
  let selectedAccount = null;
  if (selectedAccountId === "dashboard") {
    selectedAccount = { id: "dashboard", name: t("nav.dashboard") };
  } else if (selectedAccountId === "investment-dashboard") {
    selectedAccount = {
      id: "investment-dashboard",
      name: t("nav.investments"),
    };
  } else if (selectedAccountId === "fire-calculator") {
    selectedAccount = { id: "fire-calculator", name: t("nav.fire_calculator") };
  } else if (selectedAccountId === "chat") {
    selectedAccount = { id: "chat", name: t("nav.ai_assistant") };
  } else if (selectedAccountId === "all") {
    selectedAccount = {
      id: "all",
      name: t("nav.all_transactions"),
      balance: totalCashBalance,
      totalValue: totalBalance,
    };
  } else {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    if (acc) {
      selectedAccount = {
        ...acc,
        balance: Number(acc.balance),
        totalValue:
          marketValues[acc.id] !== undefined
            ? Number(acc.balance) + Number(marketValues[acc.id])
            : Number(acc.balance),
      };
    }
  }

  // Global error overlay state
  const [globalError, setGlobalError] = useState<string | Error | null>(null);

  // Install global handlers to catch uncaught errors and promise rejections.
  // Defined with useCallback so the same stable function references are always
  // passed to both addEventListener and removeEventListener, preventing
  // handler accumulation across effect cleanup/re-run cycles.
  const handleWindowError = useCallback((event: ErrorEvent) => {
    console.error("Window error:", event.error || event.message, event);
    setGlobalError(event.error || event.message || "Unknown error");
  }, []);

  const handleRejection = useCallback((event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection:", event.reason || event);
    setGlobalError(event.reason || "Unhandled promise rejection");
  }, []);

  useEffect(() => {
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [handleWindowError, handleRejection]);

  return (
    <ErrorBoundary>
      <NumberFormatEffects />
      <ThemeEffects />
      <ChartNumberFormatSync />
      <UpdateNotification />
      <div
        className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
          className={`${
            isResizing
              ? "transition-none"
              : "transition-all duration-300 ease-in-out"
          } overflow-hidden flex-shrink-0 relative`}
        >
          <div style={{ width: sidebarWidth }} className="h-full relative flex">
            <div className="flex-1 w-full h-full overflow-hidden">
              <Sidebar
                accounts={
                  accounts as {
                    id: string | number;
                    name: string;
                    balance: number;
                    kind: string;
                  }[]
                }
                marketValues={marketValues}
                selectedId={selectedAccountId}
                onSelectAccount={(id: string | number) =>
                  setSelectedAccountId(String(id))
                }
                onUpdate={handleAccountUpdate}
                onClose={() => setIsSidebarOpen(false)}
                sidebarVisibility={sidebarVisibility}
                settingsSection={settingsSection}
                onChangeSettingsSection={setSettingsSection}
                activeSession={activeSession ?? undefined}
                onSwitchSession={onSwitchSession}
              />
            </div>
            <div
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-brand-500/50 active:bg-brand-500 z-50 transition-colors delay-100 hover:delay-0"
              onMouseDown={startResizing}
            />
          </div>
        </div>

        <main className="flex-1 min-w-0 px-4 py-4 md:py-8 overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
          <div
            className={`fixed top-4 left-4 z-50 transition-all duration-300 ${
              !isSidebarOpen
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-4 pointer-events-none"
            }`}
          >
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-brand-600 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title={t("app.show_sidebar")}
              aria-label={t("app.show_sidebar")}
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
          <div>
            {selectedAccountId === "settings" ? (
              <SettingsView
                activeSection={settingsSection}
                sidebarVisibility={sidebarVisibility}
                onChangeSidebarVisibility={setSidebarVisibility}
              />
            ) : selectedAccountId === "dashboard" ? (
              <Dashboard accounts={accounts} marketValues={marketValues} />
            ) : selectedAccountId === "investment-dashboard" ? (
              <InvestmentDashboard />
            ) : selectedAccountId === "fire-calculator" ? (
              <FireCalculator />
            ) : selectedAccountId === "rules" ? (
              <RulesList />
            ) : selectedAccountId === "scheduled" ? (
              <ScheduledList />
            ) : selectedAccountId === "chat" ? (
              <ChatView />
            ) : selectedAccount ? (
              <AccountDetails
                key={selectedAccount.id}
                account={selectedAccount}
                onUpdate={handleAccountUpdate}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none mb-8 animate-in fade-in zoom-in duration-500">
                  <Wallet className="w-16 h-16 text-brand-500" />
                </div>
                <h2 className="text-3xl font-bold mb-3 text-slate-800 dark:text-slate-100 tracking-tight">
                  {t("welcome.title")}
                </h2>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md text-center leading-relaxed">
                  {t("welcome.select_account")}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {globalError && (
        <div className="fixed inset-4 z-60 p-6 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
          <h3 className="text-lg font-bold mb-2">
            An unexpected error occurred
          </h3>
          <pre className="text-sm max-h-60 overflow-auto whitespace-pre-wrap">
            {typeof globalError === "string"
              ? globalError
              : globalError.stack || String(globalError)}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              className="bg-white dark:bg-slate-700 text-sm px-3 py-1 rounded border"
              onClick={() => {
                console.clear();
                setGlobalError(null);
              }}
            >
              Dismiss
            </button>
            <button
              className="bg-slate-700 text-white text-sm px-3 py-1 rounded"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )}
      <WelcomeWindow />
      <DevTools />
      <ToastContainer />
      <ConfirmDialogContainer />
      <div id="datepicker-portal" />
    </ErrorBoundary>
  );
}

export default App;
