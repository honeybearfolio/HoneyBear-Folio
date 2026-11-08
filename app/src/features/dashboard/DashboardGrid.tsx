import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";
import DashboardWidgetContent from "./DashboardWidgetContent";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_ROW_HEIGHT,
  DASHBOARD_WIDGET_IDS,
  WIDGET_TITLE_KEYS,
  boardRows,
} from "./dashboard-layout";
import { useDashboardData } from "./dashboard-widget-data";

interface DashboardGridProps {
  editing: boolean;
  onEnterEdit: () => void;
}

function DotGrid({ rows }: { rows: number }) {
  const dots = [];
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= DASHBOARD_COLUMNS; x += 1) {
      dots.push(
        <span
          key={`${String(x)}-${String(y)}`}
          className="dashboard-grid-dot"
          style={{
            left: `${String((x / DASHBOARD_COLUMNS) * 100)}%`,
            top: y * DASHBOARD_ROW_HEIGHT,
          }}
        />,
      );
    }
  }
  return (
    <div className="dashboard-grid-dots" aria-hidden="true">
      {dots}
    </div>
  );
}

function EmptyDashboard({ onCustomize }: { onCustomize: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {t("dashboard.all_widgets_hidden")}
      </p>
      <button type="button" className="btn-primary" onClick={onCustomize}>
        {t("dashboard.customize")}
      </button>
    </div>
  );
}

export default function DashboardGrid({
  editing,
  onEnterEdit,
}: DashboardGridProps) {
  const { t } = useTranslation();
  const shared = useDashboardData();
  const layout = useDashboardPreferencesStore((state) => state.layout);
  const moveWidget = useDashboardPreferencesStore((state) => state.moveWidget);
  const resizeWidget = useDashboardPreferencesStore(
    (state) => state.resizeWidget,
  );
  const addWidget = useDashboardPreferencesStore((state) => state.addWidget);
  const removeWidget = useDashboardPreferencesStore(
    (state) => state.removeWidget,
  );
  const setWidgetFilters = useDashboardPreferencesStore(
    (state) => state.setWidgetFilters,
  );
  const setWidgetTimeRange = useDashboardPreferencesStore(
    (state) => state.setWidgetTimeRange,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  if (!editing && layout.length === 0) {
    return <EmptyDashboard onCustomize={onEnterEdit} />;
  }

  const rows = boardRows(layout) + (editing ? 6 : 0);

  return (
    <div className="space-y-3">
      {editing && (
        <div className="relative">
          <button
            type="button"
            className="dashboard-add-button"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
          >
            {t("dashboard.add_card")}
          </button>
          {menuOpen && (
            <div className="dashboard-add-menu" role="menu">
              {DASHBOARD_WIDGET_IDS.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  className="dashboard-add-menu-item"
                  onClick={() => {
                    addWidget(type);
                    setMenuOpen(false);
                  }}
                >
                  {t(WIDGET_TITLE_KEYS[type])}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className={`dashboard-board${editing ? " dashboard-board-editing" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${String(DASHBOARD_COLUMNS)}, minmax(0, 1fr))`,
          gridAutoRows: `${String(DASHBOARD_ROW_HEIGHT)}px`,
          minHeight: rows * DASHBOARD_ROW_HEIGHT,
        }}
      >
        {layout.map((widget) => (
          <div
            key={widget.instanceId}
            className="dashboard-board-item"
            style={{
              gridColumn: `${String(widget.x + 1)} / span ${String(widget.w)}`,
              gridRow: `${String(widget.y + 1)} / span ${String(widget.h)}`,
            }}
          >
            {editing ? (
              <DashboardWidgetFrame
                widget={widget}
                accounts={shared.accounts}
                onMove={(x, y) => {
                  moveWidget(widget.instanceId, x, y);
                }}
                onResize={(w, h) => {
                  resizeWidget(widget.instanceId, w, h);
                }}
                onRemove={() => {
                  removeWidget(widget.instanceId);
                }}
                onChangeFilters={(filters) => {
                  setWidgetFilters(widget.instanceId, filters);
                }}
                onChangeRange={(timeRange, start, end) => {
                  setWidgetTimeRange(widget.instanceId, timeRange, start, end);
                }}
              >
                <DashboardWidgetContent widget={widget} />
              </DashboardWidgetFrame>
            ) : (
              <div className="dashboard-widget-fill">
                <DashboardWidgetContent widget={widget} />
              </div>
            )}
          </div>
        ))}
        {editing && <DotGrid rows={rows} />}
      </div>
    </div>
  );
}
