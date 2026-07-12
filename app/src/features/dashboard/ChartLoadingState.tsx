import { useTranslation } from "react-i18next";

interface ChartLoadingStateProps {
  message?: string;
}

export default function ChartLoadingState({ message }: ChartLoadingStateProps) {
  const { t } = useTranslation();

  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <span className="loading-text">
          {message ?? t("loading.loading_data")}
        </span>
      </div>
    </div>
  );
}
