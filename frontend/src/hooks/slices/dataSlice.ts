import type { StateCreator } from "zustand";
import type {
  QueryResult,
  UploadedDataset,
  UploadJoinConfig,
} from "@/types/dashboard";
import type { DashboardStore, LoadPhase } from "../storeTypes";

export interface DataSlice {
  baseDataset: QueryResult | null;
  baseDatasetLoading: boolean;
  baseDatasetError: string | null;
  baseDatasetSql: string | null;
  loadPhase: LoadPhase;
  loadStepTimings: Record<string, number>;
  estimatedRowCount: number | null;
  collapseVersion: number;
  uploadedDataset: UploadedDataset | null;
  setLoadPhase: (p: LoadPhase) => void;
  setLoadStepTiming: (phase: string, ms: number) => void;
  setEstimatedRowCount: (n: number | null) => void;
  bumpCollapseVersion: () => void;
  setBaseDataset: (data: QueryResult, sql: string) => void;
  setBaseDatasetLoading: (v: boolean) => void;
  setBaseDatasetError: (e: string | null) => void;
  clearBaseDataset: () => void;
  setUploadedDataset: (ds: UploadedDataset | null) => void;
  setUploadJoinConfig: (cfg: UploadJoinConfig | null) => void;
  clearUploadedDataset: () => void;
  metadataReady: () => boolean;
  effectiveRowLimit: () => number;
}

export const createDataSlice: StateCreator<DashboardStore, [], [], DataSlice> = (set, get) => ({
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

  uploadedDataset: null,
  setUploadedDataset: (ds) => set({ uploadedDataset: ds }),
  setUploadJoinConfig: (cfg) => {
    const ds = get().uploadedDataset;
    if (ds) set({ uploadedDataset: { ...ds, joinConfig: cfg } });
  },
  clearUploadedDataset: () => set({ uploadedDataset: null }),

  metadataReady: () => {
    const { selectedCatalog, selectedSchema, selectedTable, columns, activeWorkspace } = get();
    if (!selectedTable) return false;
    const isCustom = activeWorkspace?.datasource?.source_mode === "query";
    const key = isCustom
      ? "__custom_source__"
      : (selectedCatalog && selectedSchema
        ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
        : selectedTable);
    return Array.isArray(columns[key]) && columns[key].length > 0;
  },

  effectiveRowLimit: () => {
    const ws = get().activeWorkspace;
    const limit = ws?.settings?.row_limit ?? 0;
    return limit > 0 ? limit : 0;
  },
});
