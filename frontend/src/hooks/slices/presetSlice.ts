import type { StateCreator } from "zustand";
import type {
  ChartBinding,
  DashboardWidget,
  Preset,
  PresetSnapshot,
  WidgetSnapshot,
} from "@/types/dashboard";
import { migrateBinding } from "@/types/dashboard";
import type { DashboardStore } from "../storeTypes";

export interface PresetSlice {
  presets: Preset[];
  activePresetId: string | null;
  presetLoadVersion: number;
  presetWarning: string | null;
  lastSavedSnapshot: PresetSnapshot | null;
  lastRefreshTime: string | null;
  lastQueryMs: number | null;
  setPresets: (presets: Preset[]) => void;
  setActivePresetId: (id: string | null) => void;
  captureSnapshot: () => PresetSnapshot;
  loadSnapshot: (snapshot: PresetSnapshot) => void;
  setLastSavedSnapshot: (snap: PresetSnapshot | null) => void;
  isDirty: () => boolean;
  setLastRefreshTime: (t: string | null) => void;
  setLastQueryMs: (ms: number | null) => void;
}

export const createPresetSlice: StateCreator<DashboardStore, [], [], PresetSlice> = (set, get) => ({
  presets: [],
  activePresetId: null,
  presetLoadVersion: 0,
  presetWarning: null,
  setPresets: (presets) => set({ presets }),
  setActivePresetId: (activePresetId) => set({ activePresetId }),

  captureSnapshot: () => {
    const s = get();
    const widgets: WidgetSnapshot[] = s.widgets.map(({ data, ...rest }) => rest);

    const dimSelections: Record<string, string[]> = {};
    for (const df of s.dimensionFilters) {
      if (df.selectedValues.length > 0) dimSelections[df.id] = [...df.selectedValues];
    }

    return {
      selectedTable: s.selectedTable,
      selectedOutputColumns: [...s.selectedOutputColumns],
      formulaColumns: s.formulaColumns.map((fc) => ({ ...fc })),
      filters: s.filters.map(({ values, ...rest }) => ({ ...rest, values: [] })),
      dynamicFilters: s.dynamicFilters.map((d) => ({
        ...d,
        groups: d.groups.map((g) => ({ ...g, conditions: g.conditions.map((c) => ({ ...c })) })),
      })),
      dimensionFilterSelections: Object.keys(dimSelections).length > 0 ? dimSelections : undefined,
      activatedOptionalDimIds: s.activatedOptionalDimIds.length > 0 ? [...s.activatedOptionalDimIds] : undefined,
      widgets,
      layouts: s.layouts.map((l) => ({ ...l })),
      gridRows: s.gridRows,
      gridCols: s.gridCols,
      dashboardCols: s.dashboardCols,
      kpiCards: s.kpiCards.map((k) => ({ ...k })),
      pivotConfig: s.pivotConfig ? { ...s.pivotConfig, valueFields: s.pivotConfig.valueFields.map((v) => ({ ...v })) } : undefined,
      themeConfig: { ...s.themeConfig },
      activeTab: s.activeTab,
    };
  },

  loadSnapshot: (snap) => {
    const { selectedCatalog, selectedSchema, columns: colMap } = get();
    const tbl = snap.selectedTable;
    const fqKey = selectedCatalog && selectedSchema && tbl
      ? `${selectedCatalog}.${selectedSchema}.${tbl}` : tbl;
    const knownMeta = fqKey ? colMap[fqKey] : undefined;
    const knownCols = knownMeta ? new Set(knownMeta.map((m) => m.col_name)) : null;

    const isValid = (col: string) =>
      col.startsWith("__fc__") || col.startsWith("__sf__") || col.startsWith("__row_") || col.startsWith("__dynamic_") || !knownCols || knownCols.has(col);

    const removedCols: string[] = [];
    const track = (col: string) => { if (!isValid(col) && !removedCols.includes(col)) removedCols.push(col); };

    const outputCols = snap.selectedOutputColumns.filter((c) => { if (!isValid(c)) { track(c); return false; } return true; });
    const filters = snap.filters.filter((f) => { if (!isValid(f.column)) { track(f.column); return false; } return true; });
    const dynFilters = snap.dynamicFilters.map((df) => ({
      ...df,
      groups: df.groups.map((g) => ({
        ...g,
        conditions: g.conditions.filter((c) => { if (!isValid(c.column)) { track(c.column); return false; } return true; }),
      })),
    }));
    const kpiCards = (snap.kpiCards ?? []).filter((k) => { if (!isValid(k.column)) { track(k.column); return false; } return true; });
    const widgets = snap.widgets.map((w) => ({
      ...w,
      binding: migrateBinding(w.binding as ChartBinding),
    })).filter((w) => {
      const cols = [...(w.binding.xColumns ?? []), ...(w.binding.yColumns ?? []), ...(w.binding.groupBy ?? [])].filter(Boolean) as string[];
      const bad = cols.filter((c) => !isValid(c));
      bad.forEach(track);
      return bad.length === 0;
    });
    const widgetIds = new Set(widgets.map((w) => w.id));
    const layouts = snap.layouts.filter((l) => widgetIds.has(l.i));

    if (removedCols.length > 0) {
      set({ presetWarning: `Preset loaded with warnings: columns no longer exist and were removed — ${removedCols.join(", ")}` });
    } else {
      set({ presetWarning: null });
    }

    const widgetsWithData: DashboardWidget[] = widgets.map((w) => ({
      ...w,
      size: w.size ?? "1x1",
      data: null,
    }));
    set({
      selectedTable: snap.selectedTable,
      selectedOutputColumns: outputCols,
      formulaColumns: snap.formulaColumns,
      filters,
      appliedFilters: filters.map((f) => ({ ...f })),
      dynamicFilters: dynFilters,
      appliedDynamicFilters: dynFilters.map((d) => ({
        ...d,
        groups: d.groups.map((g) => ({ ...g, conditions: g.conditions.map((c) => ({ ...c })) })),
      })),
      widgets: widgetsWithData,
      layouts,
      gridRows: snap.gridRows,
      gridCols: snap.gridCols,
      dashboardCols: snap.dashboardCols ?? 2,
      kpiCards,
      pivotConfig: snap.pivotConfig ?? null,
      themeConfig: snap.themeConfig,
      theme: snap.themeConfig.colorScheme,
      baseDataset: null,
      baseDatasetSql: null,
      baseDatasetError: null,
      filtersVersion: get().filtersVersion + 1,
      presetLoadVersion: get().presetLoadVersion + 1,
      dashboardFilters: filters.map((f) => ({
        ...f,
        id: `dash-${f.id}`,
        values: f.selectedValues.length > 0 ? [...f.selectedValues] : [...f.values],
      })),
      activatedOptionalDimIds: snap.activatedOptionalDimIds ?? [],
    });

    if (snap.dimensionFilterSelections) {
      const dimSel = snap.dimensionFilterSelections;
      set((s) => ({
        dimensionFilters: s.dimensionFilters.map((f) =>
          dimSel[f.id] ? { ...f, selectedValues: dimSel[f.id] } : f,
        ),
      }));
    }
  },

  lastSavedSnapshot: null,
  setLastSavedSnapshot: (snap) => {
    if (snap) {
      const migrated = {
        ...snap,
        widgets: snap.widgets.map((w) => ({ ...w, binding: migrateBinding(w.binding) })),
      };
      set({ lastSavedSnapshot: migrated });
    } else {
      set({ lastSavedSnapshot: null });
    }
  },

  isDirty: () => {
    const s = get();
    const ref = s.lastSavedSnapshot;
    if (!ref || !s.activePresetId) return false;
    if (s.selectedTable !== ref.selectedTable) return true;
    if (s.widgets.length !== ref.widgets.length) return true;
    if (s.kpiCards.length !== (ref.kpiCards?.length ?? 0)) return true;
    if (s.filters.length !== ref.filters.length) return true;
    if (s.dynamicFilters.length !== ref.dynamicFilters.length) return true;
    if (s.selectedOutputColumns.length !== ref.selectedOutputColumns.length) return true;
    if (s.selectedOutputColumns.join(",") !== ref.selectedOutputColumns.join(",")) return true;

    for (let i = 0; i < s.widgets.length; i++) {
      const cur = s.widgets[i];
      const saved = ref.widgets[i];
      if (!saved) return true;
      if (cur.chartType !== saved.chartType) return true;
      if (cur.title !== saved.title) return true;
      if ((cur.binding.xColumns ?? []).join(",") !== (saved.binding.xColumns ?? []).join(",")) return true;
      if ((cur.binding.groupBy ?? []).join(",") !== (saved.binding.groupBy ?? []).join(",")) return true;
      if ((cur.binding.yColumns ?? []).join(",") !== (saved.binding.yColumns ?? []).join(",")) return true;
    }

    for (let i = 0; i < s.filters.length; i++) {
      const cur = s.filters[i];
      const saved = ref.filters[i];
      if (cur.selectedValues.join(",") !== saved.selectedValues.join(",")) return true;
      if (cur.dateFrom !== saved.dateFrom || cur.dateTo !== saved.dateTo) return true;
    }

    if (s.themeConfig.colorScheme !== ref.themeConfig.colorScheme) return true;
    return false;
  },

  lastRefreshTime: null,
  setLastRefreshTime: (lastRefreshTime) => set({ lastRefreshTime }),
  lastQueryMs: null,
  setLastQueryMs: (lastQueryMs) => set({ lastQueryMs }),
});
