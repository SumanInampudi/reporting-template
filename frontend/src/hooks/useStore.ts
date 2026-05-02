import { create } from "zustand";
import type {
  AppPage,
  AppTab,
  Capability,
  ChartSettings,
  ChartType,
  ColorScheme,
  ColumnMeta,
  CurrentUser,
  CustomThemeColors,
  DashboardWidget,
  DatePreset,
  Density,
  DynamicFilter,
  FilterItem,
  FilterMode,
  FilterType,
  FormulaColumn,
  KpiCard,
  KpiFormat,
  LayoutItem,
  NumericOp,
  Preset,
  PresetSnapshot,
  QueryResult,
  SavedCustomTheme,
  SharedFormulaColumn,
  ThemeConfig,
  WidgetSnapshot,
  WidgetSize,
  Workspace,
} from "@/types/dashboard";
import { DEFAULT_CHART_SETTINGS } from "@/lib/constants";
import { uid, filterUid, isDateType, loadThemeConfig, persistThemeConfig } from "./storeUtils";
import { humanizeColumn, isNumericType as isNumType } from "@/lib/kpiUtils";

export type SidebarTab = "datasource" | "design";

interface DashboardStore {
  currentUser: CurrentUser | null;
  setCurrentUser: (u: CurrentUser) => void;

  currentPage: AppPage;
  setCurrentPage: (p: AppPage) => void;

  workspaces: Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
  activeWorkspace: Workspace | null;
  openWorkspace: (ws: Workspace) => void;
  closeWorkspace: () => void;
  setColumnAggregation: (col: string, agg: import("@/types/dashboard").ColumnAggregation) => void;
  editingWorkspace: Workspace | null;
  editWorkspace: (ws: Workspace) => void;
  clearEditing: () => void;

  activeTab: AppTab;
  setActiveTab: (t: AppTab) => void;

  sidebarTab: SidebarTab;
  setSidebarTab: (t: SidebarTab) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  toggleFocusMode: () => void;

  themeConfig: ThemeConfig;
  setColorScheme: (scheme: ColorScheme) => void;
  setDensity: (d: Density) => void;
  setCustomColors: (colors: CustomThemeColors) => void;
  theme: ColorScheme;
  toggleTheme: () => void;

  gridRows: number;
  gridCols: number;
  setGridSize: (rows: number, cols: number) => void;
  dashboardCols: number;
  setDashboardCols: (cols: number) => void;

  kpiCards: KpiCard[];
  addKpiCard: (column: string, table: string, aggregation?: string) => void;
  updateKpiCard: (id: string, patch: Partial<KpiCard>) => void;
  removeKpiCard: (id: string) => void;
  reorderKpiCards: (fromId: string, toId: string) => void;

  widgets: DashboardWidget[];
  layouts: LayoutItem[];

  catalogs: string[];
  schemas: Record<string, string[]>;
  tablesMap: Record<string, string[]>;
  columns: Record<string, ColumnMeta[]>;

  selectedCatalog: string | null;
  selectedSchema: string | null;
  selectedTable: string | null;

  setCatalogs: (c: string[]) => void;
  selectCatalog: (c: string) => void;
  setSchemas: (catalog: string, schemas: string[]) => void;
  selectSchema: (s: string) => void;
  setTablesForSchema: (key: string, tables: string[]) => void;
  selectTable: (name: string) => void;
  setColumns: (table: string, cols: ColumnMeta[]) => void;

  selectedOutputColumns: string[];
  toggleOutputColumn: (col: string) => void;
  setOutputColumns: (cols: string[]) => void;
  reorderOutputColumns: (from: number, to: number) => void;
  selectAllOutputColumns: () => void;
  clearOutputColumns: () => void;

  formulaColumns: FormulaColumn[];
  addFormulaColumn: (fc: Omit<FormulaColumn, "id">) => void;
  updateFormulaColumn: (id: string, patch: Partial<Omit<FormulaColumn, "id">>) => void;
  removeFormulaColumn: (id: string) => void;

  sharedFormulas: SharedFormulaColumn[];
  setSharedFormulas: (formulas: SharedFormulaColumn[]) => void;

