import type { StateCreator } from "zustand";
import type {
  AppPage,
  AppTab,
  ColorScheme,
  ColumnAggregation,
  CurrentUser,
  Density,
  ThemeConfig,
  Workspace,
} from "@/types/dashboard";
import type { DashboardStore, SidebarTab } from "../storeTypes";
import { persistThemeConfig } from "../storeUtils";
import { setAbbreviations as setGlobalAbbreviations, getDefaultAbbreviations } from "@/lib/aliasUtils";

export interface CoreSlice {
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
  shortcutHandlers: Record<string, (() => void) | undefined>;
  registerShortcut: (key: string, handler: (() => void) | undefined) => void;
}

export const createCoreSlice: StateCreator<DashboardStore, [], [], CoreSlice> = (set, get) => ({
  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),

  teamName: "BI Excellence Suite",
  setTeamName: (teamName) => set({ teamName }),
  platformTagline: "Analytics Platform",
  setPlatformTagline: (platformTagline) => set({ platformTagline }),

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
    setGlobalAbbreviations(ws.abbreviations ?? getDefaultAbbreviations());
    const initialTab: AppTab = ws.capabilities.includes("self_service") ? "data" : ws.capabilities.includes("dashboarding") ? "dashboard" : "ai_insights";
    set({
      activeWorkspace: ws,
      currentPage: "workspace",
      themeConfig: cfg,
      theme,
      activeTab: initialTab,
      sidebarTab: initialTab === "dashboard" ? "design" : "datasource",
      selectedCatalog: ws.datasource?.source_mode === "query" ? null : (ws.datasource?.catalog ?? null),
      selectedSchema: ws.datasource?.source_mode === "query" ? null : (ws.datasource?.schema ?? null),
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
      _dimFiltersInitialized: false,
      dimensionFilters: [], dimensionSources: [], dimensionDisplayMaps: {},
      cascadeRules: [], cascadeVersion: 0,
      hierarchies: ws.hierarchies ?? [],
      activatedOptionalDimIds: [],
      columnTableMap: {},
      uploadedDataset: null,
    });
  },
  closeWorkspace: () =>
    set({
      activeWorkspace: null,
      currentPage: "home",
      sidebarTab: "datasource",
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
      _dimFiltersInitialized: false,
      dimensionFilters: [], dimensionSources: [], dimensionDisplayMaps: {},
      cascadeRules: [], cascadeVersion: 0,
      hierarchies: [],
      activatedOptionalDimIds: [],
      columnTableMap: {},
      uploadedDataset: null,
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

  shortcutHandlers: {},
  registerShortcut: (key, handler) =>
    set((s) => ({ shortcutHandlers: { ...s.shortcutHandlers, [key]: handler } })),
});
