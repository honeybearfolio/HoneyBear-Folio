import { ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  AccountDetailsAccount,
  SortableTransactionKey,
} from "./account-details-types";

interface TransactionToolbarProps {
  account: AccountDetailsAccount;
  hasInvestment: boolean;
  sortConfig: {
    key: SortableTransactionKey | null;
    direction: string | null;
  };
  onSort: (key: SortableTransactionKey) => void;
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: string | null;
}) {
  return (
    <span className={`inline-flex w-4 h-4 ${!direction ? "invisible" : ""}`}>
      {active && direction === "descending" ? (
        <ArrowDown className="w-4 h-4" />
      ) : (
        <ArrowUp className="w-4 h-4" />
      )}
    </span>
  );
}

export default function TransactionToolbar({
  account,
  hasInvestment,
  sortConfig,
  onSort,
}: TransactionToolbarProps) {
  const { t } = useTranslation();

  const getSortIcon = (key: SortableTransactionKey) => (
    <SortIcon
      active={sortConfig.key === key}
      direction={sortConfig.key === key ? sortConfig.direction : null}
    />
  );

  const headerClass =
    "px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
  const headerRightClass = `${headerClass} text-right`;

  return (
    <thead className="bg-white dark:bg-slate-800 rounded-t-2xl">
      <tr>
        <th
          onClick={() => {
            onSort("date");
          }}
          className={`${headerClass} w-32`}
        >
          <div className="flex items-center gap-1">
            {t("import.field.date")} {getSortIcon("date")}
          </div>
        </th>
        {account.id === "all" && (
          <th
            onClick={() => {
              onSort("account_name");
            }}
            className={`${headerClass} min-w-[10rem]`}
          >
            <div className="flex items-center gap-1">
              {t("import.field.account")} {getSortIcon("account_name")}
            </div>
          </th>
        )}
        <th
          onClick={() => {
            onSort("payee");
          }}
          className={headerClass}
        >
          <div className="flex items-center gap-1">
            {t("import.field.payee")} {getSortIcon("payee")}
          </div>
        </th>
        <th
          onClick={() => {
            onSort("category");
          }}
          className={`${headerClass} min-w-[10rem]`}
        >
          <div className="flex items-center gap-1">
            {t("import.field.category")} {getSortIcon("category")}
          </div>
        </th>
        <th
          onClick={() => {
            onSort("notes");
          }}
          className={headerClass}
        >
          <div className="flex items-center gap-1">
            {t("import.field.notes")} {getSortIcon("notes")}
          </div>
        </th>
        {hasInvestment && (
          <>
            <th
              onClick={() => {
                onSort("ticker");
              }}
              className={`${headerClass} min-w-[5rem]`}
            >
              <div className="flex items-center gap-1">
                {t("import.field.ticker")} {getSortIcon("ticker")}
              </div>
            </th>
            <th
              onClick={() => {
                onSort("shares");
              }}
              className={`${headerRightClass} w-36`}
            >
              <div className="flex items-center justify-end gap-1">
                {t("import.field.shares")} {getSortIcon("shares")}
              </div>
            </th>
            <th
              onClick={() => {
                onSort("price_per_share");
              }}
              className={`${headerRightClass} w-36`}
            >
              <div className="flex items-center justify-end gap-1">
                {t("import.field.price")} {getSortIcon("price_per_share")}
              </div>
            </th>
            <th
              onClick={() => {
                onSort("fee");
              }}
              className={`${headerRightClass} w-28`}
            >
              <div className="flex items-center justify-end gap-1">
                {t("import.field.fee")} {getSortIcon("fee")}
              </div>
            </th>
          </>
        )}
        <th
          onClick={() => {
            onSort("amount");
          }}
          className={`${headerRightClass} w-36`}
        >
          <div className="flex items-center justify-end gap-1">
            {t("import.field.amount")} {getSortIcon("amount")}
          </div>
        </th>
        <th className="w-16"></th>
      </tr>
    </thead>
  );
}
