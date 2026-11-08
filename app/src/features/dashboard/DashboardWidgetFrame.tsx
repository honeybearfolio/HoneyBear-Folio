import { useState, type ReactNode } from "react";
import { GripVertical, SlidersHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Account } from "../../api/types";
import type { DashboardTimeRange } from "./dashboard-constants";
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_ROW_HEIGHT,
  minWidgetSize,
  WIDGET_TITLE_KEYS,
  type DashboardWidgetInstance,
  type WidgetFilter,
} from "./dashboard-layout";
import DashboardWidgetFilters from "./DashboardWidgetFilters";

interface DashboardWidgetFrameProps {
  widget: DashboardWidgetInstance;
  accounts: Account[];
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onRemove: () => void;
  onChangeFilters: (filters: WidgetFilter[]) => void;
  onChangeRange: (
    timeRange: DashboardTimeRange | null,
    customStartDate: string | null,
    customEndDate: string | null,
  ) => void;
  children: ReactNode;
}

export default function DashboardWidgetFrame({
  widget,
  accounts,
  onMove,
  onResize,
  onRemove,
  onChangeFilters,
  onChangeRange,
  children,
}: DashboardWidgetFrameProps) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const title = t(WIDGET_TITLE_KEYS[widget.type]);
  const min = minWidgetSize(widget.type);

  return (
    <div className="dashboard-widget-frame">
      <div className="dashboard-widget-toolbar">
        <div
          role="button"
          tabIndex={0}
          aria-label={`${t("dashboard.drag_handle")} ${title}`}
          className="dashboard-widget-handle"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const board = event.currentTarget.closest(".dashboard-board");
            if (!(board instanceof HTMLElement)) return;
            const colWidth = board.clientWidth / DASHBOARD_COLUMNS;
            const startX = event.clientX;
            const startY = event.clientY;
            const originX = widget.x;
            const originY = widget.y;
            const move = (pointer: PointerEvent) => {
              const dx = Math.round((pointer.clientX - startX) / colWidth);
              const dy = Math.round(
                (pointer.clientY - startY) / DASHBOARD_ROW_HEIGHT,
              );
              onMove(originX + dx, originY + dy);
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
          onKeyDown={(event) => {
            const stepX = event.shiftKey ? 0 : 1;
            const stepY = event.shiftKey ? 0 : 1;
            if (event.key === "ArrowRight") {
              event.preventDefault();
              if (event.shiftKey) onResize(widget.w + 1, widget.h);
              else onMove(widget.x + stepX, widget.y);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              if (event.shiftKey) onResize(widget.w - 1, widget.h);
              else onMove(widget.x - stepX, widget.y);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              if (event.shiftKey) onResize(widget.w, widget.h + 1);
              else onMove(widget.x, widget.y + stepY);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              if (event.shiftKey) onResize(widget.w, widget.h - 1);
              else onMove(widget.x, widget.y - stepY);
            }
          }}
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </div>
        <button
          type="button"
          className="dashboard-widget-icon-button"
          aria-pressed={filtersOpen}
          aria-label={`${t("dashboard.filters")} ${title}`}
          onClick={() => {
            setFiltersOpen((open) => !open);
          }}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dashboard-widget-icon-button"
          aria-label={`${t("dashboard.remove_widget")} ${title}`}
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      {filtersOpen ? (
        <DashboardWidgetFilters
          widget={widget}
          accounts={accounts}
          onChangeFilters={onChangeFilters}
          onChangeRange={onChangeRange}
        />
      ) : (
        <div className="dashboard-widget-fill dashboard-widget-editing">
          {children}
        </div>
      )}
      <button
        type="button"
        className="dashboard-resize-handle"
        aria-label={`${t("dashboard.resize_widget")} ${title}`}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") onResize(widget.w + 1, widget.h);
          if (event.key === "ArrowLeft") {
            onResize(Math.max(min.w, widget.w - 1), widget.h);
          }
          if (event.key === "ArrowDown") onResize(widget.w, widget.h + 1);
          if (event.key === "ArrowUp") {
            onResize(widget.w, Math.max(min.h, widget.h - 1));
          }
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const handle = event.currentTarget;
          const board = handle.closest(".dashboard-board");
          if (!(board instanceof HTMLElement)) return;
          const colWidth = board.clientWidth / DASHBOARD_COLUMNS;
          const startX = event.clientX;
          const startY = event.clientY;
          const originW = widget.w;
          const originH = widget.h;
          const move = (pointer: PointerEvent) => {
            const dw = Math.round((pointer.clientX - startX) / colWidth);
            const dh = Math.round(
              (pointer.clientY - startY) / DASHBOARD_ROW_HEIGHT,
            );
            onResize(originW + dw, originH + dh);
          };
          const up = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
          };
          handle.setPointerCapture(event.pointerId);
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
        }}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
          <path
            d="M6 14 L14 6 M9.5 14 L14 9.5 M13 14 L14 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
