import { WEEKDAY_KEYS, createDefaultScheduledForm } from "../../constants/app";

export { WEEKDAY_KEYS, createDefaultScheduledForm };

export function toScheduledPayload(formState, translate) {
  const isInvestment = formState.transactionType === "investment";

  let amount = Number(formState.amount) || 0;
  if (isInvestment) {
    const sharesNum = Number(formState.shares) || 0;
    const priceNum = Number(formState.pricePerShare) || 0;
    const feeNum = Number(formState.fee) || 0;
    amount = formState.isBuy
      ? -(sharesNum * priceNum + feeNum)
      : sharesNum * priceNum - feeNum;
  }

  return {
    accountId: formState.accountId,
    payee: isInvestment
      ? formState.payee.trim() ||
        (formState.isBuy
          ? translate("scheduled.field.buy")
          : translate("scheduled.field.sell"))
      : formState.payee.trim(),
    amount,
    category: isInvestment
      ? formState.category.trim() ||
        translate("scheduled.field.investment_category")
      : formState.category.trim() || null,
    notes: formState.notes.trim() || null,
    currency: formState.currency || null,
    recurrenceType: formState.recurrenceType,
    intervalValue:
      formState.recurrenceType === "every_n"
        ? Number(formState.intervalValue) || 1
        : null,
    intervalUnit:
      formState.recurrenceType === "every_n" ? formState.intervalUnit : null,
    daysOfWeek:
      formState.recurrenceType === "day_of_week" ? formState.daysOfWeek : null,
    ordinal:
      formState.recurrenceType === "ordinal_weekday"
        ? Number(formState.ordinal)
        : null,
    weekday:
      formState.recurrenceType === "ordinal_weekday"
        ? Number(formState.weekday)
        : null,
    startDate: formState.startDate,
    endDate: formState.endDate || null,
    maxOccurrences: formState.maxOccurrences
      ? Number(formState.maxOccurrences)
      : null,
    transactionType: formState.transactionType,
    ticker: isInvestment ? formState.ticker.trim() : null,
    shares: isInvestment ? Number(formState.shares) || null : null,
    pricePerShare: isInvestment
      ? Number(formState.pricePerShare) || null
      : null,
    fee: isInvestment ? Number(formState.fee) || 0 : null,
    isBuy: isInvestment ? formState.isBuy : null,
  };
}

export function getRecurrenceSummary(sched, translate) {
  if (sched.recurrence_type === "every_n") {
    const n = sched.interval_value || 1;
    const unit = translate(`scheduled.unit.${sched.interval_unit || "month"}`);
    return translate("scheduled.summary.every_n", { n, unit });
  }
  if (sched.recurrence_type === "day_of_week") {
    const days = (sched.days_of_week || [])
      .map((d) => translate(WEEKDAY_KEYS[d]))
      .join(", ");
    return translate("scheduled.summary.days_of_week", { days });
  }
  if (sched.recurrence_type === "ordinal_weekday") {
    const ordinal = translate(`scheduled.ordinal.${sched.ordinal}`);
    const weekday = translate(WEEKDAY_KEYS[sched.weekday ?? 0]);
    return translate("scheduled.summary.ordinal_weekday", { ordinal, weekday });
  }
  return "";
}

export function getAccountName(accounts, accountId) {
  const acc = accounts.find((a) => a.id === accountId);
  return acc ? acc.name : String(accountId);
}
