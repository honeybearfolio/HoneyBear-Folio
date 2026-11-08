import type { DragEvent, ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChartSpan } from "./dashboard-layout";

interface DashboardWidgetFrameProps {
  title: string;
  index: number;
  count: number;
  visible: boolean;
  span: ChartSpan;
  isChart: boolean;
  className: string;
  onMove: (toIndex: number) => void;
  onToggleVisible: () => void;
  onSetSpan: (span: ChartSpan) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  children: ReactNode;
}

export default function DashboardWidgetFrame({
  title,
  index,
  count,
  visible,
  span,
  isChart,
  className,
  onMove,
  onToggleVisible,
  onSetSpan,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  children,
}: DashboardWidgetFrameProps) {
  const { t } = useTranslation();
  const visibilityLabel = visible
    ? t("dashboard.hide_widget")
    : t("dashboard.show_widget");

  return (
    <div
      className={`${className}${visible ? "" : " dashboard-widget-hidden"}`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDrop={(event) => {
        event.preventDefault();
      }}
    >
      <div className="dashboard-widget-toolbar">
        <div
          role="button"
          tabIndex={0}
          draggable
          aria-label={`${t("dashboard.drag_handle")} ${title}`}
          className="dashboard-widget-handle"
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </div>
        <button
          type="button"
          className="dashboard-widget-icon-button"
          aria-label={`${t("dashboard.move_up")} ${title}`}
          disabled={index === 0}
          onClick={() => {
            onMove(index - 1);
          }}
        >
          <ChevronUp className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dashboard-widget-icon-button"
          aria-label={`${t("dashboard.move_down")} ${title}`}
          disabled={index >= count - 1}
          onClick={() => {
            onMove(index + 1);
          }}
        >
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </button>
        {isChart && (
          <div className="toggle-group" role="group" aria-label={title}>
            <button
              type="button"
              className={`toggle-group-btn ${span === "half" ? "toggle-group-btn-active" : ""}`}
              aria-pressed={span === "half"}
              aria-label={`${t("dashboard.width_half")} ${title}`}
              onClick={() => {
                onSetSpan("half");
              }}
            >
              {t("dashboard.width_half")}
            </button>
            <button
              type="button"
              className={`toggle-group-btn ${span === "full" ? "toggle-group-btn-active" : ""}`}
              aria-pressed={span === "full"}
              aria-label={`${t("dashboard.width_full")} ${title}`}
              onClick={() => {
                onSetSpan("full");
              }}
            >
              {t("dashboard.width_full")}
            </button>
          </div>
        )}
        <button
          type="button"
          className="dashboard-widget-icon-button"
          aria-label={`${visibilityLabel} ${title}`}
          onClick={onToggleVisible}
        >
          {visible ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {children}
    </div>
  );
}
