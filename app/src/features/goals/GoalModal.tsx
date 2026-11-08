import { useMemo, useState } from "react";
import { rust } from "../../api/tauri-client";
import type { Account, Goal, GoalLinkInput } from "../../api/types";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import CustomSelect from "../../components/ui/CustomSelect";
import { useTranslation } from "react-i18next";
import { CURRENCIES } from "../../utils/currencies";
import { useToast } from "../../stores/toast";
import { handleAsyncError } from "../../utils/errors";
import type { HoldingValueMap } from "../../utils/market-values";
import {
  holdingOverlapsAccountLink,
  progressLinkFromInput,
  tickersForAccount,
} from "../../utils/goal-progress";
import { GOAL_COLORS, goalColorClasses } from "./goal-colors";
import { Trash2 } from "lucide-react";
import "../../styles/Modal.css";

interface DraftLink {
  sourceType: "account" | "holding";
  accountId: string;
  ticker: string;
  allocation: string;
}

interface GoalModalProps {
  goal?: Goal | null;
  accounts: Account[];
  holdingValues: HoldingValueMap;
  onClose: () => void;
  onSaved: () => void;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDrafts(goal?: Goal | null): DraftLink[] {
  if (!goal) return [];
  return goal.links.map((link) => ({
    sourceType: link.source_type,
    accountId: link.account_id == null ? "" : String(link.account_id),
    ticker: link.ticker ?? "",
    allocation: String(link.allocation_percent),
  }));
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none";

export default function GoalModal({
  goal = null,
  accounts,
  holdingValues,
  onClose,
  onSaved,
}: GoalModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = !!goal;

  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(
    goal ? String(goal.target_amount) : "",
  );
  const [currency, setCurrency] = useState(goal?.currency ?? "");
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [monthly, setMonthly] = useState(
    goal?.monthly_contribution != null ? String(goal.monthly_contribution) : "",
  );
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [color, setColor] = useState(goal?.color || "brand");
  const [links, setLinks] = useState<DraftLink[]>(() => toDrafts(goal));
  const [saving, setSaving] = useState(false);

  const currencyOptions = CURRENCIES.map((item) => ({
    value: item.code,
    label: `${item.code} (${item.symbol}) – ${item.name}`,
  }));

  const accountOptions = accounts.map((account) => ({
    value: String(account.id),
    label: account.name,
  }));

  const draftInputs: GoalLinkInput[] = links.map((link) => ({
    sourceType: link.sourceType,
    accountId: link.accountId ? Number(link.accountId) : null,
    ticker: link.sourceType === "holding" ? link.ticker : null,
    allocationPercent: Number(link.allocation),
  }));
  const progressLinks = draftInputs.map(progressLinkFromInput);
  const hasOverlap = progressLinks.some((link) =>
    holdingOverlapsAccountLink(link, progressLinks, holdingValues),
  );

  const sourceOptions = useMemo(
    () => [
      { value: "account", label: t("goals.link.account") },
      { value: "holding", label: t("goals.link.holding") },
    ],
    [t],
  );

  function updateLink(index: number, patch: Partial<DraftLink>) {
    setLinks((current) =>
      current.map((link, linkIndex) =>
        linkIndex === index ? { ...link, ...patch } : link,
      ),
    );
  }

  function addLink() {
    setLinks((current) => [
      ...current,
      {
        sourceType: "account",
        accountId: accounts[0] ? String(accounts[0].id) : "",
        ticker: "",
        allocation: "100",
      },
    ]);
  }

  function validate(): GoalLinkInput[] | null {
    if (!name.trim()) {
      showToast(t("goals.error.empty_name"), { type: "warning" });
      return null;
    }
    const target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      showToast(t("goals.error.target"), { type: "warning" });
      return null;
    }
    if (monthly.trim()) {
      const monthlyValue = Number(monthly);
      if (!Number.isFinite(monthlyValue) || monthlyValue <= 0) {
        showToast(t("goals.error.monthly"), { type: "warning" });
        return null;
      }
    }

    const cleaned: GoalLinkInput[] = [];
    const seen = new Set<string>();
    for (const link of links) {
      const allocation = Number(link.allocation);
      if (!Number.isFinite(allocation) || allocation < 1 || allocation > 100) {
        showToast(t("goals.error.allocation"), { type: "warning" });
        return null;
      }
      if (link.sourceType === "account") {
        if (!link.accountId) {
          showToast(t("goals.error.link_account"), { type: "warning" });
          return null;
        }
        const key = `account:${link.accountId}`;
        if (seen.has(key)) {
          showToast(t("goals.error.duplicate"), { type: "warning" });
          return null;
        }
        seen.add(key);
        cleaned.push({
          sourceType: "account",
          accountId: Number(link.accountId),
          ticker: null,
          allocationPercent: allocation,
        });
      } else {
        const ticker = link.ticker.trim();
        if (!ticker) {
          showToast(t("goals.error.link_ticker"), { type: "warning" });
          return null;
        }
        const key = `holding:${link.accountId || "*"}:${ticker.toLowerCase()}`;
        if (seen.has(key)) {
          showToast(t("goals.error.duplicate"), { type: "warning" });
          return null;
        }
        seen.add(key);
        cleaned.push({
          sourceType: "holding",
          accountId: link.accountId ? Number(link.accountId) : null,
          ticker,
          allocationPercent: allocation,
        });
      }
    }
    return cleaned;
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedLinks = validate();
    if (!cleanedLinks) return;

    const payload = {
      name: name.trim(),
      targetAmount: Number(targetAmount),
      currency: blankToNull(currency),
      targetDate: blankToNull(targetDate),
      monthlyContribution: monthly.trim() ? Number(monthly) : null,
      notes: blankToNull(notes),
      color,
      links: cleanedLinks,
    };

    setSaving(true);
    try {
      if (goal) {
        await rust.update_goal({
          ...payload,
          id: goal.id,
          archived: goal.archived,
        });
        showToast(t("goals.updated"), { type: "success" });
      } else {
        await rust.create_goal(payload);
        showToast(t("goals.created"), { type: "success" });
      }
      onSaved();
    } catch (err) {
      handleAsyncError({
        context: "Failed to save goal",
        error: err,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} size="lg">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <ModalHeader onClose={onClose}>
          {isEditing ? t("goals.edit") : t("goals.add")}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="goal-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {t("goals.field.name")}
              </label>
              <input
                id="goal-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className={fieldClass}
                placeholder={t("goals.placeholder.name")}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="goal-target"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t("goals.field.target")}
                </label>
                <input
                  id="goal-target"
                  type="number"
                  min="0"
                  step="any"
                  value={targetAmount}
                  onChange={(event) => {
                    setTargetAmount(event.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t("goals.field.currency")}
                </label>
                <CustomSelect
                  aria-label={t("goals.field.currency")}
                  options={[
                    { value: "", label: t("goals.default_currency") },
                    ...currencyOptions,
                  ]}
                  value={currency}
                  onChange={(value) => {
                    setCurrency(String(value));
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="goal-date"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t("goals.field.target_date")}
                </label>
                <input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(event) => {
                    setTargetDate(event.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="goal-monthly"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t("goals.field.monthly")}
                </label>
                <input
                  id="goal-monthly"
                  type="number"
                  min="0"
                  step="any"
                  value={monthly}
                  onChange={(event) => {
                    setMonthly(event.target.value);
                  }}
                  className={fieldClass}
                  placeholder={t("goals.optional")}
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t("goals.field.color")}
              </span>
              <div className="flex flex-wrap gap-2">
                {GOAL_COLORS.map((option) => {
                  const classes = goalColorClasses(option);
                  const selected = color === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-label={t(`goals.color.${option}`)}
                      aria-pressed={selected}
                      onClick={() => {
                        setColor(option);
                      }}
                      className={`h-7 w-7 rounded-full ${classes.swatch} cursor-pointer ${
                        selected
                          ? "ring-2 ring-offset-2 ring-slate-500 dark:ring-offset-slate-800"
                          : ""
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="goal-notes"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {t("goals.field.notes")}
              </label>
              <textarea
                id="goal-notes"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                }}
                rows={2}
                className={`${fieldClass} resize-none`}
                placeholder={t("goals.placeholder.notes")}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("goals.field.links")}
                </span>
                <button
                  type="button"
                  onClick={addLink}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
                >
                  {t("goals.add_link")}
                </button>
              </div>
              {links.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {t("goals.no_sources")}
                </p>
              ) : (
                <div className="space-y-2">
                  {links.map((link, index) => {
                    const tickerAccount = link.accountId || null;
                    const tickers = tickersForAccount(
                      holdingValues,
                      link.sourceType === "holding" ? tickerAccount : null,
                    );
                    return (
                      <div
                        key={`${link.sourceType}-${String(index)}`}
                        className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_5rem_auto] gap-2 items-center"
                      >
                        <CustomSelect
                          aria-label={t("goals.field.link_type")}
                          options={sourceOptions}
                          value={link.sourceType}
                          onChange={(value) => {
                            updateLink(index, {
                              sourceType:
                                value === "holding" ? "holding" : "account",
                              ticker: "",
                            });
                          }}
                        />
                        {link.sourceType === "account" ? (
                          <CustomSelect
                            aria-label={t("goals.link.select_account")}
                            options={[
                              {
                                value: "",
                                label: t("goals.link.select_account"),
                              },
                              ...accountOptions,
                            ]}
                            value={link.accountId}
                            onChange={(value) => {
                              updateLink(index, { accountId: String(value) });
                            }}
                          />
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <CustomSelect
                              aria-label={t("goals.link.select_account")}
                              options={[
                                {
                                  value: "",
                                  label: t("goals.link.all_accounts"),
                                },
                                ...accountOptions,
                              ]}
                              value={link.accountId}
                              onChange={(value) => {
                                updateLink(index, {
                                  accountId: String(value),
                                  ticker: "",
                                });
                              }}
                            />
                            <CustomSelect
                              aria-label={t("goals.link.select_ticker")}
                              options={[
                                {
                                  value: "",
                                  label:
                                    tickers.length === 0
                                      ? t("goals.link.no_holdings")
                                      : t("goals.link.select_ticker"),
                                },
                                ...tickers.map((ticker) => ({
                                  value: ticker,
                                  label: ticker,
                                })),
                              ]}
                              value={link.ticker}
                              onChange={(value) => {
                                updateLink(index, { ticker: String(value) });
                              }}
                            />
                          </div>
                        )}
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="any"
                          aria-label={t("goals.link.allocation")}
                          value={link.allocation}
                          onChange={(event) => {
                            updateLink(index, {
                              allocation: event.target.value,
                            });
                          }}
                          className={fieldClass}
                        />
                        <button
                          type="button"
                          aria-label={t("goals.link.remove")}
                          onClick={() => {
                            setLinks((current) =>
                              current.filter(
                                (_, linkIndex) => linkIndex !== index,
                              ),
                            );
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {hasOverlap && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {t("goals.overlap_warning")}
                </p>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {t("goals.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
          >
            {isEditing ? t("goals.save") : t("goals.create")}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
