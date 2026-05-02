import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Filter, Play, Loader2, AlertTriangle, TableIcon, Code, ClipboardList,
  ArrowUp, ArrowDown, ArrowUpDown, Columns3, XCircle, Check, Circle, Download, FileSpreadsheet,
  Plus, Sigma, Hash, Type, Pencil,
} from "lucide-react";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { runQuery, exportCsv, exportExcel } from "@/lib/api";
import { buildLoadSql, buildCountSql, type SmartJoinContext } from "@/lib/sqlBuilder";
import { toast } from "@/components/ui/Toast";
import BaseFilterBanner from "@/components/filters/BaseFilterBanner";
import FilterChip from "@/components/filters/FilterChip";
import DateFilterChip from "@/components/filters/DateFilterChip";
import NumericFilterChip from "@/components/filters/NumericFilterChip";
import FreeTextFilterChip from "@/components/filters/FreeTextFilterChip";
import SearchSelectChip from "@/components/filters/SearchSelectChip";
import DimensionFilterChip from "@/components/filters/DimensionFilterChip";
import DynamicFilterPanel from "@/components/filters/DynamicFilterPanel";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ColumnSelectorModal from "./ColumnSelectorModal";
import FormulaBuilder from "./FormulaBuilder";
import SelectionSummaryModal from "./SelectionSummaryModal";
import SqlModal from "@/components/ui/SqlModal";
import { applyClientJoin } from "@/lib/clientJoin";
import { NUMERIC_RE } from "@/lib/constants";
import type { SelfServiceFeature } from "@/types/dashboard";

type LoadPhase = "idle" | "counting" | "fetching" | "rendering";

const PHASE_LABELS: Record<Exclude<LoadPhase, "idle">, string> = {
  counting: "Checking row count",
  fetching: "Fetching data",
  rendering: "Rendering results",
};

const PHASE_ORDER: Exclude<LoadPhase, "idle">[] = ["counting", "fetching", "rendering"];

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function LoadStepper({ phase, timings }: { phase: LoadPhase; timings: Record<string, number> }) {
  const rowCount = useStore((s) => s.estimatedRowCount);
  return (
    <div className="load-stepper">
      {PHASE_ORDER.map((p) => {
        const done = timings[p] != null;
        const active = phase === p;
        return (
          <div key={p} className={`load-step ${done ? "load-step--done" : active ? "load-step--active" : "load-step--pending"}`}>
            <span className="load-step-icon">
              {done ? <Check size={14} /> : active ? <Loader2 size={14} className="spin" /> : <Circle size={14} />}
            </span>
            <span className="load-step-label">{PHASE_LABELS[p]}</span>
            {done && p === "counting" && rowCount != null && (
              <span className="load-step-rows">{rowCount.toLocaleString()} rows</span>
            )}
            {done && <span className="load-step-time">{fmtMs(timings[p])}</span>}
            {active && <span className="load-step-time load-step-time--active">in progress…</span>}
          </div>
        );
      })}
    </div>
  );
}

const HIDDEN_COLS = new Set(["__row_number__", "__row_count__"]);

function stripInternalCols(data: { columns: string[]; rows: unknown[][] }): { columns: string[]; rows: unknown[][] } {
  const keepIdx = data.columns
    .map((c, i) => (HIDDEN_COLS.has(c) ? -1 : i))
    .filter((i) => i >= 0);
  return {
    columns: keepIdx.map((i) => data.columns[i]),
    rows: data.rows.map((r) => keepIdx.map((i) => r[i])),
  };
}

type SortDir = "asc" | "desc" | null;

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

