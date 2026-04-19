import {
  Banknote,
  Percent,
  RotateCw,
  ChevronDown,
  ChevronRight,
  User,
  Target,
  Clock,
  Activity,
  Settings2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import NumberInput from "../../components/ui/NumberInput";
interface FireInputsPanelProps {
  currentNetWorth: number;
  setCurrentNetWorth: (v: number) => void;
  annualExpenses: number;
  setAnnualExpenses: (v: number) => void;
  annualSavings: number;
  setAnnualSavings: (v: number) => void;
  expectedReturn: number;
  setExpectedReturn: (v: number) => void;
  inflation: number;
  setInflation: (v: number) => void;
  withdrawalRate: number;
  setWithdrawalRate: (v: number) => void;
  currentAge: number;
  setCurrentAge: (v: number) => void;
  retirementAge: number;
  setRetirementAge: (v: number) => void;
  retirementDuration: number;
  setRetirementDuration: (v: number) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  volatility: number;
  setVolatility: (v: number) => void;
  simulationCount: number;
  setSimulationCount: (v: number) => void;
  markUserModified: (field: string) => void;
  resetToHistoric: () => void;
}

export default function FireInputsPanel({
  currentNetWorth,
  setCurrentNetWorth,
  annualExpenses,
  setAnnualExpenses,
  annualSavings,
  setAnnualSavings,
  expectedReturn,
  setExpectedReturn,
  inflation,
  setInflation,
  withdrawalRate,
  setWithdrawalRate,
  currentAge,
  setCurrentAge,
  retirementAge,
  setRetirementAge,
  retirementDuration,
  setRetirementDuration,
  showAdvanced,
  setShowAdvanced,
  volatility,
  setVolatility,
  simulationCount,
  setSimulationCount,
  markUserModified,
  resetToHistoric,
}: FireInputsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 space-y-6 h-fit hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("fire.parameters")}
        </h2>
        <button
          type="button"
          onClick={resetToHistoric}
          title={t("fire.reset_tooltip")}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          <RotateCw className="w-4 h-4" />
          {t("fire.reset")}
        </button>
      </div>

      <div className="space-y-5">
        {/* Financial Parameters */}
        <div>
          <label className="form-label !mb-2 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            {t("dashboard.current_net_worth")}
          </label>
          <div className="relative">
            <NumberInput
              value={currentNetWorth}
              onChange={(num) => {
                setCurrentNetWorth(Number.isNaN(num) ? 0 : Math.round(num));
                markUserModified("currentNetWorth");
              }}
              className="form-input-lg font-semibold"
              placeholder="0"
              maximumFractionDigits={0}
              minimumFractionDigits={0}
              useGrouping={false}
            />
          </div>
        </div>

        <div>
          <label className="form-label !mb-2 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            {t("fire.annual_expenses")}
          </label>
          <div className="relative">
            <NumberInput
              value={annualExpenses}
              onChange={(num) => {
                setAnnualExpenses(Number.isNaN(num) ? 0 : Math.round(num));
                markUserModified("annualExpenses");
              }}
              className="form-input-lg font-semibold"
              placeholder="0"
              maximumFractionDigits={0}
              minimumFractionDigits={0}
              useGrouping={false}
            />
          </div>
        </div>

        <div>
          <label className="form-label !mb-2 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            {t("fire.annual_savings")}
          </label>
          <div className="relative">
            <NumberInput
              value={annualSavings}
              onChange={(num) => {
                setAnnualSavings(Number.isNaN(num) ? 0 : Math.round(num));
                markUserModified("annualSavings");
              }}
              className="form-input-lg font-semibold"
              placeholder="0"
              maximumFractionDigits={0}
              minimumFractionDigits={0}
              useGrouping={false}
            />
          </div>
        </div>

        <div>
          <label className="form-label !mb-2 flex items-center gap-2">
            <Percent className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            {t("fire.expected_return")}
          </label>
          <div className="relative">
            <NumberInput
              value={expectedReturn}
              onChange={(num) => {
                setExpectedReturn(Number.isNaN(num) ? 0 : num);
                markUserModified("expectedReturn");
              }}
              className="form-input-lg font-semibold pr-8"
              placeholder="0"
              maximumFractionDigits={2}
              minimumFractionDigits={0}
              useGrouping={false}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              %
            </span>
          </div>
        </div>

        <div>
          <label className="form-label !mb-2 flex items-center gap-2">
            <Percent className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            {t("fire.inflation")}
          </label>
          <div className="relative">
            <NumberInput
              value={inflation}
              onChange={(num) => {
                setInflation(Number.isNaN(num) ? 0 : num);
                markUserModified("inflation");
              }}
              className="form-input-lg font-semibold pr-8"
              placeholder="2"
              maximumFractionDigits={2}
              minimumFractionDigits={0}
              useGrouping={false}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              %
            </span>
          </div>
        </div>

        <div>
          <label className="form-label !mb-2 flex items-center gap-2">
            <Percent className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            {t("fire.withdrawal_rate")}
          </label>
          <div className="relative">
            <NumberInput
              value={withdrawalRate}
              onChange={(num) => {
                setWithdrawalRate(Number.isNaN(num) ? 0 : num);
                markUserModified("withdrawalRate");
              }}
              className="form-input-lg font-semibold pr-8"
              placeholder="4"
              maximumFractionDigits={2}
              minimumFractionDigits={0}
              useGrouping={false}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              %
            </span>
          </div>
        </div>

        {/* Age & Timeline Section */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            {t("fire.age_timeline")}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="form-label !mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                {t("fire.current_age")}
              </label>
              <div className="relative">
                <NumberInput
                  value={currentAge}
                  onChange={(num) => {
                    setCurrentAge(Number.isNaN(num) ? 0 : Math.round(num));
                    markUserModified("currentAge");
                  }}
                  className="form-input-lg font-semibold"
                  placeholder="30"
                  maximumFractionDigits={0}
                  minimumFractionDigits={0}
                  useGrouping={false}
                />
              </div>
            </div>

            <div>
              <label className="form-label !mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                {t("fire.target_retirement_age")}
              </label>
              <div className="relative">
                <NumberInput
                  value={retirementAge}
                  onChange={(num) => {
                    setRetirementAge(Number.isNaN(num) ? 0 : Math.round(num));
                    markUserModified("retirementAge");
                  }}
                  className="form-input-lg font-semibold"
                  placeholder="65"
                  maximumFractionDigits={0}
                  minimumFractionDigits={0}
                  useGrouping={false}
                />
              </div>
            </div>

            <div>
              <label className="form-label !mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                {t("fire.retirement_duration")}
              </label>
              <div className="relative">
                <NumberInput
                  value={retirementDuration}
                  onChange={(num) => {
                    setRetirementDuration(
                      Number.isNaN(num) ? 0 : Math.round(num),
                    );
                    markUserModified("retirementDuration");
                  }}
                  className="form-input-lg font-semibold"
                  placeholder="30"
                  maximumFractionDigits={0}
                  minimumFractionDigits={0}
                  useGrouping={false}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                  {t("fire.years")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            {showAdvanced ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Settings2 className="w-4 h-4" />
            {showAdvanced ? t("fire.hide_advanced") : t("fire.show_advanced")}
          </button>
        </div>

        {/* Advanced Monte Carlo Parameters */}
        {showAdvanced && (
          <div className="space-y-4 pt-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("fire.advanced_description")}
            </p>

            <div>
              <label className="form-label !mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                {t("fire.return_volatility")}
              </label>
              <div className="relative">
                <NumberInput
                  value={volatility}
                  onChange={(num) => {
                    setVolatility(Number.isNaN(num) ? 0 : num);
                    markUserModified("volatility");
                  }}
                  className="form-input-lg font-semibold pr-8"
                  placeholder="15"
                  maximumFractionDigits={1}
                  minimumFractionDigits={0}
                  useGrouping={false}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                  %
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t("fire.volatility_hint")}
              </p>
            </div>

            <div>
              <label className="form-label !mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                {t("fire.simulation_count")}
              </label>
              <div className="relative">
                <NumberInput
                  value={simulationCount}
                  onChange={(num) => {
                    setSimulationCount(
                      Number.isNaN(num)
                        ? 1000
                        : Math.max(100, Math.min(10000, Math.round(num))),
                    );
                    markUserModified("simulationCount");
                  }}
                  className="form-input-lg font-semibold"
                  placeholder="1000"
                  maximumFractionDigits={0}
                  minimumFractionDigits={0}
                  useGrouping={false}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t("fire.simulation_count_hint")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