  baseDataset: QueryResult | null;
  baseDatasetLoading: boolean;
  baseDatasetError: string | null;
  baseDatasetSql: string | null;
  loadPhase: "idle" | "counting" | "fetching" | "rendering";
  loadStepTimings: Record<string, number>;
  estimatedRowCount: number | null;
  collapseVersion: number;
  setLoadPhase: (p: "idle" | "counting" | "fetching" | "rendering") => void;
  setLoadStepTiming: (phase: string, ms: number) => void;
  setEstimatedRowCount: (n: number | null) => void;
  bumpCollapseVersion: () => void;
  setBaseDataset: (data: QueryResult, sql: string) => void;
  setBaseDatasetLoading: (v: boolean) => void;
  setBaseDatasetError: (e: string | null) => void;
  clearBaseDataset: () => void;

  addWidget: (chartType: ChartType) => string;
  reorderWidgets: (fromId: string, toId: string) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<DashboardWidget>) => void;
  updateWidgetSettings: (id: string, patch: Partial<ChartSettings>) => void;
  setWidgetSize: (id: string, size: WidgetSize) => void;
  setWidgetData: (id: string, data: QueryResult) => void;
  updateLayouts: (layouts: LayoutItem[]) => void;

  filters: FilterItem[];
  appliedFilters: FilterItem[];
  addFilter: (column: string, table: string, dataType: string) => void;
  removeFilter: (id: string) => void;
  updateFilterMode: (id: string, mode: FilterMode) => void;
  updateFilterType: (id: string, filterType: FilterType) => void;
  setFilterValues: (id: string, values: string[]) => void;
  setFilterSelection: (id: string, selected: string[]) => void;
  setFilterDateRange: (id: string, from: string, to: string, preset?: DatePreset) => void;
  setFilterNumeric: (id: string, op: NumericOp, val: number | undefined, val2?: number) => void;
  applyFilters: () => void;
  filtersVersion: number;

  dynamicFilters: DynamicFilter[];
  appliedDynamicFilters: DynamicFilter[];
  addDynamicFilter: (filter: Omit<DynamicFilter, "id">) => void;
  updateDynamicFilter: (id: string, patch: Partial<Omit<DynamicFilter, "id">>) => void;
  removeDynamicFilter: (id: string) => void;
  toggleDynamicFilter: (id: string) => void;

  dashboardFilters: FilterItem[];
  setDashboardFilters: (filters: FilterItem[]) => void;
  updateDashboardFilter: (id: string, patch: Partial<FilterItem>) => void;
  resetDashboardFilters: () => void;
  lastRefreshTime: string | null;
  setLastRefreshTime: (t: string | null) => void;
  lastQueryMs: number | null;
  setLastQueryMs: (ms: number | null) => void;

  savedCustomThemes: SavedCustomTheme[];
  setSavedCustomThemes: (themes: SavedCustomTheme[]) => void;

  presets: Preset[];
  activePresetId: string | null;
  presetLoadVersion: number;
  presetWarning: string | null;
  setPresets: (presets: Preset[]) => void;
  setActivePresetId: (id: string | null) => void;
  captureSnapshot: () => PresetSnapshot;
  loadSnapshot: (snapshot: PresetSnapshot) => void;

  lastSavedSnapshot: PresetSnapshot | null;
  setLastSavedSnapshot: (snap: PresetSnapshot | null) => void;
  isDirty: () => boolean;

  metadataReady: () => boolean;
  effectiveRowLimit: () => number;
}

const initialTheme = loadThemeConfig();

