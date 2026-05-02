import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { runQuery } from "@/lib/api";
import { quoteTableRef } from "@/lib/sqlBuilder";
import { isNumericType } from "@/lib/kpiUtils";
import { findHierarchyByColumn, canDrillDown, getChildLevel, getAncestorColumns, getLevelIndex } from "@/lib/hierarchyUtils";
import type { PivotSnapshot } from "@/types/dashboard";
import {
  Table2, AlertTriangle, GripVertical, X, ChevronDown, ChevronUp,
  Loader2, Download, Search, Thermometer, ChevronRight,
} from "lucide-react";
import type { ColorScheme, ColumnMeta } from "@/types/dashboard";

/* ─── Types ─────────────────────────────────── */

type AggFunc =
  | "SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT"
  | "MIN" | "MAX" | "MEDIAN" | "STDDEV";

const ALL_AGG_OPTIONS: { value: AggFunc; label: string; numOnly: boolean }[] = [
  { value: "SUM",            label: "SUM",            numOnly: true },
  { value: "AVG",            label: "AVG",            numOnly: true },
  { value: "COUNT",          label: "COUNT",          numOnly: false },
  { value: "COUNT_DISTINCT", label: "COUNT DISTINCT", numOnly: false },
  { value: "MIN",            label: "MIN",            numOnly: false },
  { value: "MAX",            label: "MAX",            numOnly: false },
  { value: "MEDIAN",         label: "MEDIAN",         numOnly: true },
  { value: "STDDEV",         label: "STDDEV",         numOnly: true },
];

type NumFmt = "default" | "compact" | "comma" | "percent" | "currency";
const NUM_FMT_OPTIONS: { value: NumFmt; label: string }[] = [
  { value: "default",  label: "Auto" },
  { value: "comma",    label: "1,234" },
  { value: "compact",  label: "1.2K" },
  { value: "percent",  label: "12.3%" },
  { value: "currency", label: "$1,234" },
];

export interface ValueField {
  name: string;
  agg: AggFunc;
  fmt: NumFmt;
}

export interface PivotConfig {
  rowFields: string[];
  colFields: string[];
  valueFields: ValueField[];
}

const LIGHT_SCHEMES = new Set<string>(["light", "nike-light", "slate", "minimal"]);

/* ─── Helpers ───────────────────────────────── */

function isLightTheme(scheme: ColorScheme): boolean {
  return LIGHT_SCHEMES.has(scheme);
}

function aggSqlExpr(agg: AggFunc, col: string): string {
  switch (agg) {
    case "COUNT_DISTINCT": return `COUNT(DISTINCT \`${col}\`)`;
    case "MEDIAN":         return `PERCENTILE_APPROX(\`${col}\`, 0.5)`;
    case "STDDEV":         return `STDDEV(\`${col}\`)`;
    default:               return `${agg}(\`${col}\`)`;
  }
}

