import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { rust } from "../../api/tauri-client";
import { Plus, Trash2, Edit, Save, GripVertical, X } from "lucide-react";
import { useConfirm } from "../../stores/confirm";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "../../stores/number-format";
import CustomSelect from "../../components/ui/CustomSelect";
import NumberInput from "../../components/ui/NumberInput";
import "../../styles/Dashboard.css";
import {
  createDefaultRuleFormState,
  DEFAULT_RULE_ACTION,
  DEFAULT_RULE_CONDITION,
  reorderRules,
  toRuleFormState,
  toRulePayload,
  type RuleCondition,
  type RuleAction,
} from "./rules-helpers";

interface RuleRecord {
  id: number;
  priority: number;
  logic?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  match_field?: string;
  match_pattern?: string;
  action_field?: string;
  action_value?: string;
  [key: string]: unknown;
}

export default function RulesList() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState(() =>
    createDefaultRuleFormState(),
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(
    null,
  );
  const formRef = useRef<HTMLDivElement>(null);

  useNumberFormat();

  const confirm = useConfirm();

  async function fetchRules() {
    try {
      const r = (await rust.get_rules()) as RuleRecord[];
      setRules(r);
    } catch (e) {
      console.error("Failed to fetch rules:", e);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = (await rust.get_rules()) as RuleRecord[];
        if (mounted) setRules(r);
      } catch (e) {
        console.error("Failed to fetch rules:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuOpenId &&
        !(event.target as HTMLElement).closest(".rule-action-menu-container") &&
        !(event.target as HTMLElement).closest(".rule-action-menu-portal")
      ) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  useEffect(() => {
    function handleScrollOrResize() {
      if (menuOpenId) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuOpenId]);

  function resetForm() {
    setFormState(createDefaultRuleFormState());
    setIsEditing(false);
    setShowForm(false);
  }

  function handleEdit(rule: RuleRecord) {
    setFormState(toRuleFormState(rule));
    setShowForm(true);
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
    setIsEditing(true);
  }

  async function handleDelete(id: number) {
    if (await confirm(t("rules.delete_confirm"), { kind: "warning" })) {
      try {
        await rust.delete_rule({ id });
        setRules((current) => current.filter((r: RuleRecord) => r.id !== id));
        if (formState.id === id) resetForm();
      } catch (e) {
        console.error("Failed to delete rule:", e);
        fetchRules();
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { payload, maxPriority } = toRulePayload(formState, rules);

      if (formState.id) {
        await rust.update_rule({
          args: {
            ...payload,
            id: formState.id,
            priority: Number(formState.priority),
          },
        });
      } else {
        await rust.create_rule({
          args: {
            ...payload,
            priority: maxPriority + 1,
          },
        });
      }
      resetForm();
      fetchRules();
    } catch (e) {
      console.error("Failed to save rule:", e);
    }
  }

  // Condition management
  function addCondition() {
    setFormState((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { ...DEFAULT_RULE_CONDITION }],
    }));
  }

  function updateCondition(index: number, updates: Partial<RuleCondition>) {
    setFormState((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) =>
        i === index ? { ...c, ...updates } : c,
      ),
    }));
  }

  function removeCondition(index: number) {
    if (formState.conditions.length <= 1) return;
    setFormState((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  }

  // Action management
  function addAction() {
    setFormState((prev) => ({
      ...prev,
      actions: [...prev.actions, { ...DEFAULT_RULE_ACTION }],
    }));
  }

  function updateAction(index: number, updates: Partial<RuleAction>) {
    setFormState((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) =>
        i === index ? { ...a, ...updates } : a,
      ),
    }));
  }

  function removeAction(index: number) {
    if (formState.actions.length <= 1) return;
    setFormState((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  }

  // DnD Handlers
  const lastReorder = useRef(0);
  const draggingIdRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggingId(id);
    draggingIdRef.current = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.setData("application/x-rule-id", String(id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const currentDraggingId = draggingIdRef.current;
    if (!currentDraggingId) return;

    const now = e.timeStamp;
    if (now - lastReorder.current < 50) return;

    lastReorder.current = now;
    setRules((currentRules) =>
      reorderRules(currentRules, currentDraggingId, targetIndex),
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnd = async () => {
    setDraggingId(null);
    draggingIdRef.current = null;
    try {
      await rust.update_rules_order({
        ruleIds: rules.map((r: RuleRecord) => r.id),
      });
    } catch (err) {
      console.error("Failed to reorder rules:", err);
      fetchRules();
    }
  };

  const availableFields = [
    { value: "payee", label: t("rules.field.payee"), type: "text" },
    { value: "category", label: t("rules.field.category"), type: "text" },
    { value: "notes", label: t("rules.field.notes"), type: "text" },
    { value: "amount", label: t("rules.field.amount"), type: "number" },
    { value: "date", label: t("rules.field.date"), type: "text" },
    { value: "ticker", label: t("rules.field.ticker"), type: "text" },
    { value: "shares", label: t("rules.field.shares"), type: "number" },
    { value: "price", label: t("rules.field.price"), type: "number" },
    { value: "fee", label: t("rules.field.fee"), type: "number" },
  ];

  const textOperators = [
    { value: "equals", label: t("rules.operator.equals") },
    { value: "not_equals", label: t("rules.operator.not_equals") },
    { value: "contains", label: t("rules.operator.contains") },
    { value: "not_contains", label: t("rules.operator.not_contains") },
    { value: "starts_with", label: t("rules.operator.starts_with") },
    { value: "ends_with", label: t("rules.operator.ends_with") },
    { value: "is_empty", label: t("rules.operator.is_empty") },
    { value: "is_not_empty", label: t("rules.operator.is_not_empty") },
    {
      value: "matches_regex",
      label: t("rules.operator.matches_regex"),
    },
    {
      value: "not_matches_regex",
      label: t("rules.operator.not_matches_regex"),
    },
  ];

  const numberOperators = [
    { value: "equals", label: t("rules.operator.equals") },
    { value: "not_equals", label: t("rules.operator.not_equals") },
    { value: "greater_than", label: t("rules.operator.greater_than") },
    { value: "less_than", label: t("rules.operator.less_than") },
    { value: "is_empty", label: t("rules.operator.is_empty") },
    { value: "is_not_empty", label: t("rules.operator.is_not_empty") },
  ];

  const logicOptions = [
    { value: "and", label: t("rules.logic.and") },
    { value: "or", label: t("rules.logic.or") },
  ];

  function getOperatorsForField(fieldValue: string) {
    const field = availableFields.find((f) => f.value === fieldValue);
    return field?.type === "number" ? numberOperators : textOperators;
  }

  function getFieldType(fieldValue: string) {
    const field = availableFields.find((f) => f.value === fieldValue);
    return field?.type || "text";
  }

  function isValuelessOperator(operator: string) {
    return operator === "is_empty" || operator === "is_not_empty";
  }

  function isRegexOperator(operator: string) {
    return operator === "matches_regex" || operator === "not_matches_regex";
  }

  function isValidRegex(pattern: string) {
    if (!pattern) return true; // empty is ok (won't match anything)
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }

  // Check if any regex condition has an invalid pattern
  const hasInvalidRegex = formState.conditions.some(
    (c) => isRegexOperator(c.operator) && c.value && !isValidRegex(c.value),
  );

  // Format condition for display
  function formatCondition(condition: RuleCondition) {
    const fieldLabel = t(`rules.field.${condition.field}`) || condition.field;
    const operatorLabel =
      t(`rules.operator.${condition.operator}`) || condition.operator;
    if (isValuelessOperator(condition.operator)) {
      return `${fieldLabel} ${operatorLabel}`;
    }
    if (isRegexOperator(condition.operator)) {
      return `${fieldLabel} ${operatorLabel} /${condition.value}/`;
    }
    return `${fieldLabel} ${operatorLabel} "${condition.value}"`;
  }

  // Format action for display
  function formatAction(action: RuleAction) {
    const fieldLabel = t(`rules.field.${action.field}`) || action.field;
    return `${fieldLabel} = "${action.value}"`;
  }

  return (
    <div className="page-container rules-container animate-in fade-in duration-500">
      <div className="hb-header-container mb-large">
        <div>
          <h1 className="hb-header-title">{t("rules.title")}</h1>
          <p className="hb-header-subtitle">{t("rules.subtitle")}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setFormState({
                ...createDefaultRuleFormState(),
              });
              setIsEditing(false);
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus size={16} />
            {t("rules.add")}
          </button>
        )}
      </div>

      {/* Form Card */}
      {showForm && (
        <div ref={formRef} className="form-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit size={15} />
                  {t("rules.edit")}
                </>
              ) : (
                <>
                  <Plus size={15} />
                  {t("rules.add")}
                </>
              )}
            </h2>
            <button
              onClick={resetForm}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={t("rules.close_form")}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Conditions Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 min-h-[40px]">
                  <h3 className="form-label !mb-0">{t("rules.conditions")}</h3>
                  {formState.conditions.length > 1 && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-xs text-slate-500 leading-5">
                        {t("rules.logic")}:
                      </span>
                      <CustomSelect
                        value={formState.logic}
                        onChange={(val) =>
                          setFormState((prev) => ({
                            ...prev,
                            logic: String(val),
                          }))
                        }
                        options={logicOptions}
                        className="w-24 h-9"
                      />
                      <span className="text-xs text-slate-500">
                        (
                        {formState.logic === "and"
                          ? t("rules.all_conditions")
                          : t("rules.any_condition")}
                        )
                      </span>
                    </div>
                  )}
                </div>

                {formState.conditions.map((condition, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <span className="text-xs font-semibold text-slate-500 uppercase w-8">
                      {t("rules.if")}
                    </span>

                    <CustomSelect
                      value={condition.field}
                      onChange={(val) =>
                        updateCondition(index, {
                          field: String(val),
                          operator: "equals",
                          value: "",
                        })
                      }
                      options={availableFields}
                      className="w-32"
                    />

                    <CustomSelect
                      value={condition.operator}
                      onChange={(val) =>
                        updateCondition(index, { operator: String(val) })
                      }
                      options={getOperatorsForField(condition.field)}
                      className="w-40"
                    />

                    {!isValuelessOperator(condition.operator) &&
                      (getFieldType(condition.field) === "number" ? (
                        <NumberInput
                          value={condition.value}
                          onChange={(val) =>
                            updateCondition(index, { value: String(val) })
                          }
                          className="form-input w-32"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={
                              isRegexOperator(condition.operator)
                                ? "^pattern.*$"
                                : "Value"
                            }
                            className={`form-input w-40 ${
                              isRegexOperator(condition.operator) &&
                              condition.value &&
                              !isValidRegex(condition.value)
                                ? "!border-red-400 dark:!border-red-500"
                                : ""
                            }`}
                            value={condition.value}
                            onChange={(e) =>
                              updateCondition(index, { value: e.target.value })
                            }
                            title={
                              isRegexOperator(condition.operator)
                                ? t("rules.regex_help")
                                : undefined
                            }
                          />
                          {isRegexOperator(condition.operator) &&
                            condition.value &&
                            !isValidRegex(condition.value) && (
                              <span className="absolute left-0 top-full mt-0.5 text-xs text-red-500 whitespace-nowrap">
                                {t("rules.regex_invalid")}
                              </span>
                            )}
                        </div>
                      ))}

                    {formState.conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title={t("rules.remove_condition")}
                        aria-label={t("rules.remove_condition")}
                      >
                        <X size={16} />
                      </button>
                    )}

                    {index < formState.conditions.length - 1 && (
                      <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase">
                        {formState.logic === "and"
                          ? t("rules.logic.and")
                          : t("rules.logic.or")}
                      </span>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCondition}
                  className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  <Plus size={16} />
                  {t("rules.add_condition")}
                </button>
              </div>

              {/* Actions Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 min-h-[40px]">
                  <h3 className="form-label !mb-0">{t("rules.actions")}</h3>
                </div>

                {formState.actions.map((action, index) => {
                  const fieldType = getFieldType(action.field);
                  return (
                    <div
                      key={index}
                      className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <span className="text-xs font-semibold text-slate-500 uppercase w-8">
                        {t("rules.then_set")}
                      </span>

                      <CustomSelect
                        value={action.field}
                        onChange={(val) =>
                          updateAction(index, { field: String(val), value: "" })
                        }
                        options={availableFields}
                        className="w-32"
                      />

                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {t("rules.to")}
                      </span>

                      {fieldType === "number" ? (
                        <NumberInput
                          value={action.value}
                          onChange={(val) =>
                            updateAction(index, { value: String(val) })
                          }
                          className="form-input w-40"
                          placeholder="0.00"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="Value"
                          className="form-input w-40"
                          value={action.value}
                          onChange={(e) =>
                            updateAction(index, { value: e.target.value })
                          }
                        />
                      )}

                      {formState.actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(index)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title={t("rules.remove_action")}
                          aria-label={t("rules.remove_action")}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addAction}
                  className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  <Plus size={16} />
                  {t("rules.add_action")}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  {t("rules.cancel_edit")}
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={hasInvalidRegex}
              >
                <Save size={15} />
                {isEditing ? t("rules.update") : t("rules.add")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t("rules.conditions")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t("rules.actions")}
              </th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody
            className="divide-y divide-slate-100 dark:divide-slate-700"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {rules.map((rule, index) => {
              const isDragging = draggingId === rule.id;
              // Handle both legacy and new format
              const conditions: RuleCondition[] =
                (rule.conditions?.length ?? 0) > 0
                  ? rule.conditions!
                  : [
                      {
                        field: rule.match_field ?? "",
                        operator: "equals",
                        value: rule.match_pattern ?? "",
                      },
                    ];
              const actions: RuleAction[] =
                (rule.actions?.length ?? 0) > 0
                  ? rule.actions!
                  : [
                      {
                        field: rule.action_field ?? "",
                        value: rule.action_value ?? "",
                      },
                    ];
              const logic = rule.logic || "and";

              return (
                <tr
                  key={rule.id}
                  className={`transition-colors group ${
                    isDragging
                      ? "opacity-30 bg-slate-100 dark:bg-slate-700"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                  draggable={!isEditing}
                  onDragStart={(e) => handleDragStart(e, rule.id)}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  data-index={index}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuCoords({ x: e.clientX, y: e.clientY });
                    setMenuOpenId(rule.id);
                  }}
                >
                  <td className="px-4 py-2.5 text-slate-400 dark:text-slate-600">
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      aria-label={t("rules.reorder")}
                      aria-roledescription={t("a11y.sortable")}
                      onKeyDown={(e) => {
                        if (
                          !isEditing &&
                          (e.key === "ArrowUp" || e.key === "ArrowDown") &&
                          e.altKey
                        ) {
                          e.preventDefault();
                          const dir = e.key === "ArrowUp" ? -1 : 1;
                          const newIndex = index + dir;
                          if (newIndex < 0 || newIndex >= rules.length) return;
                          setRules((current) =>
                            reorderRules(current, rule.id, newIndex),
                          );
                          (async () => {
                            try {
                              const reordered = reorderRules(
                                rules,
                                rule.id,
                                newIndex,
                              );
                              await rust.update_rules_order({
                                ruleIds: reordered.map((r: RuleRecord) => r.id),
                              });
                            } catch (err) {
                              console.error("Failed to reorder rules:", err);
                              fetchRules();
                            }
                          })();
                        }
                      }}
                    >
                      <GripVertical size={16} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">
                    <div className="flex flex-wrap gap-1">
                      {conditions.map((cond, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1"
                        >
                          <span className="px-2 py-0.5 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded text-xs">
                            {formatCondition(cond)}
                          </span>
                          {i < conditions.length - 1 && (
                            <span className="text-xs font-semibold text-slate-500">
                              {logic === "and"
                                ? t("rules.logic.and")
                                : t("rules.logic.or")}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">
                    <div className="flex flex-wrap gap-1">
                      {actions.map((action, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
                        >
                          {formatAction(action)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right rule-action-menu-container">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-brand-500 cursor-pointer"
                        title={t("rules.edit")}
                        aria-label={t("rules.edit")}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors text-slate-400 hover:text-rose-500 cursor-pointer"
                        title={t("rules.delete")}
                        aria-label={t("rules.delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {menuOpenId === rule.id &&
                      menuCoords &&
                      createPortal(
                        <div
                          className="fixed z-50 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 py-1.5 animate-fade-in rule-action-menu-portal"
                          style={{
                            top: `${menuCoords.y}px`,
                            left: `${Math.min(menuCoords.x, window.innerWidth - 176 - 8)}px`,
                          }}
                        >
                          <button
                            onClick={() => {
                              handleEdit(rule);
                              setMenuOpenId(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                          >
                            <Edit
                              size={16}
                              className="text-slate-400 dark:text-slate-500"
                            />
                            {t("rules.edit")}
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(rule.id);
                              setMenuOpenId(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-3 font-medium transition-colors"
                          >
                            <Trash2 size={16} />
                            {t("rules.delete")}
                          </button>
                        </div>,
                        document.body,
                      )}
                  </td>
                </tr>
              );
            })}
            {rules.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  {t("rules.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