export const useStore = create<DashboardStore>((set, get) => ({
  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),

  currentPage: "home",
  setCurrentPage: (currentPage) => set({ currentPage }),

  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  activeWorkspace: null,
  openWorkspace: (ws) => {
    const theme = (ws.settings?.theme ?? "nike") as ColorScheme;
    const raw = ws.settings?.density;
    const density = (raw && raw !== "comfortable" ? raw : "spacious") as Density;
    const cfg: ThemeConfig = { colorScheme: theme, density };
    persistThemeConfig(cfg);
    set({
      activeWorkspace: ws,
      currentPage: "workspace",
      themeConfig: cfg,
      theme,
      activeTab: ws.capabilities.includes("self_service") ? "data" : ws.capabilities.includes("dashboarding") ? "dashboard" : "ai_insights",
      selectedCatalog: ws.datasource?.catalog ?? null,
      selectedSchema: ws.datasource?.schema ?? null,
      selectedTable: null,
      selectedOutputColumns: [], formulaColumns: [], sharedFormulas: [],
      filters: [], appliedFilters: [],
      dynamicFilters: [], appliedDynamicFilters: [],
      baseDataset: null, baseDatasetSql: null, baseDatasetError: null,
      baseDatasetLoading: false,
      loadPhase: "idle", loadStepTimings: {}, estimatedRowCount: null,
      widgets: [], layouts: [],
      kpiCards: [], dashboardFilters: [],
      presets: [], activePresetId: null, lastSavedSnapshot: null,
      presetWarning: null, lastQueryMs: null, lastRefreshTime: null,
      focusMode: false,
    });
  },
  closeWorkspace: () =>
    set({
      activeWorkspace: null,
      currentPage: "home",
      selectedCatalog: null, selectedSchema: null, selectedTable: null,
      selectedOutputColumns: [], formulaColumns: [], sharedFormulas: [],
      filters: [], appliedFilters: [],
      dynamicFilters: [], appliedDynamicFilters: [],
      baseDataset: null, baseDatasetSql: null, baseDatasetError: null,
      baseDatasetLoading: false,
      loadPhase: "idle", loadStepTimings: {}, estimatedRowCount: null,
      widgets: [], layouts: [],
      kpiCards: [], dashboardFilters: [],
      presets: [], activePresetId: null, lastSavedSnapshot: null,
      presetWarning: null, lastQueryMs: null, lastRefreshTime: null,
      focusMode: false,
    }),
  setColumnAggregation: (col, agg) => {
    const ws = get().activeWorkspace;
    if (!ws) return;
    const prev = ws.column_aggregations ?? {};
    const next = { ...prev, [col]: agg };
    set({ activeWorkspace: { ...ws, column_aggregations: next } });
  },
  editingWorkspace: null,
  editWorkspace: (ws) => set({ editingWorkspace: ws, currentPage: "setup" }),
  clearEditing: () => set({ editingWorkspace: null }),

  activeTab: "data",
  setActiveTab: (activeTab) => set({ activeTab }),

  sidebarTab: "datasource",
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  themeConfig: initialTheme,
  theme: initialTheme.colorScheme,

  setColorScheme: (scheme) =>
    set((s) => {
      const cfg = { ...s.themeConfig, colorScheme: scheme };
      persistThemeConfig(cfg);
      return { themeConfig: cfg, theme: scheme };
    }),

  setDensity: (density) =>
    set((s) => {
      const cfg = { ...s.themeConfig, density };
      persistThemeConfig(cfg);
      return { themeConfig: cfg };
    }),

  setCustomColors: (customColors) =>
    set((s) => {
      const cfg = { ...s.themeConfig, colorScheme: "custom" as ColorScheme, customColors };
      persistThemeConfig(cfg);
      return { themeConfig: cfg, theme: "custom" };
    }),

  toggleTheme: () =>
    set((s) => {
      const LIGHT_SCHEMES = new Set(["light", "slate", "minimal"]);
      const isLight = LIGHT_SCHEMES.has(s.themeConfig.colorScheme);
      const next: ColorScheme = isLight ? "dark" : "light";
      const cfg = { ...s.themeConfig, colorScheme: next };
      persistThemeConfig(cfg);
      return { themeConfig: cfg, theme: next };
    }),

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

  widgets: [],
  layouts: [],

  catalogs: [],
  schemas: {},
  tablesMap: {},
  columns: {},

  selectedCatalog: null,
  selectedSchema: null,
  selectedTable: null,

  setCatalogs: (catalogs) => set({ catalogs }),
  selectCatalog: (c) =>
    set({
      selectedCatalog: c || null, selectedSchema: null, selectedTable: null,
      selectedOutputColumns: [], formulaColumns: [], filters: [], appliedFilters: [],
      dynamicFilters: [], appliedDynamicFilters: [],
      baseDataset: null, baseDatasetSql: null, baseDatasetError: null,
      widgets: [], layouts: [],
    }),
  setSchemas: (catalog, schemas) =>
    set((s) => ({ schemas: { ...s.schemas, [catalog]: schemas } })),
  selectSchema: (s) => set({
    selectedSchema: s || null, selectedTable: null,
    selectedOutputColumns: [], formulaColumns: [], filters: [], appliedFilters: [],
    dynamicFilters: [], appliedDynamicFilters: [],
    baseDataset: null, baseDatasetSql: null, baseDatasetError: null,
    widgets: [], layouts: [],
  }),
  setTablesForSchema: (key, tables) =>
    set((s) => ({ tablesMap: { ...s.tablesMap, [key]: tables } })),
  selectTable: (name) => set({
    selectedTable: name || null,
    selectedOutputColumns: [], formulaColumns: [], filters: [], appliedFilters: [],
    dynamicFilters: [], appliedDynamicFilters: [],
    baseDataset: null, baseDatasetSql: null, baseDatasetError: null,
    widgets: [], layouts: [],
  }),
  setColumns: (table, cols) =>
    set((s) => ({ columns: { ...s.columns, [table]: cols } })),

  selectedOutputColumns: [],
  toggleOutputColumn: (col) =>
    set((s) => {
      const has = s.selectedOutputColumns.includes(col);
      return {
        selectedOutputColumns: has
          ? s.selectedOutputColumns.filter((c) => c !== col)
          : [...s.selectedOutputColumns, col],
      };
    }),
  setOutputColumns: (cols) => set({ selectedOutputColumns: cols }),
  reorderOutputColumns: (from, to) =>
    set((s) => {
      const arr = [...s.selectedOutputColumns];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { selectedOutputColumns: arr };
    }),
  selectAllOutputColumns: () => {
    const { selectedCatalog, selectedSchema, selectedTable, columns } = get();
    const key = selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : selectedTable;
    if (!key) return;
    const cols = columns[key];
    if (cols) set({ selectedOutputColumns: cols.map((c) => c.col_name) });
  },
  clearOutputColumns: () => set({ selectedOutputColumns: [] }),

  formulaColumns: [],
  addFormulaColumn: (fc) =>
    set((s) => {
      const id = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return { formulaColumns: [...s.formulaColumns, { ...fc, id }] };
    }),
  updateFormulaColumn: (id, patch) =>
    set((s) => ({
      formulaColumns: s.formulaColumns.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),
  removeFormulaColumn: (id) =>
    set((s) => ({
      formulaColumns: s.formulaColumns.filter((f) => f.id !== id),
      selectedOutputColumns: s.selectedOutputColumns.filter((c) => !c.startsWith(`__fc__${id}__`)),
    })),

  sharedFormulas: [],
  setSharedFormulas: (formulas) => set({ sharedFormulas: formulas }),

  baseDataset: null,
  baseDatasetLoading: false,
  baseDatasetError: null,
  baseDatasetSql: null,
  loadPhase: "idle",
  loadStepTimings: {},
  estimatedRowCount: null,
  collapseVersion: 0,
  setLoadPhase: (p) => set({ loadPhase: p }),
  setLoadStepTiming: (phase, ms) => set((s) => ({ loadStepTimings: { ...s.loadStepTimings, [phase]: ms } })),
  setEstimatedRowCount: (n) => set({ estimatedRowCount: n }),
  bumpCollapseVersion: () => set((s) => ({ collapseVersion: s.collapseVersion + 1 })),
  setBaseDataset: (data, sql) => {
    set({
      baseDataset: data, baseDatasetSql: sql,
      baseDatasetLoading: false, baseDatasetError: null,
      lastRefreshTime: new Date().toLocaleTimeString(),
    });
  },
  setBaseDatasetLoading: (v) => set({ baseDatasetLoading: v, baseDatasetError: v ? null : get().baseDatasetError }),
  setBaseDatasetError: (e) => set({ baseDatasetError: e, baseDatasetLoading: false, loadPhase: "idle" }),
  clearBaseDataset: () => set({ baseDataset: null, baseDatasetSql: null, baseDatasetError: null, loadPhase: "idle", loadStepTimings: {}, estimatedRowCount: null }),

  addWidget: (chartType) => {
    const id = uid();
    const { selectedCatalog, selectedSchema, selectedTable } = get();
    const fqTable =
      selectedCatalog && selectedSchema && selectedTable
        ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
        : selectedTable;

    const widget: DashboardWidget = {
      id,
      chartType,
      title: `New ${chartType} chart`,
      tableName: fqTable,
      binding: { xColumn: null, yColumns: [], groupBy: null },
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

  filters: [],
  appliedFilters: [],
  filtersVersion: 0,

  addFilter: (column, table, dataType) => {
    const exists = get().filters.some((f) => f.column === column && f.table === table);
    if (exists) return;
    const filterType: FilterType = isDateType(dataType)
      ? "date_range"
      : isNumType(dataType)
        ? "numeric_range"
        : "value_list";
    const filter: FilterItem = {
      id: filterUid(),
      column, table, dataType, filterType,
      mode: "multi", values: [], selectedValues: [],
      ...(filterType === "numeric_range" ? { numericOp: ">" as NumericOp, numericValue: undefined, numericValue2: undefined } : {}),
    };
    set((s) => ({ filters: [...s.filters, filter] }));
  },

  removeFilter: (id) =>
    set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),

  updateFilterMode: (id, mode) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === id ? { ...f, mode, selectedValues: mode === "single" ? f.selectedValues.slice(0, 1) : f.selectedValues } : f,
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

  lastRefreshTime: null,
  setLastRefreshTime: (lastRefreshTime) => set({ lastRefreshTime }),
  lastQueryMs: null,
  setLastQueryMs: (lastQueryMs) => set({ lastQueryMs }),

  savedCustomThemes: [],
  setSavedCustomThemes: (savedCustomThemes) => set({ savedCustomThemes }),

  presets: [],
  activePresetId: null,
  presetLoadVersion: 0,
  presetWarning: null,
  setPresets: (presets) => set({ presets }),
  setActivePresetId: (activePresetId) => set({ activePresetId }),

  captureSnapshot: () => {
    const s = get();
    const widgets: WidgetSnapshot[] = s.widgets.map(({ data, ...rest }) => rest);
    return {
      selectedTable: s.selectedTable,
      selectedOutputColumns: [...s.selectedOutputColumns],
      formulaColumns: s.formulaColumns.map((fc) => ({ ...fc })),
      filters: s.filters.map(({ values, ...rest }) => ({ ...rest, values: [] })),
      dynamicFilters: s.dynamicFilters.map((d) => ({
        ...d,
        groups: d.groups.map((g) => ({ ...g, conditions: g.conditions.map((c) => ({ ...c })) })),
      })),
      widgets,
      layouts: s.layouts.map((l) => ({ ...l })),
      gridRows: s.gridRows,
      gridCols: s.gridCols,
      dashboardCols: s.dashboardCols,
      kpiCards: s.kpiCards.map((k) => ({ ...k })),
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
      col.startsWith("__fc__") || col.startsWith("__sf__") || !knownCols || knownCols.has(col);

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
    const widgets = snap.widgets.filter((w) => {
      const cols = [w.binding.xColumn, ...(w.binding.yColumns ?? []), w.binding.groupBy].filter(Boolean) as string[];
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
    });
  },

  lastSavedSnapshot: null,
  setLastSavedSnapshot: (lastSavedSnapshot) => set({ lastSavedSnapshot }),

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
      if (cur.binding.xColumn !== saved.binding.xColumn) return true;
      if (cur.binding.groupBy !== saved.binding.groupBy) return true;
      if (cur.binding.yColumns.join(",") !== saved.binding.yColumns.join(",")) return true;
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

  metadataReady: () => {
    const { selectedCatalog, selectedSchema, selectedTable, columns } = get();
    if (!selectedTable) return false;
    const key = selectedCatalog && selectedSchema
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : selectedTable;
    return Array.isArray(columns[key]) && columns[key].length > 0;
  },

  effectiveRowLimit: () => {
    const ws = get().activeWorkspace;
    const limit = ws?.settings?.row_limit ?? 0;
    return limit > 0 ? limit : 0;
  },
}));
