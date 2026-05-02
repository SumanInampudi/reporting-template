import type {
  AppPage,
  AppTab,
  CascadeRule,
  ChartSettings,
  ChartType,
  ColorScheme,
  ColumnAggregation,
  ColumnMeta,
  CurrentUser,
  CustomThemeColors,
  DashboardWidget,
  DatePreset,
  Density,
  DimensionHierarchy,
  DimensionSource,
  DynamicFilter,
  FilterItem,
  FilterMode,
  FilterSortOrder,
  FilterType,
  FormulaColumn,
  KpiCard,
  LayoutItem,
  NumericOp,
  PivotSnapshot,
  Preset,
  PresetSnapshot,
  QueryResult,
  SavedCustomTheme,
  SharedFormulaColumn,
  ThemeConfig,
  UploadedDataset,
  UploadJoinConfig,
  WidgetSize,
  Workspace,
} from "@/types/dashboard";

export type SidebarTab = "datasource" | "design";

export type LoadPhase = "idle" | "counting" | "fetching" | "rendering";

export interface DashboardStore {
  currentUser: CurrentUser | null;
  setCurrentUser: (u: CurrentUser) => void;

  teamName: string;
  setTeamName: (name: string) => void;
  platformTagline: string;
  setPlatformTagline: (tagline: string) => void;

  currentPage: AppPage;
  setCurrentPage: (p: AppPage) => void;

  workspaces: Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
  activeWorkspace: Workspace | null;
  openWorkspace: (ws: Workspace) => void;
  closeWorkspace: () => void;
  setColumnAggregation: (col: string, agg: ColumnAggregation) => void;
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

  columnTableMap: Record<string, string>;
  setColumnTableMap: (map: Record<string, string>) => void;

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

  effectiveTableRef: () => string | null;

  baseDataset: QueryResult | null;
  baseDatasetLoading: boolean;
  baseDatasetError: string | null;
  baseDatasetSql: string | null;
  loadPhase: LoadPhase;
  loadStepTimings: Record<string, number>;
  estimatedRowCount: number | null;
  collapseVersion: number;
  setLoadPhase: (p: LoadPhase) => void;
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
  setFilterSortOrder: (id: string, sortOrder: FilterSortOrder) => void;
  setFilterDateRange: (id: string, from: string, to: string, preset?: DatePreset) => void;
  setFilterNumeric: (id: string, op: NumericOp, val: number | undefined, val2?: number) => void;
  setFilterFreeText: (id: string, values: string[], caseSensitive: boolean) => void;
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

  dimensionFilters: FilterItem[];
  dimensionSources: DimensionSource[];
  cascadeRules: CascadeRule[];
  cascadeVersion: number;
  hierarchies: DimensionHierarchy[];
  activatedOptionalDimIds: string[];
  _dimFiltersInitialized: boolean;
  initDimensionFilters: () => void;
  bumpCascadeVersion: () => void;
  activateOptionalDim: (dimSourceId: string) => void;
  deactivateOptionalDim: (dimSourceId: string) => void;
  setDimensionFilterValues: (id: string, values: string[], displayMap?: Record<string, string>) => void;
  setDimensionFilterSelection: (id: string, selected: string[]) => void;
  dimensionDisplayMaps: Record<string, Record<string, string>>;

  lastRefreshTime: string | null;
  setLastRefreshTime: (t: string | null) => void;
  lastQueryMs: number | null;
  setLastQueryMs: (ms: number | null) => void;

  savedCustomThemes: SavedCustomTheme[];
  setSavedCustomThemes: (themes: SavedCustomTheme[]) => void;

  pivotConfig: PivotSnapshot | null;
  setPivotConfig: (config: PivotSnapshot | null) => void;

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
  resolvedAggregations: () => Record<string, ColumnAggregation>;

  shortcutHandlers: Record<string, (() => void) | undefined>;
  registerShortcut: (key: string, handler: (() => void) | undefined) => void;

  uploadedDataset: UploadedDataset | null;
  setUploadedDataset: (ds: UploadedDataset | null) => void;
  setUploadJoinConfig: (cfg: UploadJoinConfig | null) => void;
  clearUploadedDataset: () => void;
}
