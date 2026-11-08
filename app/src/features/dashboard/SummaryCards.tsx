import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import MaskedNumber from "../../components/ui/MaskedNumber";

interface SummaryCardProps {
  title: string;
  children: ReactNode;
}

export function SummaryCard({ title, children }: SummaryCardProps) {
  return (
    <div className="summary-card">
      <h3 className="summary-card-title">{title}</h3>
      <p className="summary-card-value">{children}</p>
    </div>
  );
}

interface SummaryCardsProps {
  netWorth: number;
  totalAccounts: number;
  totalTransactions: number;
}

export default function SummaryCards({
  netWorth,
  totalAccounts,
  totalTransactions,
}: SummaryCardsProps) {
  const { t } = useTranslation();

  return (
    <>
      <SummaryCard title={t("dashboard.current_net_worth")}>
        <MaskedNumber value={netWorth} options={{ style: "currency" }} />
      </SummaryCard>
      <SummaryCard title={t("dashboard.total_accounts")}>
        {totalAccounts}
      </SummaryCard>
      <SummaryCard title={t("dashboard.total_transactions")}>
        {totalTransactions}
      </SummaryCard>
    </>
  );
}