function DataPreview({ showDownload = true, showExcel = false }: { showDownload?: boolean; showExcel?: boolean }) {
  const { baseDataset, baseDatasetSql, estimatedRowCount } = useStore();
  const colAlias = useColumnAlias();
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");

  const display = useMemo(
    () => (baseDataset ? stripInternalCols(baseDataset) : null),
    [baseDataset],
  );

  const sortedRows = useMemo(() => {
    if (!display) return [];
    if (sortCol == null || !sortDir) return display.rows;
    return [...display.rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const na = typeof va === "number" ? va : Number(va);
      const nb = typeof vb === "number" ? vb : Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return sortDir === "asc" ? -1 : 1;
      if (sa > sb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [display, sortCol, sortDir]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortCol(null);
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  if (!display) return null;

  const handleExport = async (fmt: "csv" | "xlsx" = "csv") => {
    if (!baseDatasetSql) return;
    setExporting(true);
    setExportFormat(fmt);
    try {
      if (fmt === "xlsx") {
        await exportExcel(baseDatasetSql, "dataset-export.xlsx");
      } else {
        await exportCsv(baseDatasetSql, "dataset-export.csv");
      }
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const totalRows = estimatedRowCount ?? display.rows.length;

  return (
    <div className="data-preview">
      <div className="data-preview-header">
        <span className="data-preview-title">
          <TableIcon size={14} />
          Data Preview
          <span className="data-preview-badge">{display.rows.length} of {totalRows.toLocaleString()} rows x {display.columns.length} cols</span>
        </span>
        <div className="data-preview-actions">
          {showDownload && (
            <button className="colpick-btn" onClick={() => handleExport("csv")} disabled={exporting || !baseDatasetSql} title="Export CSV (Ctrl+E)">
              {exporting && exportFormat === "csv" ? <><Loader2 size={12} className="spin" /> Exporting…</> : <><Download size={12} /> CSV</>}
            </button>
          )}
          {showExcel && (
            <button className="colpick-btn" onClick={() => handleExport("xlsx")} disabled={exporting || !baseDatasetSql} title="Export Excel (.xlsx)">
              {exporting && exportFormat === "xlsx" ? <><Loader2 size={12} className="spin" /> Exporting…</> : <><FileSpreadsheet size={12} /> Excel</>}
            </button>
          )}
        </div>
      </div>

      <div className="data-preview-table-wrap">
        <table className="widget-table widget-table--sortable">
          <thead>
            <tr>
              {display.columns.map((c, i) => (
                <th key={c} className="th-sortable" onClick={() => handleSort(i)} title={c}>
                  <span className="th-label">{colAlias(c)}</span>
                  <span className="th-sort-icon">
                    {sortCol === i && sortDir === "asc" ? <ArrowUp size={11} /> :
                     sortCol === i && sortDir === "desc" ? <ArrowDown size={11} /> :
                     <ArrowUpDown size={11} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={typeof cell === "number" ? "td-number" : ""}>{formatCell(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {totalRows > display.rows.length && (
          <p className="table-truncated">
            Showing {display.rows.length} of {totalRows.toLocaleString()} rows
            (charts use server-side aggregation · export downloads all rows)
          </p>
        )}
      </div>

    </div>
  );
}

function mergedFormulas(store: ReturnType<typeof useStore.getState>) {
  const { formulaColumns, sharedFormulas } = store;
  const sfAsFc = sharedFormulas.map((sf) => ({
    id: sf.id,
    alias: sf.alias,
    expression: sf.expression,
    dataType: sf.data_type,
  }));
  return [...formulaColumns, ...sfAsFc];
}

export default function DataTab() {
  const {
    filters, appliedFilters, applyFilters, dynamicFilters,
    selectedCatalog, selectedSchema, selectedTable, columns,
    selectedOutputColumns, formulaColumns, sharedFormulas,
    baseDatasetLoading, baseDatasetError, baseDataset,
    setBaseDataset, setBaseDatasetLoading, setBaseDatasetError,
    activeWorkspace, metadataReady, effectiveRowLimit, setLastQueryMs,
    dimensionFilters, dimensionSources, initDimensionFilters,
    activatedOptionalDimIds, deactivateOptionalDim,
  } = useStore();

  const colAlias = useColumnAlias();

  useEffect(() => {
    if (!activeWorkspace) return;
    initDimensionFilters();
  }, [activeWorkspace, initDimensionFilters]);

  const allFormulas = useMemo(() => {
    const sfAsFc = sharedFormulas.map((sf) => ({
      id: sf.id, alias: sf.alias, expression: sf.expression, dataType: sf.data_type,
    }));
    return [...formulaColumns, ...sfAsFc];
  }, [formulaColumns, sharedFormulas]);

  const features = useMemo<Set<SelfServiceFeature>>(() => {
    const raw = activeWorkspace?.features ?? ["download_data", "custom_columns"];
    return new Set(raw as SelfServiceFeature[]);
  }, [activeWorkspace]);

  const showDownload = features.has("download_data");
  const showExcel = features.has("export_excel");
  const showCustomCols = features.has("custom_columns");

  const [showPreviewSql, setShowPreviewSql] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  const [formulaPanelOpen, setFormulaPanelOpen] = useState(false);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: "filter-bar-drop",
    data: { type: "filter-bar" },
  });

  const activeCount = filters.filter((f) =>
    f.selectedValues.length > 0 || (f.dateFrom && f.dateTo) || (f.freeTextValues && f.freeTextValues.length > 0),
  ).length;
  const dynamicActiveCount = dynamicFilters.filter((d) => d.enabled).length;
  const dimActiveCount = dimensionFilters.filter((f) => f.selectedValues.length > 0).length;
  const totalFilterCount = activeCount + dynamicActiveCount + dimActiveCount;

  const requiredDimsMissing = dimensionSources.some((ds) => {
    if (!ds.required) return false;
    const df = dimensionFilters.find((f) => f.id === `dim-${ds.id}`);
    return !df || df.selectedValues.length === 0;
  });

  const hasUnapplied = (() => {
    if (filters.length !== appliedFilters.length) return true;
    return filters.some((f) => {
      const af = appliedFilters.find((a) => a.id === f.id);
      if (!af) return true;
      return f.selectedValues.length !== af.selectedValues.length ||
        f.selectedValues.some((v, i) => v !== af.selectedValues[i]);
    });
  })();

  const effectiveTableRef = useStore((s) => s.effectiveTableRef);
  const fqTable = effectiveTableRef();

  const columnTableMap = useStore((s) => s.columnTableMap);
  const wsJoins = activeWorkspace?.joins ?? [];
  const joinCtx: SmartJoinContext | undefined = useMemo(() => {
    if (!selectedCatalog || !selectedSchema || wsJoins.length === 0) return undefined;
    return {
      joins: wsJoins,
      columnTableMap,
      catalog: selectedCatalog,
      schema: selectedSchema,
    };
  }, [wsJoins, columnTableMap, selectedCatalog, selectedSchema]);

  const isMeta = metadataReady();
  const canLoad = fqTable && selectedOutputColumns.length > 0 && isMeta && !requiredDimsMissing;
  const rowLimit = effectiveRowLimit();

  const loadPhase = useStore((s) => s.loadPhase);
  const setLoadPhase = useStore((s) => s.setLoadPhase);
  const stepTimings = useStore((s) => s.loadStepTimings);
  const setLoadStepTiming = useStore((s) => s.setLoadStepTiming);
  const collapseVer = useStore((s) => s.collapseVersion);
  const abortRef = useRef<AbortController | null>(null);
  const clearBaseDataset = useStore((s) => s.clearBaseDataset);

  const handleCancelLoad = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBaseDatasetLoading(false);
    setLoadPhase("idle");
  }, [setBaseDatasetLoading]);

  const PREVIEW_ROWS = 50;

  const handleLoadData = useCallback(async () => {
    if (!fqTable) return;
    applyFilters();

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const currentFilters = useStore.getState().filters;
    const dimFilters = useStore.getState().dimensionFilters;
    const allFilters = [...currentFilters, ...dimFilters.filter((f) => f.selectedValues.length > 0)];
    const fcs = mergedFormulas(useStore.getState());
    const dynFilters = useStore.getState().dynamicFilters;
    const limit = useStore.getState().effectiveRowLimit();
    const aggs = useStore.getState().resolvedAggregations();
    const outCols = useStore.getState().selectedOutputColumns;

    clearBaseDataset();
    setBaseDatasetLoading(true);
    setLastQueryMs(null);
    useStore.getState().clearBaseDataset();
    useStore.getState().bumpCollapseVersion();

    const t0 = performance.now();
    let tStep = t0;

    setLoadPhase("counting");

    const jCtx: SmartJoinContext | undefined = useStore.getState().activeWorkspace?.joins?.length
      ? { joins: useStore.getState().activeWorkspace!.joins!, columnTableMap: useStore.getState().columnTableMap, catalog: useStore.getState().selectedCatalog!, schema: useStore.getState().selectedSchema! }
      : undefined;

    try {
      const bfArr = useStore.getState().activeWorkspace?.datasource?.base_filters;
      const countSql = buildCountSql(fqTable, allFilters, dynFilters, outCols, aggs, jCtx, bfArr);
      const countResult = await runQuery(countSql, undefined, ac.signal, true);
      const rowCount = Number(countResult.rows?.[0]?.[0] ?? 0);
      setLoadStepTiming("counting", Math.round(performance.now() - tStep));
      useStore.getState().setEstimatedRowCount(rowCount);

      if (limit > 0 && rowCount > limit) {
        setBaseDatasetError(
          `Query would return ${rowCount.toLocaleString()} rows, which exceeds the limit of ${limit.toLocaleString()}. Please refine your filters to reduce the result set.`,
        );
        setBaseDatasetLoading(false);
        setLoadPhase("idle");
        return;
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      setBaseDatasetError(err instanceof Error ? err.message : "Row count check failed");
      setBaseDatasetLoading(false);
      setLoadPhase("idle");
      return;
    }

    tStep = performance.now();
    setLoadPhase("fetching");
    const bfArr2 = useStore.getState().activeWorkspace?.datasource?.base_filters;
    const fullSql = buildLoadSql(fqTable, selectedOutputColumns, fcs, allFilters, dynFilters, limit, aggs, jCtx, bfArr2);
    try {
      let data = await runQuery(fullSql, PREVIEW_ROWS, ac.signal, true);
      setLoadStepTiming("fetching", Math.round(performance.now() - tStep));

      tStep = performance.now();
      setLoadPhase("rendering");

      const upload = useStore.getState().uploadedDataset;
      if (upload?.joinConfig?.uploadKeyColumn && upload?.joinConfig?.primaryKeyColumn) {
        data = applyClientJoin(data, upload);
      }

      setBaseDataset(data, fullSql);
      setLastQueryMs(Math.round(performance.now() - t0));

      requestAnimationFrame(() => {
        setLoadStepTiming("rendering", Math.round(performance.now() - tStep));
        setLoadPhase("idle");
        useStore.getState().bumpCollapseVersion();
      });
      return;
    } catch (err) {
      if (ac.signal.aborted) return;
      setBaseDatasetError(err instanceof Error ? err.message : "Query failed");
    }
    setLoadPhase("idle");
  }, [fqTable, selectedOutputColumns, formulaColumns, dynamicFilters, applyFilters, setBaseDataset, setBaseDatasetLoading, setBaseDatasetError, clearBaseDataset]);

  const registerShortcut = useStore((s) => s.registerShortcut);
  const baseDatasetSqlForExport = useStore((s) => s.baseDatasetSql);

  useEffect(() => {
    registerShortcut("load-data", canLoad ? handleLoadData : undefined);
    return () => { registerShortcut("load-data", undefined); };
  }, [canLoad, handleLoadData, registerShortcut]);

  const handleExportShortcut = useCallback(async () => {
    if (!baseDatasetSqlForExport) return;
    try {
      await exportCsv(baseDatasetSqlForExport, "dataset-export.csv");
    } catch { toast.error("Export failed"); }
  }, [baseDatasetSqlForExport]);

  useEffect(() => {
    registerShortcut("export", baseDatasetSqlForExport ? handleExportShortcut : undefined);
    return () => { registerShortcut("export", undefined); };
  }, [baseDatasetSqlForExport, handleExportShortcut, registerShortcut]);

  const wsAggs = useStore.getState().resolvedAggregations();
  const allPreviewFilters = [...filters, ...dimensionFilters.filter((f) => f.selectedValues.length > 0)];
  const wsBf = useStore.getState().activeWorkspace?.datasource?.base_filters;
  const previewSql = canLoad
    ? buildLoadSql(fqTable!, selectedOutputColumns, allFormulas, allPreviewFilters, dynamicFilters, rowLimit, wsAggs, joinCtx, wsBf)
    : null;

  const requiredDimSources = dimensionSources.filter((ds) => ds.required);
  const activatedOptionalDimSources = dimensionSources.filter(
    (ds) => !ds.required && activatedOptionalDimIds.includes(ds.id),
  );
  const visibleDimSources = [...requiredDimSources, ...activatedOptionalDimSources];

  /* ── Compact columns row calculations ── */
  const isCustomQuery = activeWorkspace?.datasource?.source_mode === "query";
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null);
  const allCols = useMemo(() => (colKey ? columns[colKey] ?? [] : []), [colKey, columns]);
  const colMap = useMemo(() => new Map(allCols.map((c) => [c.col_name, c])), [allCols]);

  const dimCount = selectedOutputColumns.filter((n) => {
    const m = colMap.get(n);
    return m && !NUMERIC_RE.test(m.data_type);
  }).length;
  const measCount = selectedOutputColumns.filter((n) => {
    const m = colMap.get(n);
    return m && NUMERIC_RE.test(m.data_type);
  }).length;
  const formulaCount = formulaColumns.length + sharedFormulas.length;

  const colTooltipLines = selectedOutputColumns
    .filter((n) => !n.startsWith("__fc__") && !n.startsWith("__sf__"))
    .slice(0, 15)
    .map((n) => colAlias(n));
  if (selectedOutputColumns.filter((n) => !n.startsWith("__fc__") && !n.startsWith("__sf__")).length > 15) {
    colTooltipLines.push(`+${selectedOutputColumns.filter((n) => !n.startsWith("__fc__") && !n.startsWith("__sf__")).length - 15} more…`);
  }
  const colTooltip = colTooltipLines.join("\n");

  return (
    <div className="data-tab">
      {/* ─── Filters ─── */}
      <div ref={setNodeRef} className={isOver ? "dt-filter-row--hover" : undefined}>
        <CollapsibleSection
          title="Filters"
          icon={<Filter size={14} />}
          badge={totalFilterCount > 0 ? <span className="dt-filter-badge">{totalFilterCount}</span> : undefined}
          collapseKey={collapseVer}
          actions={
            <button
              className="dt-header-action-btn"
              onClick={() => setAddFilterModalOpen(true)}
              title="Add Your Own Filter"
            >
              <Plus size={11} /> Add Your Own Filter
            </button>
          }
        >
          <BaseFilterBanner />
          {requiredDimsMissing && (
            <div className="dt-dim-required-banner">
              <AlertTriangle size={13} />
              <span>These filters are added through the configuration of the workspace template. You need to select values for these filters before loading data.</span>
            </div>
          )}
          {filters.length === 0 && dynamicFilters.length === 0 && visibleDimSources.length === 0 ? (
            <div className="dt-filter-empty">
              <Filter size={20} strokeWidth={1.2} />
              <span>Drag columns here to add filters</span>
            </div>
          ) : (
            <div className="dt-filter-grid">
              {visibleDimSources.map((ds) => (
                <DimensionFilterChip
                  key={ds.id}
                  filterId={`dim-${ds.id}`}
                  source={ds}
                  onRemove={ds.required ? undefined : () => deactivateOptionalDim(ds.id)}
                />
              ))}
              {filters.map((f) =>
                f.filterType === "date_range" || f.filterType === "date_relative"
                  ? <DateFilterChip key={f.id} filter={f} />
                  : f.filterType === "numeric_range"
                    ? <NumericFilterChip key={f.id} filter={f} />
                    : f.filterType === "free_text"
                      ? <FreeTextFilterChip key={f.id} filter={f} />
                      : f.filterType === "search_select"
                        ? <SearchSelectChip key={f.id} filter={f} />
                        : <FilterChip key={f.id} filter={f} />
              )}
            </div>
          )}
          <DynamicFilterPanel
            hideAddButton
            externalModalOpen={addFilterModalOpen}
            onExternalModalClose={() => setAddFilterModalOpen(false)}
          />
        </CollapsibleSection>
      </div>

      {/* ─── Compact Columns + Calculated Fields + Actions ─── */}
      <div className="dt-compact-bar">
        <div className="dt-compact-left">
          <button
            className="dt-compact-segment"
            onClick={() => setColSelectorOpen(true)}
            title={colTooltip}
          >
            <Columns3 size={13} />
            <span className="dt-compact-label">
              {selectedOutputColumns.length > 0 ? (
                <>
                  <strong>{selectedOutputColumns.length}</strong> output columns selected
                  {dimCount > 0 && <span className="dt-compact-dim"><Type size={9} /> {dimCount}d</span>}
                  {measCount > 0 && <span className="dt-compact-meas"><Hash size={9} /> {measCount}m</span>}
                </>
              ) : (
                <span className="dt-compact-placeholder">0 output columns — click to select</span>
              )}
            </span>
            <Pencil size={10} className="dt-compact-edit" />
          </button>

          {showCustomCols && (
            <>
              <span className="dt-compact-sep">•</span>
              <button
                className="dt-compact-segment"
                onClick={() => setFormulaPanelOpen(true)}
              >
                <Sigma size={13} />
                <span className="dt-compact-label">
                  <strong>{formulaCount}</strong> calculated
                </span>
                <Pencil size={10} className="dt-compact-edit" />
              </button>
            </>
          )}
        </div>

        <div className="dt-compact-right">
          {(selectedOutputColumns.length > 0 || totalFilterCount > 0) && (
            <button
              className="dt-compact-icon-btn"
              onClick={() => setShowSummary(true)}
              title="Selection Summary"
            >
              <ClipboardList size={13} />
            </button>
          )}
          {previewSql && (
            <button
              className="dt-compact-icon-btn"
              onClick={() => setShowPreviewSql(true)}
              title="Preview SQL"
            >
              <Code size={13} />
            </button>
          )}

          {baseDatasetLoading ? (
            <>
              <button
                className="dt-compact-load-btn dt-compact-load-btn--loading"
                disabled
              >
                <Loader2 size={13} className="spin" /> Loading…
              </button>
              <button
                className="dt-compact-icon-btn dt-compact-icon-btn--danger"
                onClick={handleCancelLoad}
                title="Cancel"
              >
                <XCircle size={13} />
              </button>
            </>
          ) : (
            <button
              className={`dt-compact-load-btn ${hasUnapplied ? "dt-compact-load-btn--pending" : ""}`}
              onClick={handleLoadData}
              disabled={!canLoad}
              title="Load Data (Ctrl+Enter)"
            >
              <Play size={12} /> Load Data
            </button>
          )}
        </div>
      </div>

      {baseDatasetError && (
        <div className="data-load-error">
          <AlertTriangle size={14} /> {baseDatasetError}
        </div>
      )}

      {/* ─── Loading Progress ─── */}
      {baseDatasetLoading && loadPhase !== "idle" && (
        <>
          <LoadStepper phase={loadPhase} timings={stepTimings} />
          <SkeletonTable rows={8} cols={Math.min(selectedOutputColumns.length || 5, 6)} />
        </>
      )}

      {/* ─── Data Preview ─── */}
      {!baseDatasetLoading && baseDataset && (
        <CollapsibleSection
          title="Data Preview"
          icon={<TableIcon size={14} />}
          badge={<span className="dt-filter-badge">{baseDataset.rows.length} rows</span>}
        >
          <DataPreview showDownload={showDownload} showExcel={showExcel} />
        </CollapsibleSection>
      )}

      {showPreviewSql && previewSql && (
        <SqlModal sql={previewSql} onClose={() => setShowPreviewSql(false)} />
      )}
      {showSummary && (
        <SelectionSummaryModal onClose={() => setShowSummary(false)} />
      )}
      {colSelectorOpen && (
        <ColumnSelectorModal onClose={() => setColSelectorOpen(false)} />
      )}
      {formulaPanelOpen && (
        <FormulaBuilder externalOpen onExternalClose={() => setFormulaPanelOpen(false)} />
      )}
    </div>
  );
}
