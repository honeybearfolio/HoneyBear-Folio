import { useState, useMemo, useRef, useEffect } from "react";
import ImportModal from "../shared/ImportModal";
import ExportModal from "../shared/ExportModal";
import AccountModal from "../../features/accounts/AccountModal";
import AccountList from "../../features/accounts/AccountList";
import {
  Plus,
  CreditCard,
  TrendingUp,
  LayoutDashboard,
  List,
  PieChart,
  Calculator,
  Download,
  Upload,
  Settings,
  SlidersHorizontal,
  Brush,
  Globe,
  Info,
  Eye,
  EyeOff,
  PanelLeftClose,
  ArrowUpDown,
  BookOpenCheck,
  CalendarClock,
  ArrowLeft,
  RefreshCw,
  Bot,
  Gem,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import "../../styles/Sidebar.css";
import { useFormatNumber } from "../../utils/format";
import { usePrivacy } from "../../stores/privacy";
import MaskedNumber from "../ui/MaskedNumber";
import { rust } from "../../api/tauri-client";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";
import type { Account } from "../../api/types";
import { STORAGE_KEYS } from "../../constants/app";

interface SidebarVisibility {
  dashboard?: boolean;
  investments?: boolean;
  fire?: boolean;
  chat?: boolean;
  rules?: boolean;
  scheduled?: boolean;
  all?: boolean;
  [key: string]: boolean | undefined;
}

interface ActiveSession {
  path?: string;
  name?: string;
}

type SettingsSection = "general" | "customization" | "formats" | "about";

interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

interface SidebarProps {
  accounts: Account[];
  marketValues: Record<string | number, number>;
  totalBalance?: number;
  selectedId: string | number;
  onSelectAccount: (id: string | number) => void;
  onUpdate: () => void;
  onClose: () => void;
  sidebarVisibility: SidebarVisibility;
  settingsSection?: SettingsSection;
  onChangeSettingsSection?: (section: SettingsSection) => void;
  activeSession?: ActiveSession;
  onSwitchSession?: () => void;
}

export default function Sidebar({
  accounts,
  marketValues,
  totalBalance = 0,
  selectedId,
  onSelectAccount,
  onUpdate,
  onClose,
  sidebarVisibility,
  settingsSection,
  onChangeSettingsSection,
  activeSession,
  onSwitchSession,
}: SidebarProps) {
  const { t } = useTranslation();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const formatNumber = useFormatNumber();
  const formattedTotalBalance = formatNumber(totalBalance, {
    style: "currency",
  });
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT_SORT_CONFIG);
      return stored
        ? (JSON.parse(stored) as SortConfig)
        : { field: "name", direction: "asc" };
    } catch {
      return { field: "name", direction: "asc" };
    }
  });
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [manualOrder, setManualOrder] = useState<(string | number)[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT_ORDER);
      return stored ? (JSON.parse(stored) as (string | number)[]) : [];
    } catch {
      return [];
    }
  });

  const sortedAccounts = useMemo(() => {
    const list = [...accounts];

    if (sortConfig.field === "manual") {
      list.sort((a, b) => {
        const indexA = manualOrder.indexOf(a.id);
        const indexB = manualOrder.indexOf(b.id);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA === -1 && indexB !== -1) return 1;
        if (indexA !== -1 && indexB === -1) return -1;
        return a.name.localeCompare(b.name);
      });
      return list;
    }

    list.sort((a, b) => {
      let valA: string | number = 0,
        valB: string | number = 0;

      if (sortConfig.field === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortConfig.field === "balance") {
        valA = Number(a.balance);
        valB = Number(b.balance);
      } else if (sortConfig.field === "value") {
        const cashA = Number(a.balance);
        const marketA = marketValues?.[a.id] ? Number(marketValues[a.id]) : 0;
        valA = cashA + marketA;

        const cashB = Number(b.balance);
        const marketB = marketValues?.[b.id] ? Number(marketValues[b.id]) : 0;
        valB = cashB + marketB;
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [accounts, marketValues, sortConfig, manualOrder]);

  const handleSort = (field: string, direction: "asc" | "desc") => {
    const newConfig = { field, direction };
    setSortConfig(newConfig);
    setShowSortMenu(false);
    localStorage.setItem(
      STORAGE_KEYS.ACCOUNT_SORT_CONFIG,
      JSON.stringify(newConfig),
    );
  };

  const handleReorder = (newAccountsList: { id: string | number }[]) => {
    const newOrder = newAccountsList.map((a) => a.id);
    setManualOrder(newOrder);
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_ORDER, JSON.stringify(newOrder));
  };

  const handleSelect = (id: string | number) => {
    onSelectAccount(id);
  };

  const confirm = useConfirm();
  const { showToast } = useToast();

  async function handleRenameAccount(id: string | number, newName: string) {
    try {
      await rust.rename_account({ id, newName });
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to rename account:", e);
      showToast(t("error.failed_to_rename"), { type: "error" });
    }
  }

  async function handleDeleteAccount(id: string | number) {
    const account = accounts.find((a) => a.id === id);
    const confirmed = await confirm(
      t("confirm.delete_account", { name: account?.name ?? id }),
      {
        title: t("confirm.delete_title"),
        kind: "warning",
        okLabel: t("confirm.delete"),
        cancelLabel: t("account.cancel"),
      },
    );
    if (!confirmed) return;
    try {
      await rust.delete_account({ id });
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to delete account:", e);
      showToast(t("error.failed_to_delete"), { type: "error" });
    }
  }

  return (
    <div className="sidebar-container">
      {/* Header */}
      <div className="sidebar-header">
        <div className="flex items-center justify-between mb-8">
          <div className="sidebar-logo-container mb-0">
            <img
              src="/icon.png"
              alt="HoneyBear Folio"
              className="w-10 h-10 object-contain"
            />
            <div>
              <span className="text-xl font-bold text-bear-100">
                HoneyBear <span className="text-brand-500">Folio</span>
              </span>
              <p className="sidebar-subtitle">{t("sidebar.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            title={t("app.hide_sidebar")}
            aria-label={t("app.hide_sidebar")}
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Net Worth Card — hidden in settings mode */}
        {selectedId !== "settings" && (
          <div className="net-worth-card">
            <div className="flex items-center justify-between mb-2">
              <div className="net-worth-label !mb-0">
                <TrendingUp className="w-3.5 h-3.5" />
                {t("sidebar.net_worth")}
              </div>
              <button
                onClick={togglePrivacyMode}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700/50"
                title={
                  isPrivacyMode
                    ? t("sidebar.show_values")
                    : t("sidebar.hide_values")
                }
                aria-label={
                  isPrivacyMode
                    ? t("sidebar.show_values")
                    : t("sidebar.hide_values")
                }
              >
                {isPrivacyMode ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <div
              className={`net-worth-value ${
                formattedTotalBalance.length > 20
                  ? "text-lg"
                  : formattedTotalBalance.length > 15
                    ? "text-xl"
                    : "text-2xl"
              }`}
            >
              <MaskedNumber
                value={totalBalance}
                options={{ style: "currency" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        {selectedId === "settings" ? (
          /* Settings sub-navigation */
          <div>
            <button
              onClick={() => handleSelect("dashboard")}
              className="sidebar-back-button group mb-6"
            >
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span className="font-medium">{t("settings.back")}</span>
            </button>
            <h2 className="sidebar-section-title">{t("nav.settings")}</h2>
            <div className="space-y-1">
              <button
                onClick={() => onChangeSettingsSection?.("general")}
                className={`sidebar-nav-item group ${
                  settingsSection === "general"
                    ? "sidebar-nav-item-active"
                    : "sidebar-nav-item-inactive"
                }`}
              >
                <SlidersHorizontal
                  className={`sidebar-nav-icon ${settingsSection === "general" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                />
                <span className="font-medium">{t("settings.general")}</span>
              </button>
              {sidebarVisibility && (
                <button
                  onClick={() => onChangeSettingsSection?.("customization")}
                  className={`sidebar-nav-item group ${
                    settingsSection === "customization"
                      ? "sidebar-nav-item-active"
                      : "sidebar-nav-item-inactive"
                  }`}
                >
                  <Brush
                    className={`sidebar-nav-icon ${settingsSection === "customization" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                  />
                  <span className="font-medium">
                    {t("settings.customization")}
                  </span>
                </button>
              )}
              <button
                onClick={() => onChangeSettingsSection?.("formats")}
                className={`sidebar-nav-item group ${
                  settingsSection === "formats"
                    ? "sidebar-nav-item-active"
                    : "sidebar-nav-item-inactive"
                }`}
              >
                <Globe
                  className={`sidebar-nav-icon ${settingsSection === "formats" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                />
                <span className="font-medium">{t("settings.formats")}</span>
              </button>
              <button
                onClick={() => onChangeSettingsSection?.("about")}
                className={`sidebar-nav-item group ${
                  settingsSection === "about"
                    ? "sidebar-nav-item-active"
                    : "sidebar-nav-item-inactive"
                }`}
              >
                <Info
                  className={`sidebar-nav-icon ${settingsSection === "about" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                />
                <span className="font-medium">{t("settings.about")}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal navigation */
          <>
            <div>
              <h2 className="sidebar-section-title">{t("nav.overview")}</h2>
              <div className="space-y-1">
                {sidebarVisibility.dashboard !== false && (
                  <button
                    onClick={() => handleSelect("dashboard")}
                    className={`sidebar-nav-item group ${
                      selectedId === "dashboard"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <LayoutDashboard
                      className={`sidebar-nav-icon ${selectedId === "dashboard" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">{t("nav.dashboard")}</span>
                  </button>
                )}

                {sidebarVisibility.investments !== false && (
                  <button
                    onClick={() => handleSelect("investment-dashboard")}
                    className={`sidebar-nav-item group ${
                      selectedId === "investment-dashboard"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <PieChart
                      className={`sidebar-nav-icon ${selectedId === "investment-dashboard" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">{t("nav.investments")}</span>
                  </button>
                )}

                {sidebarVisibility.assets !== false && (
                  <button
                    onClick={() => handleSelect("asset-tracker")}
                    className={`sidebar-nav-item group ${
                      selectedId === "asset-tracker"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <Gem
                      className={`sidebar-nav-icon ${selectedId === "asset-tracker" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">{t("nav.assets")}</span>
                  </button>
                )}

                {sidebarVisibility.fire !== false && (
                  <button
                    onClick={() => handleSelect("fire-calculator")}
                    className={`sidebar-nav-item group ${
                      selectedId === "fire-calculator"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <Calculator
                      className={`sidebar-nav-icon ${selectedId === "fire-calculator" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">
                      {t("nav.fire_calculator")}
                    </span>
                  </button>
                )}

                {sidebarVisibility.chat !== false && (
                  <button
                    onClick={() => handleSelect("chat")}
                    className={`sidebar-nav-item group ${
                      selectedId === "chat"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <Bot
                      className={`sidebar-nav-icon ${selectedId === "chat" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">{t("nav.ai_assistant")}</span>
                  </button>
                )}

                {sidebarVisibility.rules !== false && (
                  <button
                    onClick={() => handleSelect("rules")}
                    className={`sidebar-nav-item group ${
                      selectedId === "rules"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <BookOpenCheck
                      className={`sidebar-nav-icon ${selectedId === "rules" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">{t("nav.rules")}</span>
                  </button>
                )}

                {sidebarVisibility.scheduled !== false && (
                  <button
                    onClick={() => handleSelect("scheduled")}
                    className={`sidebar-nav-item group ${
                      selectedId === "scheduled"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <CalendarClock
                      className={`sidebar-nav-icon ${selectedId === "scheduled" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">{t("nav.scheduled")}</span>
                  </button>
                )}

                {sidebarVisibility.all !== false && (
                  <button
                    onClick={() => handleSelect("all")}
                    className={`sidebar-nav-item group ${
                      selectedId === "all"
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }`}
                  >
                    <List
                      className={`sidebar-nav-icon ${selectedId === "all" ? "sidebar-nav-icon-active" : "sidebar-nav-icon-inactive"}`}
                    />
                    <span className="font-medium">
                      {t("nav.all_transactions")}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Accounts */}
            <div>
              <div className="sidebar-section-header">
                <h2 className="sidebar-section-title-inline">
                  {t("dashboard.accounts_breakdown")}
                </h2>
                <div className="flex items-center gap-1">
                  <div className="relative" ref={sortMenuRef}>
                    <button
                      onClick={() => setShowSortMenu(!showSortMenu)}
                      className="sidebar-add-button"
                      title={t("sort.sort_by")}
                      aria-label={t("sort.sort_by")}
                      aria-haspopup="true"
                      aria-expanded={showSortMenu}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-full mt-2 min-w-[12rem] max-w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/50 border-b border-slate-700/50">
                            {t("sort.sort_by")}
                          </div>
                          {[
                            {
                              label: t("sort.manual"),
                              field: "manual",
                              dir: "asc" as const,
                            },
                            {
                              label: t("sort.name_asc"),
                              field: "name",
                              dir: "asc" as const,
                            },
                            {
                              label: t("sort.name_desc"),
                              field: "name",
                              dir: "desc" as const,
                            },
                            {
                              label: t("sort.balance_asc"),
                              field: "balance",
                              dir: "asc" as const,
                            },
                            {
                              label: t("sort.balance_desc"),
                              field: "balance",
                              dir: "desc" as const,
                            },
                            {
                              label: t("sort.value_asc"),
                              field: "value",
                              dir: "asc" as const,
                            },
                            {
                              label: t("sort.value_desc"),
                              field: "value",
                              dir: "desc" as const,
                            },
                          ].map((opt) => (
                            <button
                              key={`${opt.field}-${opt.dir}`}
                              onClick={() => handleSort(opt.field, opt.dir)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between ${
                                sortConfig.field === opt.field &&
                                sortConfig.direction === opt.dir
                                  ? "text-brand-400 bg-slate-700/50"
                                  : "text-slate-300"
                              }`}
                            >
                              {opt.label}
                              {sortConfig.field === opt.field &&
                                sortConfig.direction === opt.dir && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                                )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="sidebar-add-button"
                    aria-label={t("account.new_account")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <AccountList
                accounts={sortedAccounts}
                selectedId={selectedId}
                onSelectAccount={onSelectAccount}
                marketValues={marketValues}
                Icon={CreditCard}
                onReorder={handleReorder}
                isDraggable={sortConfig.field === "manual"}
                onRenameAccount={handleRenameAccount}
                onDeleteAccount={handleDeleteAccount}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {activeSession && onSwitchSession && (
          <button
            onClick={onSwitchSession}
            className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            title={t("session.switch_session")}
            aria-label={t("session.switch_session")}
          >
            <RefreshCw className="w-3 h-3" />
            <span className="truncate">{activeSession.name}</span>
          </button>
        )}
        <div className="sidebar-footer-buttons">
          <button
            onClick={() => setShowImportModal(true)}
            className="sidebar-footer-button"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-medium">{t("footer.import")}</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="sidebar-footer-button"
          >
            <Upload className="w-4 h-4" />
            <span className="text-xs font-medium">{t("footer.export")}</span>
          </button>
          <button
            onClick={() =>
              handleSelect(selectedId === "settings" ? "dashboard" : "settings")
            }
            className="sidebar-footer-button"
          >
            <Settings className="w-4 h-4" />
            <span className="text-xs font-medium">{t("footer.settings")}</span>
          </button>
        </div>
      </div>

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            onUpdate();
          }}
        />
      )}

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
