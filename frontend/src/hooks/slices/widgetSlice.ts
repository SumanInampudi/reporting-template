import type { StateCreator } from "zustand";
import type {
  ChartSettings,
  ChartType,
  ColumnAggregation,
  DashboardWidget,
  KpiCard,
  LayoutItem,
  PivotSnapshot,
  QueryResult,
  WidgetSize,
} from "@/types/dashboard";
import type { DashboardStore } from "../storeTypes";
import { uid } from "../storeUtils";
import { DEFAULT_CHART_SETTINGS } from "@/lib/constants";
import { humanizeColumn, isNumericType as isNumType } from "@/lib/kpiUtils";

export interface WidgetSlice {
  widgets: DashboardWidget[];
  layouts: LayoutItem[];
  gridRows: number;
  gridCols: number;
  dashboardCols: number;
  kpiCards: KpiCard[];
  pivotConfig: PivotSnapshot | null;
  addWidget: (chartType: ChartType) => string;
  reorderWidgets: (fromId: string, toId: string) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<DashboardWidget>) => void;
  updateWidgetSettings: (id: string, patch: Partial<ChartSettings>) => void;
  setWidgetSize: (id: string, size: WidgetSize) => void;
  setWidgetData: (id: string, data: QueryResult) => void;
  updateLayouts: (layouts: LayoutItem[]) => void;
  setGridSize: (rows: number, cols: number) => void;
  setDashboardCols: (cols: number) => void;
  addKpiCard: (column: string, table: string, aggregation?: string) => void;
  updateKpiCard: (id: string, patch: Partial<KpiCard>) => void;
  removeKpiCard: (id: string) => void;
  reorderKpiCards: (fromId: string, toId: string) => void;
  setPivotConfig: (config: PivotSnapshot | null) => void;
  resolvedAggregations: () => Record<string, ColumnAggregation>;
}

export const createWidgetSlice: StateCreator<DashboardStore, [], [], WidgetSlice> = (set, get) => ({
  widgets: [],
  layouts: [],

  gridRows: 2,
  gridCols: 2,
  setGridSize: (gridRows, gridCols) => set({ gridRows, gridCols }),
  dashboardCols: 2,
  setDashboardCols: (dashboardCols) => set({ dashboardCols }),

  kpiCards: [],
  addKpiCard: (column, table, aggregation) => {
    const id = uid();
    const agg = (aggregation as KpiCard["aggregation"]) || "SUM";
    const card: KpiCard = {
      id, title: humanizeColumn(column), column, table,
      aggregation: agg,
      format: agg === "COUNT_DISTINCT" || agg === "COUNT" ? "number" : "compact",
    };
    set((s) => ({ kpiCards: [...s.kpiCards, card] }));
  },
  updateKpiCard: (id, patch) =>
    set((s) => ({ kpiCards: s.kpiCards.map((k) => (k.id === id ? { ...k, ...patch } : k)) })),
  removeKpiCard: (id) =>
    set((s) => ({ kpiCards: s.kpiCards.filter((k) => k.id !== id) })),
  reorderKpiCards: (fromId, toId) => {
    set((s) => {
      const arr = [...s.kpiCards];
      const fromIdx = arr.findIndex((k) => k.id === fromId);
      const toIdx = arr.findIndex((k) => k.id === toId);
      if (fromIdx === -1 || toIdx === -1) return s;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { kpiCards: arr };
    });
  },

  addWidget: (chartType) => {
    const id = uid();
    const fqTable = get().effectiveTableRef();

    const widget: DashboardWidget = {
      id,
      chartType,
      title: `New ${chartType} chart`,
      tableName: fqTable,
      binding: { xColumns: [], yColumns: [], groupBy: [] },
      data: null,
      sql: null,
      settings: { ...DEFAULT_CHART_SETTINGS },
      size: "1x1",
    };

    set((s) => ({
      widgets: [...s.widgets, widget],
      layouts: [...s.layouts, { i: id, x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 2 }],
    }));

    return id;
  },

  reorderWidgets: (fromId, toId) => {
    set((s) => {
      const arr = [...s.widgets];
      const fromIdx = arr.findIndex((w) => w.id === fromId);
      const toIdx = arr.findIndex((w) => w.id === toId);
      if (fromIdx === -1 || toIdx === -1) return s;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { widgets: arr };
    });
  },

  removeWidget: (id) =>
    set((s) => ({
      widgets: s.widgets.filter((w) => w.id !== id),
      layouts: s.layouts.filter((l) => l.i !== id),
    })),

  updateWidget: (id, patch) =>
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  updateWidgetSettings: (id, patch) =>
    set((s) => ({
      widgets: s.widgets.map((w) =>
        w.id === id ? { ...w, settings: { ...w.settings, ...patch } } : w,
      ),
    })),

  setWidgetSize: (id, size) =>
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
    })),

  setWidgetData: (id, data) =>
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, data } : w)),
    })),

  updateLayouts: (layouts) => set({ layouts }),

  pivotConfig: null,
  setPivotConfig: (pivotConfig) => set({ pivotConfig }),

  resolvedAggregations: () => {
    const { activeWorkspace: ws, selectedCatalog, selectedSchema, selectedTable, columns } = get();
    const explicit = ws?.column_aggregations ?? {};
    const key = selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : selectedTable;
    const cols = key ? columns[key] ?? [] : [];
    const resolved: Record<string, ColumnAggregation> = { ...explicit };
    for (const c of cols) {
      if (!(c.col_name in resolved) && isNumType(c.data_type)) {
        resolved[c.col_name] = "SUM";
      }
    }
    return resolved;
  },
});
