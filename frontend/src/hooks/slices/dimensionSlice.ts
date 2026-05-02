import type { StateCreator } from "zustand";
import type {
  CascadeRule,
  DimensionHierarchy,
  DimensionSource,
  FilterItem,
} from "@/types/dashboard";
import type { DashboardStore } from "../storeTypes";

export interface DimensionSlice {
  dimensionFilters: FilterItem[];
  dimensionSources: DimensionSource[];
  cascadeRules: CascadeRule[];
  cascadeVersion: number;
  dimensionDisplayMaps: Record<string, Record<string, string>>;
  activatedOptionalDimIds: string[];
  hierarchies: DimensionHierarchy[];
  _dimFiltersInitialized: boolean;
  initDimensionFilters: () => void;
  bumpCascadeVersion: () => void;
  activateOptionalDim: (dimSourceId: string) => void;
  deactivateOptionalDim: (dimSourceId: string) => void;
  setDimensionFilterValues: (id: string, values: string[], displayMap?: Record<string, string>) => void;
  setDimensionFilterSelection: (id: string, selected: string[]) => void;
}

export const createDimensionSlice: StateCreator<DashboardStore, [], [], DimensionSlice> = (set, get) => ({
  dimensionFilters: [],
  dimensionSources: [],
  cascadeRules: [],
  cascadeVersion: 0,
  dimensionDisplayMaps: {},
  activatedOptionalDimIds: [],

  hierarchies: [],

  _dimFiltersInitialized: false,

  initDimensionFilters: () => {
    if (get()._dimFiltersInitialized) return;
    const ws = get().activeWorkspace;
    if (!ws?.dimension_sources?.length) {
      set({
        _dimFiltersInitialized: true,
        dimensionFilters: [], dimensionSources: [], dimensionDisplayMaps: {},
        cascadeRules: ws?.cascade_rules ?? [], cascadeVersion: 0,
        hierarchies: ws?.hierarchies ?? [],
        activatedOptionalDimIds: [],
      });
      return;
    }
    const fqTable = ws.datasource?.source_mode === "query" && ws.datasource?.custom_query
      ? `(${ws.datasource.custom_query}) AS __custom_source__`
      : (ws.datasource?.catalog && ws.datasource?.schema && ws.datasource?.default_table
        ? `${ws.datasource.catalog}.${ws.datasource.schema}.${ws.datasource.default_table}` : "");
    const filters: FilterItem[] = ws.dimension_sources.map((ds) => ({
      id: `dim-${ds.id}`,
      column: ds.column,
      table: fqTable,
      dataType: "STRING",
      filterType: "value_list" as const,
      mode: "multi" as const,
      values: [],
      selectedValues: [],
      ...(ds.sourceType === "formula" && ds.formula ? { formulaExpression: ds.formula } : {}),
    }));
    set({
      _dimFiltersInitialized: true,
      dimensionFilters: filters, dimensionSources: ws.dimension_sources,
      dimensionDisplayMaps: {}, cascadeRules: ws.cascade_rules ?? [], cascadeVersion: 0,
      hierarchies: ws.hierarchies ?? [],
      activatedOptionalDimIds: [],
    });
  },

  bumpCascadeVersion: () => set((s) => ({ cascadeVersion: s.cascadeVersion + 1 })),

  activateOptionalDim: (dimSourceId) =>
    set((s) => ({
      activatedOptionalDimIds: s.activatedOptionalDimIds.includes(dimSourceId)
        ? s.activatedOptionalDimIds
        : [...s.activatedOptionalDimIds, dimSourceId],
    })),

  deactivateOptionalDim: (dimSourceId) =>
    set((s) => ({
      activatedOptionalDimIds: s.activatedOptionalDimIds.filter((id) => id !== dimSourceId),
      dimensionFilters: s.dimensionFilters.map((f) =>
        f.id === `dim-${dimSourceId}` ? { ...f, selectedValues: [] } : f,
      ),
    })),

  setDimensionFilterValues: (id, values, displayMap) =>
    set((s) => ({
      dimensionFilters: s.dimensionFilters.map((f) => f.id === id ? { ...f, values } : f),
      dimensionDisplayMaps: displayMap
        ? { ...s.dimensionDisplayMaps, [id]: displayMap }
        : s.dimensionDisplayMaps,
    })),

  setDimensionFilterSelection: (id, selected) =>
    set((s) => ({
      dimensionFilters: s.dimensionFilters.map((f) => f.id === id ? { ...f, selectedValues: selected } : f),
    })),
});
