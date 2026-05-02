import type { StateCreator } from "zustand";
import type {
  ColumnMeta,
  FormulaColumn,
  SharedFormulaColumn,
} from "@/types/dashboard";
import type { DashboardStore } from "../storeTypes";

export interface CatalogSlice {
  catalogs: string[];
  schemas: Record<string, string[]>;
  tablesMap: Record<string, string[]>;
  columns: Record<string, ColumnMeta[]>;
  selectedCatalog: string | null;
  selectedSchema: string | null;
  selectedTable: string | null;
  columnTableMap: Record<string, string>;
  selectedOutputColumns: string[];
  formulaColumns: FormulaColumn[];
  sharedFormulas: SharedFormulaColumn[];
  setCatalogs: (c: string[]) => void;
  selectCatalog: (c: string) => void;
  setSchemas: (catalog: string, schemas: string[]) => void;
  selectSchema: (s: string) => void;
  setTablesForSchema: (key: string, tables: string[]) => void;
  selectTable: (name: string) => void;
  setColumns: (table: string, cols: ColumnMeta[]) => void;
  setColumnTableMap: (map: Record<string, string>) => void;
  toggleOutputColumn: (col: string) => void;
  setOutputColumns: (cols: string[]) => void;
  reorderOutputColumns: (from: number, to: number) => void;
  selectAllOutputColumns: () => void;
  clearOutputColumns: () => void;
  addFormulaColumn: (fc: Omit<FormulaColumn, "id">) => void;
  updateFormulaColumn: (id: string, patch: Partial<Omit<FormulaColumn, "id">>) => void;
  removeFormulaColumn: (id: string) => void;
  setSharedFormulas: (formulas: SharedFormulaColumn[]) => void;
  /** Returns the effective FROM-clause table reference, handling custom query mode */
  effectiveTableRef: () => string | null;
}

export const createCatalogSlice: StateCreator<DashboardStore, [], [], CatalogSlice> = (set, get) => ({
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
    set((s) => {
      const overrides = s.activeWorkspace?.column_type_overrides;
      const effective = overrides && Object.keys(overrides).length > 0
        ? cols.map((c) => overrides[c.col_name] ? { ...c, data_type: overrides[c.col_name] } : c)
        : cols;
      return { columns: { ...s.columns, [table]: effective } };
    }),

  columnTableMap: {},
  setColumnTableMap: (map) => set((s) => ({ columnTableMap: { ...s.columnTableMap, ...map } })),

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
    const { selectedCatalog, selectedSchema, selectedTable, columns, activeWorkspace } = get();
    const isCustom = activeWorkspace?.datasource?.source_mode === "query";
    const key = isCustom
      ? "__custom_source__"
      : (selectedCatalog && selectedSchema && selectedTable
        ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : selectedTable);
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

  effectiveTableRef: () => {
    const { activeWorkspace, selectedCatalog, selectedSchema, selectedTable } = get();
    const ds = activeWorkspace?.datasource;
    if (ds?.source_mode === "query" && ds.custom_query) {
      return `(${ds.custom_query}) AS __custom_source__`;
    }
    if (selectedCatalog && selectedSchema && selectedTable) {
      return `${selectedCatalog}.${selectedSchema}.${selectedTable}`;
    }
    return null;
  },
});
