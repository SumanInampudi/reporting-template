import type { StateCreator } from "zustand";
import type {
  DatePreset,
  DynamicFilter,
  FilterItem,
  FilterMode,
  FilterSortOrder,
  FilterType,
  NumericOp,
} from "@/types/dashboard";
import type { DashboardStore } from "../storeTypes";
import { filterUid, isDateType } from "../storeUtils";
import { isNumericType as isNumType } from "@/lib/kpiUtils";

export interface FilterSlice {
  filters: FilterItem[];
  appliedFilters: FilterItem[];
  filtersVersion: number;
  dynamicFilters: DynamicFilter[];
  appliedDynamicFilters: DynamicFilter[];
  dashboardFilters: FilterItem[];
  addFilter: (column: string, table: string, dataType: string) => void;
  removeFilter: (id: string) => void;
  updateFilterMode: (id: string, mode: FilterMode) => void;
  updateFilterType: (id: string, filterType: FilterType) => void;
  setFilterValues: (id: string, values: string[]) => void;
  setFilterSelection: (id: string, selected: string[]) => void;
  setFilterSortOrder: (id: string, sortOrder: FilterSortOrder) => void;
  setFilterDateRange: (id: string, from: string, to: string, preset?: DatePreset) => void;
  setFilterNumeric: (id: string, op: NumericOp, val: number | undefined, val2?: number) => void;
  setFilterFreeText: (id: string, values: string[], caseSensitive: boolean) => void;
  applyFilters: () => void;
  addDynamicFilter: (filter: Omit<DynamicFilter, "id">) => void;
  updateDynamicFilter: (id: string, patch: Partial<Omit<DynamicFilter, "id">>) => void;
  removeDynamicFilter: (id: string) => void;
  toggleDynamicFilter: (id: string) => void;
  setDashboardFilters: (filters: FilterItem[]) => void;
  updateDashboardFilter: (id: string, patch: Partial<FilterItem>) => void;
  resetDashboardFilters: () => void;
}

export const createFilterSlice: StateCreator<DashboardStore, [], [], FilterSlice> = (set, get) => ({
  filters: [],
  appliedFilters: [],
  filtersVersion: 0,

  addFilter: (column, table, dataType) => {
    const exists = get().filters.some((f) => f.column === column && f.table === table);
    if (exists) return;
    const ftCols = get().activeWorkspace?.free_text_filter_columns ?? [];
    const srCols = get().activeWorkspace?.search_select_columns ?? [];
    const ssCols = get().activeWorkspace?.single_select_columns ?? [];
    const isFreeText = ftCols.includes(column);
    const isSearchSelect = srCols.includes(column);
    const isSingleSelectForced = ssCols.includes(column);
    const filterType: FilterType = isFreeText
      ? "free_text"
      : isSearchSelect
        ? "search_select"
        : isDateType(dataType)
          ? "date_range"
          : isNumType(dataType)
            ? "numeric_range"
            : "value_list";
    const filter: FilterItem = {
      id: filterUid(),
      column, table, dataType, filterType,
      mode: isSingleSelectForced ? "single" : "multi",
      values: [], selectedValues: [],
      ...(isSingleSelectForced ? { singleSelectForced: true } : {}),
      ...(filterType === "numeric_range" ? { numericOp: ">" as NumericOp, numericValue: undefined, numericValue2: undefined } : {}),
      ...(filterType === "free_text" ? { freeTextValues: [], freeTextCaseSensitive: false } : {}),
    };
    set((s) => ({ filters: [...s.filters, filter] }));
  },

  removeFilter: (id) =>
    set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),

  updateFilterMode: (id, mode) =>
    set((s) => ({
      filters: s.filters.map((f) => {
        if (f.id !== id) return f;
        if (f.singleSelectForced) return f;
        return { ...f, mode, selectedValues: mode === "single" ? f.selectedValues.slice(0, 1) : f.selectedValues };
      }
      ),
    })),

  updateFilterType: (id, filterType) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === id ? { ...f, filterType, selectedValues: [], dateFrom: undefined, dateTo: undefined, datePreset: undefined } : f,
      ),
    })),

  setFilterValues: (id, values) =>
    set((s) => ({
      filters: s.filters.map((f) => (f.id === id ? { ...f, values } : f)),
    })),

  setFilterSelection: (id, selected) =>
    set((s) => ({
      filters: s.filters.map((f) => (f.id === id ? { ...f, selectedValues: selected } : f)),
    })),

  setFilterSortOrder: (id, sortOrder) =>
    set((s) => ({
      filters: s.filters.map((f) => (f.id === id ? { ...f, sortOrder } : f)),
    })),

  setFilterDateRange: (id, from, to, preset) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === id ? { ...f, dateFrom: from, dateTo: to, datePreset: preset ?? "custom" } : f,
      ),
    })),

  setFilterNumeric: (id, op, val, val2) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === id ? { ...f, numericOp: op, numericValue: val, numericValue2: val2 } : f,
      ),
    })),

  setFilterFreeText: (id, values, caseSensitive) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === id ? { ...f, freeTextValues: values, freeTextCaseSensitive: caseSensitive } : f,
      ),
    })),

  applyFilters: () =>
    set((s) => {
      const applied = s.filters.map((f) => ({ ...f }));
      return {
        appliedFilters: applied,
        appliedDynamicFilters: s.dynamicFilters.map((d) => ({
          ...d,
          groups: d.groups.map((g) => ({ ...g, conditions: g.conditions.map((c) => ({ ...c })) })),
        })),
        filtersVersion: s.filtersVersion + 1,
        dashboardFilters: applied.map((f) => ({
          ...f,
          id: `dash-${f.id}`,
          values: f.selectedValues.length > 0 ? [...f.selectedValues] : [...f.values],
        })),
      };
    }),

  dynamicFilters: [],
  appliedDynamicFilters: [],

  addDynamicFilter: (filter) =>
    set((s) => {
      const id = `df-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return { dynamicFilters: [...s.dynamicFilters, { ...filter, id }] };
    }),

  updateDynamicFilter: (id, patch) =>
    set((s) => ({
      dynamicFilters: s.dynamicFilters.map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
    })),

  removeDynamicFilter: (id) =>
    set((s) => ({
      dynamicFilters: s.dynamicFilters.filter((d) => d.id !== id),
    })),

  toggleDynamicFilter: (id) =>
    set((s) => ({
      dynamicFilters: s.dynamicFilters.map((d) =>
        d.id === id ? { ...d, enabled: !d.enabled } : d,
      ),
    })),

  dashboardFilters: [],

  setDashboardFilters: (dashboardFilters) => set({ dashboardFilters }),

  updateDashboardFilter: (id, patch) =>
    set((s) => ({
      dashboardFilters: s.dashboardFilters.map((f) =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    })),

  resetDashboardFilters: () =>
    set((s) => ({
      dashboardFilters: s.appliedFilters.map((f) => ({
        ...f,
        id: `dash-${f.id}`,
        values: f.selectedValues.length > 0 ? [...f.selectedValues] : [...f.values],
      })),
    })),
});
