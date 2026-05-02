import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, BarChart3, Gauge, Table2 } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import ErrorBoundary from "./ui/ErrorBoundary";
import CollapsibleSection from "./ui/CollapsibleSection";
import ChartWidget from "./ChartWidget";
import KpiStrip from "./dashboard/KpiStrip";
import DashboardFilterBar from "./dashboard/DashboardFilterBar";
import PivotTab from "./pivot/PivotTab";
import type { DashboardWidget, DashboardingFeature, WidgetSize } from "@/types/dashboard";

const SPAN_MAP: Record<WidgetSize, number> = {
  "1x1": 1,
  "2x1": 2,
};

function SortableWidgetSlot({ widget }: { widget: DashboardWidget }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: widget.id, data: { type: "widget-sort" } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    gridColumn: `span ${SPAN_MAP[widget.size] ?? 1}`,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid-slot filled-slot" {...attributes}>
      <ErrorBoundary inline fallbackMessage="This chart encountered an error.">
        <ChartWidget widget={widget} dragListeners={listeners} />
      </ErrorBoundary>
    </div>
  );
}

function AddWidgetSlot() {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-drop",
    data: { type: "grid-slot" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`grid-slot empty-slot add-widget-slot${isOver ? " slot-drop-hover" : ""}`}
    >
      <div className="slot-placeholder">
        <Plus size={20} strokeWidth={1.5} />
        <span className="slot-hint">Drop a chart type here</span>
      </div>
    </div>
  );
}

type DashSubTab = "charts" | "pivot";

export default function Canvas() {
  const { widgets, kpiCards, activeWorkspace } = useStore();
  const widgetIds = widgets.map((w) => w.id);

  const dashFeatures = useMemo<Set<DashboardingFeature>>(() => {
    const raw = activeWorkspace?.dashboard_features ?? ["kpi_metrics", "charts"];
    return new Set(raw);
  }, [activeWorkspace]);

  const showKpi = dashFeatures.has("kpi_metrics");
  const showCharts = dashFeatures.has("charts");
  const showPivot = dashFeatures.has("pivot_table");
  const hasSubTabs = showPivot && (showKpi || showCharts);

  const [subTab, setSubTab] = useState<DashSubTab>("charts");

  return (
    <main className="canvas">
      {hasSubTabs && (
        <div className="dash-subtabs">
          <button
            className={`dash-subtab${subTab === "charts" ? " dash-subtab--active" : ""}`}
            onClick={() => setSubTab("charts")}
          >
            <BarChart3 size={13} /> Charts
          </button>
          <button
            className={`dash-subtab${subTab === "pivot" ? " dash-subtab--active" : ""}`}
            onClick={() => setSubTab("pivot")}
          >
            <Table2 size={13} /> Pivot Table
          </button>
        </div>
      )}

      {(!hasSubTabs || subTab === "charts") && (
        <>
          <DashboardFilterBar />

          {showKpi && (
            <CollapsibleSection
              title="KPI Metrics"
              icon={<Gauge size={14} />}
              badge={kpiCards.length > 0 ? <span className="dt-filter-badge">{kpiCards.length}</span> : undefined}
            >
              <KpiStrip />
            </CollapsibleSection>
          )}

          {showCharts && (
            <CollapsibleSection
              title="Charts"
              icon={<BarChart3 size={14} />}
              badge={widgets.length > 0 ? <span className="dt-filter-badge">{widgets.length}</span> : undefined}
            >
              <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
                <div className="dash-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  {widgets.map((widget) => (
                    <SortableWidgetSlot key={widget.id} widget={widget} />
                  ))}
                  <AddWidgetSlot />
                </div>
              </SortableContext>
            </CollapsibleSection>
          )}
        </>
      )}

      {((!hasSubTabs && showPivot) || (hasSubTabs && subTab === "pivot")) && (
        <PivotTab />
      )}
    </main>
  );
}
