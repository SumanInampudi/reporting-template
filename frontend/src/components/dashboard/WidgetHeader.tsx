import {
  X, GripVertical, Loader2, Settings, FileDown, Image, Palette,
} from "lucide-react";
import ChartTypeSwitcher from "@/components/ui/ChartTypeSwitcher";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import type { ChartType, DashboardWidget, WidgetSize } from "@/types/dashboard";

const SIZE_OPTIONS: { id: WidgetSize; label: string; shortLabel: string }[] = [
  { id: "1x1", label: "Half width (1 col)", shortLabel: "\u00BD" },
  { id: "2x1", label: "Full width (2 cols)", shortLabel: "Full" },
];

interface Props {
  widget: DashboardWidget;
  queryLoading: boolean;
  usingCache: boolean;
  hasChart: boolean;
  showSettings: boolean;
  dragListeners?: Record<string, Function>;
  onTitleChange: (title: string) => void;
  onChartTypeChange: (type: ChartType) => void;
  onToggleSettings: () => void;
  onSizeChange: (size: WidgetSize) => void;
  onExportCsv: () => void;
  onExportPng: () => void;
  onRemove: () => void;
  onClearGroupBy?: () => void;
}

export default function WidgetHeader({
  widget, queryLoading, usingCache, hasChart, showSettings, dragListeners,
  onTitleChange, onChartTypeChange, onToggleSettings, onSizeChange,
  onExportCsv, onExportPng, onRemove, onClearGroupBy,
}: Props) {
  const alias = useColumnAlias();

  return (
    <div className="widget-header">
      <span className="drag-handle" {...(dragListeners ?? {})}>
        <GripVertical size={14} />
      </span>
      <ChartTypeSwitcher value={widget.chartType} onChange={onChartTypeChange} />
      <input
        className="widget-title-input"
        value={widget.title}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      {widget.binding.groupBy && (
        <span className="groupby-badge" title={`Color by: ${widget.binding.groupBy}`}>
          <Palette size={10} />
          {alias(widget.binding.groupBy)}
          {onClearGroupBy && (
            <button className="groupby-badge-x" onClick={onClearGroupBy} title="Remove color-by">
              <X size={8} />
            </button>
          )}
        </span>
      )}

      <div className="widget-actions">
        {queryLoading && (
          <Loader2 size={14} className="spin" style={{ color: "var(--accent)" }} />
        )}
        {usingCache && (
          <span className="cache-badge" title="Using cached dataset (no server query)">CACHED</span>
        )}
        {widget.data && (
          <button onClick={onExportCsv} title="Download CSV">
            <FileDown size={14} />
          </button>
        )}
        {hasChart && (
          <button onClick={onExportPng} title="Export as PNG">
            <Image size={14} />
          </button>
        )}
        <button
          onClick={onToggleSettings}
          title="Chart Settings"
          className={showSettings ? "action-active" : ""}
        >
          <Settings size={14} />
        </button>
        <div className="widget-size-picker">
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`widget-size-btn${widget.size === opt.id ? " widget-size-btn--active" : ""}`}
              onClick={() => onSizeChange(opt.id)}
              title={opt.label}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
        <button onClick={onRemove} title="Remove">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
