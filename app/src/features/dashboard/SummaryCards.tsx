import { useTranslation } from "react-i18next";
import MaskedNumber from "../../components/ui/MaskedNumber";

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
    <div className="summary-cards-grid">
      <div className="summary-card">
        <h3 className="summary-card-title">
          {t("dashboard.current_net_worth")}
        </h3>
        <p className="summary-card-value">
          <MaskedNumber value={netWorth} options={{ style: "currency" }} />
        </p>
      </div>
      <div className="summary-card">
        <h3 className="summary-card-title">{t("dashboard.total_accounts")}</h3>
        <p className="summary-card-value">{totalAccounts}</p>
      </div>
      <div className="summary-card">
        <h3 className="summary-card-title">
          {t("dashboard.total_transactions")}
        </h3>
        <p className="summary-card-value">{totalTransactions}</p>
      </div>
    </div>
  );
}