function formatCell(value: unknown, fmt: NumFmt): string {
  if (value == null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);

  switch (fmt) {
    case "compact":
      if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
      if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
      return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    case "comma":
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    case "percent":
      return `${(n * 100).toFixed(1)}%`;
    case "currency":
      return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    default:
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

/* ─── Draggable field chip ──────────────────── */

function DraggableChip({ id, label, zone }: { id: string; label: string; zone: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${zone}::${id}`,
    data: { field: id, fromZone: zone },
  });
  return (
    <div
      ref={setNodeRef}
      className={`pivot-chip ${isDragging ? "pivot-chip--dragging" : ""}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={12} />
      <span>{label}</span>
    </div>
  );
}

/* ─── Drop zone ─────────────────────────────── */

function DropZone({
  id,
  label,
  fields,
  alias,
  onRemove,
  renderExtra,
}: {
  id: string;
  label: string;
  fields: string[];
  alias: (c: string) => string;
  onRemove: (field: string) => void;
  renderExtra?: (field: string) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="pivot-zone" ref={setNodeRef}>
      <div className="pivot-zone__label">{label}</div>
      <div className={`pivot-zone__area ${isOver ? "pivot-zone__area--over" : ""}`}>
        {fields.length === 0 && <span className="pivot-zone__hint">Drop fields here</span>}
        {fields.map((f) => (
          <div key={f} className="pivot-zone__item">
            <DraggableChip id={f} label={alias(f)} zone={id} />
            {renderExtra?.(f)}
            <button className="pivot-zone__remove" onClick={() => onRemove(f)} title="Remove">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Build pivot SQL ────────────────────────── */

function buildPivotSql(
  tableName: string,
  config: PivotConfig,
  filters: { column: string; selectedValues: string[]; filterType: string; dateFrom?: string; dateTo?: string; formulaExpression?: string }[],
): string {
  if (config.rowFields.length === 0 && config.valueFields.length === 0) return "";

  const selectParts: string[] = [];
  const groupByParts: string[] = [];

  for (const f of config.rowFields) {
    selectParts.push(`\`${f}\``);
    groupByParts.push(`\`${f}\``);
  }
  for (const f of config.colFields) {
    selectParts.push(`\`${f}\``);
    groupByParts.push(`\`${f}\``);
  }
  for (const vf of config.valueFields) {
    const expr = aggSqlExpr(vf.agg, vf.name);
    selectParts.push(`${expr} AS \`${vf.agg}_${vf.name}\``);
  }

  const parts = [`SELECT ${selectParts.join(", ")}`, `FROM ${quoteTableRef(tableName)}`];

  const whereClauses: string[] = [];
  for (const f of filters) {
    if ((f.filterType === "date_range" || f.filterType === "date_relative") && (f.dateFrom || f.dateTo)) {
      const col = f.formulaExpression ? `(${f.formulaExpression})` : `\`${f.column}\``;
      if (f.dateFrom && f.dateTo) whereClauses.push(`${col} >= '${f.dateFrom}' AND ${col} <= '${f.dateTo}'`);
      else if (f.dateFrom) whereClauses.push(`${col} >= '${f.dateFrom}'`);
      else if (f.dateTo) whereClauses.push(`${col} <= '${f.dateTo}'`);
      continue;
    }
    if (f.filterType === "free_text") {
      const vals = (f as { freeTextValues?: string[] }).freeTextValues ?? [];
      if (vals.length === 0) continue;
      const caseSensitive = (f as { freeTextCaseSensitive?: boolean }).freeTextCaseSensitive ?? false;
      const col = f.formulaExpression ? `(${f.formulaExpression})` : `\`${f.column}\``;
      const colExpr = caseSensitive ? col : `UPPER(${col})`;
      const ftParts: string[] = [];
      const exactVals: string[] = [];
      for (const v of vals) {
        const normalized = caseSensitive ? v : v.toUpperCase();
        const esc = normalized.replace(/'/g, "''");
        if (v.includes("*")) {
          ftParts.push(`${colExpr} LIKE '${esc.replace(/\*/g, "%")}'`);
        } else {
          exactVals.push(`'${esc}'`);
        }
      }
      if (exactVals.length === 1) ftParts.push(`${colExpr} = ${exactVals[0]}`);
      else if (exactVals.length > 1) ftParts.push(`${colExpr} IN (${exactVals.join(", ")})`);
      whereClauses.push(ftParts.length === 1 ? ftParts[0] : `(${ftParts.join(" OR ")})`);
      continue;
    }
    if (f.selectedValues.length === 0) continue;
    const col = f.formulaExpression ? `(${f.formulaExpression})` : `\`${f.column}\``;
    const escaped = f.selectedValues.map((v) => `'${v.replace(/'/g, "''")}'`);
    if (f.selectedValues.length === 1) whereClauses.push(`${col} = ${escaped[0]}`);
    else whereClauses.push(`${col} IN (${escaped.join(", ")})`);
  }
  if (whereClauses.length > 0) parts.push(`WHERE ${whereClauses.join(" AND ")}`);

  if (groupByParts.length > 0) parts.push("GROUP BY ALL");
  parts.push("LIMIT 50000");
  return parts.join("\n");
}

/* ─── Client-side pivot of server aggregated rows ── */

interface PivotResult {
  rows: Record<string, unknown>[];
  colDefs: { field: string; headerName: string; isValue: boolean; vfIndex?: number }[];
}

function pivotServerData(
  rawCols: string[],
  rawRows: unknown[][],
  config: PivotConfig,
  alias: (c: string) => string,
): PivotResult {
  if (config.colFields.length === 0) {
    const colDefs = rawCols.map((c) => {
      const isVal = config.valueFields.some((v) => `${v.agg}_${v.name}` === c);
      return { field: c, headerName: alias(c), isValue: isVal };
    });
    const rows = rawRows.map((r) => {
      const obj: Record<string, unknown> = {};
      rawCols.forEach((c, i) => { obj[c] = r[i]; });
      return obj;
    });
    return { rows, colDefs };
  }

  const colIdx = new Map(rawCols.map((c, i) => [c, i]));
  const getVal = (row: unknown[], col: string) => row[colIdx.get(col) ?? -1];

  const rowKey = (row: unknown[]) =>
    config.rowFields.map((f) => String(getVal(row, f) ?? "")).join("||");
  const colKey = (row: unknown[]) =>
    config.colFields.map((f) => String(getVal(row, f) ?? "")).join("||");

  const groups = new Map<string, { dims: Record<string, unknown>; vals: Map<string, number> }>();
  const allColKeys = new Set<string>();

  for (const row of rawRows) {
    const rk = rowKey(row);
    const ck = colKey(row);
    allColKeys.add(ck);

    if (!groups.has(rk)) {
      const dims: Record<string, unknown> = {};
      for (const f of config.rowFields) dims[f] = getVal(row, f);
      groups.set(rk, { dims, vals: new Map() });
    }
    const group = groups.get(rk)!;

    for (const vf of config.valueFields) {
      const aggCol = `${vf.agg}_${vf.name}`;
      const bucketKey = `${ck}||${aggCol}`;
      const num = Number(getVal(row, aggCol)) || 0;
      group.vals.set(bucketKey, (group.vals.get(bucketKey) ?? 0) + num);
    }
  }

  const sortedColKeys = [...allColKeys].sort();
  const colDefs: PivotResult["colDefs"] = [];
  for (const f of config.rowFields) {
    colDefs.push({ field: f, headerName: alias(f), isValue: false });
  }
  for (const ck of sortedColKeys) {
    config.valueFields.forEach((vf, vi) => {
      const fieldKey = `${ck}__${vf.agg}_${vf.name}`.replace(/[^a-zA-Z0-9_]/g, "_");
      const colLabel = ck || "(blank)";
      const header = config.valueFields.length > 1
        ? `${colLabel} — ${alias(vf.name)} (${vf.agg})`
        : `${colLabel} (${vf.agg})`;
      colDefs.push({ field: fieldKey, headerName: header, isValue: true, vfIndex: vi });
    });
  }

  const rows: Record<string, unknown>[] = [];
  for (const [, group] of groups) {
    const row: Record<string, unknown> = { ...group.dims };
    for (const ck of sortedColKeys) {
      for (const vf of config.valueFields) {
        const aggCol = `${vf.agg}_${vf.name}`;
        const bucketKey = `${ck}||${aggCol}`;
        const fieldKey = `${ck}__${aggCol}`.replace(/[^a-zA-Z0-9_]/g, "_");
        row[fieldKey] = group.vals.get(bucketKey) ?? null;
      }
    }
    rows.push(row);
  }

  return { rows, colDefs };
}

/* ─── Grand totals ───────────────────────────── */

function computeGrandTotals(
  rows: Record<string, unknown>[],
  colDefs: PivotResult["colDefs"],
  config: PivotConfig,
): Record<string, unknown> {
  const totals: Record<string, unknown> = {};
  if (config.rowFields.length > 0) {
    totals[config.rowFields[0]] = "Grand Total";
  }
  for (const cd of colDefs) {
    if (!cd.isValue) continue;
    let sum = 0;
    let count = 0;
    for (const row of rows) {
      const v = Number(row[cd.field]);
      if (Number.isFinite(v)) { sum += v; count++; }
    }
    totals[cd.field] = count > 0 ? sum : null;
  }
  return totals;
}

/* ─── Heatmap styling ────────────────────────── */

function buildHeatmapRanges(
  rows: Record<string, unknown>[],
  colDefs: PivotResult["colDefs"],
): Map<string, { min: number; max: number }> {
  const ranges = new Map<string, { min: number; max: number }>();
  for (const cd of colDefs) {
    if (!cd.isValue) continue;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const v = Number(row[cd.field]);
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      ranges.set(cd.field, { min, max });
    }
  }
  return ranges;
}

function heatmapCellStyle(
  value: unknown,
  range: { min: number; max: number } | undefined,
  isLight: boolean,
  isGrandTotal: boolean,
  accentRgb: string,
): Record<string, string> | undefined {
  if (!range || value == null || isGrandTotal) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const t = Math.max(0, Math.min(1, (n - range.min) / (range.max - range.min)));
  const alpha = isLight ? 0.06 + t * 0.30 : 0.04 + t * 0.36;
  return { backgroundColor: `rgba(${accentRgb}, ${alpha.toFixed(2)})` };
}

function HeatmapLegend({ accentRgb, isLight }: { accentRgb: string; isLight: boolean }) {
  const lowAlpha = isLight ? 0.06 : 0.04;
  const highAlpha = isLight ? 0.36 : 0.40;
  return (
    <div className="pivot-heatmap-legend">
      <span className="pivot-heatmap-legend__label">Low</span>
      <div
        className="pivot-heatmap-legend__bar"
        style={{
          background: `linear-gradient(to right, rgba(${accentRgb}, ${lowAlpha}), rgba(${accentRgb}, ${highAlpha}))`,
        }}
      />
      <span className="pivot-heatmap-legend__label">High</span>
    </div>
  );
}

/* ─── CSV Export ─────────────────────────────── */

function exportPivotCsv(
  rows: Record<string, unknown>[],
  colDefs: { field: string; headerName: string }[],
) {
  const escapeCell = (v: unknown) => {
    const str = String(v ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = colDefs.map((c) => escapeCell(c.headerName)).join(",");
  const body = rows.map((r) => colDefs.map((c) => escapeCell(r[c.field])).join(","));
  const csv = [header, ...body].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pivot-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main PivotTab ─────────────────────────── */

export default function PivotTab() {
  const baseDataset = useStore((s) => s.baseDataset);
  const appliedFilters = useStore((s) => s.appliedFilters);
  const selectedCatalog = useStore((s) => s.selectedCatalog);
  const selectedSchema = useStore((s) => s.selectedSchema);
  const selectedTable = useStore((s) => s.selectedTable);
  const themeConfig = useStore((s) => s.themeConfig);
  const columnsMap = useStore((s) => s.columns);
  const storePivotConfig = useStore((s) => s.pivotConfig);
  const setPivotConfigInStore = useStore((s) => s.setPivotConfig);
  const presetLoadVersion = useStore((s) => s.presetLoadVersion);
  const hierarchies = useStore((s) => s.hierarchies);
  const alias = useColumnAlias();
  const gridRef = useRef<AgGridReact>(null);

  const [config, setConfigRaw] = useState<PivotConfig>({
    rowFields: [],
    colFields: [],
    valueFields: [],
  });

  const setConfig = useCallback((updater: PivotConfig | ((prev: PivotConfig) => PivotConfig)) => {
    setConfigRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const snap: PivotSnapshot = {
        rowFields: next.rowFields,
        colFields: next.colFields,
        valueFields: next.valueFields.map((v) => ({ name: v.name, agg: v.agg, fmt: v.fmt })),
      };
      setPivotConfigInStore(snap);
      return next;
    });
  }, [setPivotConfigInStore]);

  useEffect(() => {
    if (storePivotConfig) {
      setConfigRaw({
        rowFields: storePivotConfig.rowFields ?? [],
        colFields: storePivotConfig.colFields ?? [],
        valueFields: (storePivotConfig.valueFields ?? []).map((v) => ({
          name: v.name,
          agg: (v.agg as AggFunc) ?? "SUM",
          fmt: (v.fmt as NumFmt) ?? "default",
        })),
      });
    } else {
      setConfigRaw({ rowFields: [], colFields: [], valueFields: [] });
    }
  }, [presetLoadVersion]);

  const [pivotData, setPivotData] = useState<PivotResult>({ rows: [], colDefs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [showTotals, setShowTotals] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [pivotDrillFilters, setPivotDrillFilters] = useState<{ column: string; value: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const allColumns = useMemo(() => (baseDataset ? baseDataset.columns : []), [baseDataset]);

  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const effectiveTableRef = useStore((s) => s.effectiveTableRef);
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null);
  const fqTable = effectiveTableRef() ?? colKey;

  const columnMetaMap = useMemo(() => {
    const map = new Map<string, ColumnMeta>();
    if (!colKey) return map;
    const metas = columnsMap[colKey] ?? [];
    for (const m of metas) map.set(m.col_name, m);
    return map;
  }, [columnsMap, colKey]);

  const usedFields = useMemo(() => {
    const s = new Set<string>();
    config.rowFields.forEach((f) => s.add(f));
    config.colFields.forEach((f) => s.add(f));
    config.valueFields.forEach((f) => s.add(f.name));
    return s;
  }, [config]);

  const availableFields = useMemo(() => {
    let fields = allColumns.filter((c) => !usedFields.has(c) && !c.startsWith("__"));
    if (fieldSearch.trim()) {
      const q = fieldSearch.toLowerCase();
      fields = fields.filter((c) => c.toLowerCase().includes(q) || alias(c).toLowerCase().includes(q));
    }
    return fields;
  }, [allColumns, usedFields, fieldSearch, alias]);

  const lightTheme = isLightTheme(themeConfig.colorScheme);
  const agThemeClass = lightTheme ? "ag-theme-quartz" : "ag-theme-quartz-dark";

  const accentRgb = useMemo(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim();
    return raw || "250, 84, 0";
  }, [themeConfig.colorScheme]);

  const heatmapRanges = useMemo(
    () => heatmap ? buildHeatmapRanges(pivotData.rows, pivotData.colDefs) : new Map(),
    [heatmap, pivotData],
  );

  const displayRows = useMemo(() => {
    if (!showTotals || pivotData.rows.length === 0) return pivotData.rows;
    const totals = computeGrandTotals(pivotData.rows, pivotData.colDefs, config);
    return [...pivotData.rows, totals];
  }, [pivotData, showTotals, config]);

  const effectiveFilters = useMemo(() => {
    if (pivotDrillFilters.length === 0) return appliedFilters;
    const drillItems: typeof appliedFilters = pivotDrillFilters.map((df, i) => ({
      id: `pvt-drill-${i}`,
      column: df.column,
      table: fqTable ?? "",
      dataType: "STRING",
      filterType: "value_list" as const,
      mode: "single" as const,
      values: [df.value],
      selectedValues: [df.value],
    }));
    return [...appliedFilters, ...drillItems];
  }, [appliedFilters, pivotDrillFilters, fqTable]);

  /* ── Debounced query execution ─────────────── */
  useEffect(() => {
    if (!fqTable || config.valueFields.length === 0) {
      setPivotData({ rows: [], colDefs: [] });
      return;
    }
    const sql = buildPivotSql(fqTable, config, effectiveFilters);
    if (!sql) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      runQuery(sql)
        .then((result) => {
          const pivoted = pivotServerData(result.columns, result.rows, config, alias);
          setPivotData(pivoted);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Pivot query failed");
          setPivotData({ rows: [], colDefs: [] });
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fqTable, config, effectiveFilters, alias]);

  /* ── Drag & Drop ───────────────────────────── */

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;

      const data = active.data.current as { field: string; fromZone: string } | undefined;
      if (!data) return;

      const { field, fromZone } = data;
      const toZone = String(over.id);

      if (fromZone === toZone) return;

      setConfig((prev) => {
        const next = { ...prev };

        if (fromZone === "rows") next.rowFields = prev.rowFields.filter((f) => f !== field);
        else if (fromZone === "cols") next.colFields = prev.colFields.filter((f) => f !== field);
        else if (fromZone === "values") next.valueFields = prev.valueFields.filter((f) => f.name !== field);

        if (toZone === "rows" && !next.rowFields.includes(field)) {
          next.rowFields = [...next.rowFields, field];
        } else if (toZone === "cols" && !next.colFields.includes(field)) {
          next.colFields = [...next.colFields, field];
        } else if (toZone === "values" && !next.valueFields.some((v) => v.name === field)) {
          const meta = columnMetaMap.get(field);
          const numeric = meta ? isNumericType(meta.data_type) : false;
          const defaultAgg: AggFunc = numeric ? "SUM" : "COUNT";
          next.valueFields = [...next.valueFields, { name: field, agg: defaultAgg, fmt: "default" }];
        }

        return next;
      });
    },
    [columnMetaMap],
  );

  const removeFromZone = useCallback((zone: "rows" | "cols" | "values", field: string) => {
    setConfig((prev) => {
      if (zone === "rows") return { ...prev, rowFields: prev.rowFields.filter((f) => f !== field) };
      if (zone === "cols") return { ...prev, colFields: prev.colFields.filter((f) => f !== field) };
      return { ...prev, valueFields: prev.valueFields.filter((f) => f.name !== field) };
    });
  }, []);

  const setAgg = useCallback((field: string, agg: AggFunc) => {
    setConfig((prev) => ({
      ...prev,
      valueFields: prev.valueFields.map((v) => (v.name === field ? { ...v, agg } : v)),
    }));
  }, []);

  const setFmt = useCallback((field: string, fmt: NumFmt) => {
    setConfig((prev) => ({
      ...prev,
      valueFields: prev.valueFields.map((v) => (v.name === field ? { ...v, fmt } : v)),
    }));
  }, []);

  const aggOptionsForField = useCallback((fieldName: string) => {
    const meta = columnMetaMap.get(fieldName);
    const numeric = meta ? isNumericType(meta.data_type) : true;
    return numeric ? ALL_AGG_OPTIONS : ALL_AGG_OPTIONS.filter((a) => !a.numOnly);
  }, [columnMetaMap]);

  const dedupFields = (fields: string[]) => [...new Set(fields)];

  const drillToLevel = useCallback((targetColumn: string) => {
    const targetHier = findHierarchyByColumn(hierarchies, targetColumn);
    if (!targetHier) return;
    const targetIdx = getLevelIndex(targetHier, targetColumn);

    setPivotDrillFilters((prev) =>
      prev.filter((df) => {
        const idx = getLevelIndex(targetHier, df.column);
        return idx >= 0 ? idx < targetIdx : true;
      }),
    );

    setConfig((prev) => {
      const replace = (fields: string[]) =>
        dedupFields(fields.map((f) => {
          const h = findHierarchyByColumn(hierarchies, f);
          return h && h.id === targetHier.id ? targetColumn : f;
        }));
      return { ...prev, rowFields: replace(prev.rowFields), colFields: replace(prev.colFields) };
    });
  }, [hierarchies, setConfig]);

  const pivotClickDrill = useCallback((field: string, value: string) => {
    const h = findHierarchyByColumn(hierarchies, field);
    if (!h) return;
    const child = getChildLevel(h, field);
    if (!child) return;
    setPivotDrillFilters((prev) => [...prev, { column: field, value }]);
    setConfig((prev) => {
      const replace = (fields: string[]) =>
        dedupFields(fields.map((f) => (f === field ? child.column : f)));
      return { ...prev, rowFields: replace(prev.rowFields), colFields: replace(prev.colFields) };
    });
  }, [hierarchies, setConfig]);

  const resetPivotDrill = useCallback(() => {
    setPivotDrillFilters([]);
    if (hierarchies.length === 0) return;
    setConfig((prev) => {
      const resetFields = (fields: string[]) =>
        dedupFields(fields.map((f) => {
          const h = findHierarchyByColumn(hierarchies, f);
          return h && h.levels.length > 0 ? h.levels[0].column : f;
        }));
      return { ...prev, rowFields: resetFields(prev.rowFields), colFields: resetFields(prev.colFields) };
    });
  }, [hierarchies, setConfig]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { hierarchyName: string; levels: { column: string; label: string; isCurrent: boolean }[] }[] = [];
    const allFields = [...config.rowFields, ...config.colFields];
    const seen = new Set<string>();
    for (const field of allFields) {
      const h = findHierarchyByColumn(hierarchies, field);
      if (!h || seen.has(h.id)) continue;
      seen.add(h.id);
      const ancestors = getAncestorColumns(h, field);
      if (ancestors.length <= 0) continue;
      const levels = ancestors.map((col) => ({
        column: col,
        label: alias(col),
        isCurrent: col === field,
      }));
      crumbs.push({ hierarchyName: h.name, levels });
    }
    return crumbs;
  }, [config.rowFields, config.colFields, hierarchies, alias]);

  /* ── AG Grid column defs ───────────────────── */

  const drillableRowFields = useMemo(() => {
    const s = new Set<string>();
    for (const f of config.rowFields) {
      if (canDrillDown(hierarchies, f)) s.add(f);
    }
    return s;
  }, [config.rowFields, hierarchies]);

  const totalRowIdx = showTotals && displayRows.length > 0 ? displayRows.length - 1 : -1;

  const agColDefs = useMemo(
    () =>
      pivotData.colDefs.map((cd, i) => {
        const isValCol = cd.isValue;
        const vf = isValCol && cd.vfIndex != null ? config.valueFields[cd.vfIndex] : undefined;
        const fmt = vf?.fmt ?? "default";
        const range = heatmap ? heatmapRanges.get(cd.field) : undefined;
        const isDrillableRow = drillableRowFields.has(cd.field);

        return {
          field: cd.field,
          headerName: isDrillableRow ? `${cd.headerName} ↘` : cd.headerName,
          sortable: true,
          filter: true,
          resizable: true,
          pinned: i < config.rowFields.length ? ("left" as const) : undefined,
          cellDataType: isValCol ? ("number" as const) : undefined,
          valueFormatter: isValCol
            ? (p: { value: unknown }) => formatCell(p.value, fmt)
            : undefined,
          cellClass: isDrillableRow ? "pivot-cell--drillable" : undefined,
          cellStyle: range
            ? (p: { value: unknown; rowIndex: number }) =>
                heatmapCellStyle(p.value, range, lightTheme, p.rowIndex === totalRowIdx, accentRgb)
            : isDrillableRow
              ? () => ({ cursor: "pointer", color: "var(--accent)" })
              : undefined,
          onCellClicked: isDrillableRow
            ? (p: { value: unknown }) => {
                const val = p.value;
                if (val != null && String(val) !== "") {
                  pivotClickDrill(cd.field, String(val));
                }
              }
            : undefined,
        };
      }),
    [pivotData.colDefs, config.rowFields.length, config.valueFields, heatmap, heatmapRanges, lightTheme, accentRgb, drillableRowFields, pivotClickDrill, totalRowIdx],
  );

  const activeField = activeId?.split("::")[1] ?? null;

  /* ── Row count ─────────────────────────────── */
  const rowCount = pivotData.rows.length;
  const hasData = rowCount > 0;

  /* ── Empty state ───────────────────────────── */
  if (!baseDataset) {
    return (
      <div className="pivot-empty">
        <div className="pivot-empty-inner">
          <Table2 size={48} strokeWidth={1} />
          <h3>No data loaded</h3>
          <p>Load data in the <strong>Data Explorer</strong> tab first to use the pivot table.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pivot-tab">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* ── Toolbar ─────────────────────── */}
        <div className="pivot-toolbar">
          <button
            className="pivot-toolbar__toggle"
            onClick={() => setConfigCollapsed((p) => !p)}
            title={configCollapsed ? "Expand configuration" : "Collapse configuration"}
          >
            {configCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>{configCollapsed ? "Show Fields" : "Hide Fields"}</span>
          </button>

          <div className="pivot-toolbar__actions">
            <label className="pivot-toolbar__check" title="Show grand totals row">
              <input type="checkbox" checked={showTotals} onChange={(e) => setShowTotals(e.target.checked)} />
              Totals
            </label>
            <button
              className={`pivot-toolbar__btn ${heatmap ? "pivot-toolbar__btn--active" : ""}`}
              onClick={() => setHeatmap((p) => !p)}
              title="Toggle heatmap coloring"
            >
              <Thermometer size={13} /> Heatmap
            </button>
            {heatmap && hasData && <HeatmapLegend accentRgb={accentRgb} isLight={lightTheme} />}
            {hasData && (
              <button
                className="pivot-toolbar__btn"
                onClick={() => exportPivotCsv(displayRows, pivotData.colDefs)}
                title="Export to CSV"
              >
                <Download size={13} /> Export
              </button>
            )}
            {hasData && (
              <span className="pivot-toolbar__count">{rowCount.toLocaleString()} rows</span>
            )}
          </div>
        </div>

        {/* ── Breadcrumbs ──────────────── */}
        {(breadcrumbs.length > 0 || pivotDrillFilters.length > 0) && (
          <div className="pivot-breadcrumbs">
            {pivotDrillFilters.length > 0 && (
              <div className="pivot-bc-row">
                <span className="pivot-bc-name">Drilled:</span>
                {pivotDrillFilters.map((df, i) => (
                  <span key={i} className="pivot-bc-filter-chip">
                    {i > 0 && <ChevronRight size={10} className="pivot-bc-sep" />}
                    {alias(df.column)} = {df.value}
                  </span>
                ))}
                <button className="pivot-bc-reset" onClick={resetPivotDrill}>Reset</button>
              </div>
            )}
            {breadcrumbs.map((bc) => (
              <div key={bc.hierarchyName} className="pivot-bc-row">
                <span className="pivot-bc-name">{bc.hierarchyName}:</span>
                {bc.levels.map((lv, i) => (
                  <span key={lv.column} className="pivot-bc-item">
                    {i > 0 && <ChevronRight size={10} className="pivot-bc-sep" />}
                    <button
                      className={`pivot-bc-btn${lv.isCurrent ? " pivot-bc-btn--current" : ""}`}
                      onClick={() => !lv.isCurrent && drillToLevel(lv.column)}
                      disabled={lv.isCurrent}
                    >
                      {lv.label}
                    </button>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Config panel (collapsible) ──── */}
        {!configCollapsed && (
          <div className="pivot-config">
            <div className="pivot-available">
              <div className="pivot-zone__label">Fields</div>
              <div className="pivot-field-search">
                <Search size={12} />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                />
              </div>
              <div className="pivot-available__list">
                {availableFields.map((f) => (
                  <DraggableChip key={f} id={f} label={alias(f)} zone="available" />
                ))}
                {availableFields.length === 0 && (
                  <span className="pivot-zone__hint">
                    {fieldSearch ? "No matching fields" : "All fields assigned"}
                  </span>
                )}
              </div>
            </div>

            <div className="pivot-zones">
              <DropZone
                id="rows"
                label="Rows"
                fields={config.rowFields}
                alias={alias}
                onRemove={(f) => removeFromZone("rows", f)}
              />
              <DropZone
                id="cols"
                label="Columns"
                fields={config.colFields}
                alias={alias}
                onRemove={(f) => removeFromZone("cols", f)}
              />
              <DropZone
                id="values"
                label="Values"
                fields={config.valueFields.map((v) => v.name)}
                alias={alias}
                onRemove={(f) => removeFromZone("values", f)}
                renderExtra={(f) => {
                  const vf = config.valueFields.find((v) => v.name === f);
                  if (!vf) return null;
                  const opts = aggOptionsForField(f);
                  return (
                    <div className="pivot-value-controls">
                      <div className="pivot-agg-select">
                        <select value={vf.agg} onChange={(e) => setAgg(f, e.target.value as AggFunc)}>
                          {opts.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} />
                      </div>
                      <div className="pivot-fmt-select">
                        <select value={vf.fmt} onChange={(e) => setFmt(f, e.target.value as NumFmt)}>
                          {NUM_FMT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} />
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>
        )}

        <DragOverlay>
          {activeField ? (
            <div className="pivot-chip pivot-chip--overlay">
              <GripVertical size={12} />
              <span>{alias(activeField)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Loading / Error / Grid ─────── */}
      {loading ? (
        <div className="pivot-placeholder">
          <Loader2 size={24} className="spin" />
          <p>Running pivot query...</p>
        </div>
      ) : error ? (
        <div className="pivot-placeholder">
          <AlertTriangle size={24} />
          <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>
        </div>
      ) : hasData ? (
        <div className={`pivot-grid ${agThemeClass}`}>
          <AgGridProvider modules={[AllCommunityModule]}>
            <AgGridReact
              ref={gridRef}
              rowData={displayRows}
              columnDefs={agColDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 80,
              }}
              animateRows
              suppressMovableColumns={false}
              enableCellTextSelection
              ensureDomOrder
              getRowStyle={(params) => {
                if (showTotals && params.rowIndex === displayRows.length - 1) {
                  return { fontWeight: "700", borderTop: "2px solid var(--border)" };
                }
                return undefined;
              }}
            />
          </AgGridProvider>
        </div>
      ) : (
        <div className="pivot-placeholder">
          <p>Drag fields into <strong>Rows</strong>, <strong>Columns</strong>, and <strong>Values</strong> to build your pivot table.</p>
        </div>
      )}
    </div>
  );
}
