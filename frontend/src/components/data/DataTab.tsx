import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Filter, Play, Loader2, AlertTriangle, CheckCircle2, TableIcon, Code, ClipboardList,
  ArrowUp, ArrowDown, ArrowUpDown, Columns3, XCircle, Check, Circle, Download,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { runQuery, exportCsv } from "@/lib/api";
import { buildLoadSql, buildCountSql } from "@/lib/sqlBuilder";
import FilterChip from "@/components/filters/FilterChip";
import DateFilterChip from "@/components/filters/DateFilterChip";
import DynamicFilterPanel from "@/components/filters/DynamicFilterPanel";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ColumnPicker from "./ColumnPicker";
import FormulaBuilder from "./FormulaBuilder";
import SelectionSummaryModal from "./SelectionSummaryModal";
import SqlModal from "@/components/ui/SqlModal";
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

const HIDDEN_COLS = new Set(["__row_number__"]);

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

function DataPreview({ showDownload = true }: { showDownload?: boolean }) {
  const { baseDataset, baseDatasetSql, estimatedRowCount } = useStore();
  const colAlias = useColumnAlias();
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    if (!baseDatasetSql) return;
    setExporting(true);
    try {
      await exportCsv(baseDatasetSql, "dataset-export.csv");
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
            <button className="colpick-btn" onClick={handleExport} disabled={exporting || !baseDatasetSql}>
              {exporting ? <><Loader2 size={12} className="spin" /> Exporting…</> : <><Download size={12} /> Export CSV</>}
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
    selectedCatalog, selectedSchema, selectedTable,
    selectedOutputColumns, formulaColumns, sharedFormulas,
    baseDatasetLoading, baseDatasetError, baseDataset,
    setBaseDataset, setBaseDatasetLoading, setBaseDatasetError, setActiveTab,
    activeWorkspace, metadataReady, effectiveRowLimit, setLastQueryMs,
  } = useStore();

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
  const showCustomCols = features.has("custom_columns");

  const [showPreviewSql, setShowPreviewSql] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: "filter-bar-drop",
    data: { type: "filter-bar" },
  });

  const activeCount = filters.filter((f) =>
    f.selectedValues.length > 0 || (f.dateFrom && f.dateTo),
  ).length;
  const dynamicActiveCount = dynamicFilters.filter((d) => d.enabled).length;
  const totalFilterCount = activeCount + dynamicActiveCount;

  const hasUnapplied = (() => {
    if (filters.length !== appliedFilters.length) return true;
    return filters.some((f) => {
      const af = appliedFilters.find((a) => a.id === f.id);
      if (!af) return true;
      return f.selectedValues.length !== af.selectedValues.length ||
        f.selectedValues.some((v, i) => v !== af.selectedValues[i]);
    });
  })();

  const fqTable = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;

  const isMeta = metadataReady();
  const canLoad = fqTable && selectedOutputColumns.length > 0 && isMeta;
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
    const fcs = mergedFormulas(useStore.getState());
    const dynFilters = useStore.getState().dynamicFilters;
    const limit = useStore.getState().effectiveRowLimit();
    const aggs = useStore.getState().activeWorkspace?.column_aggregations;
    const outCols = useStore.getState().selectedOutputColumns;

    clearBaseDataset();
    setBaseDatasetLoading(true);
    setLastQueryMs(null);
    useStore.getState().clearBaseDataset();
    useStore.getState().bumpCollapseVersion();

    const t0 = performance.now();
    let tStep = t0;

    setLoadPhase("counting");

    try {
      const countSql = buildCountSql(fqTable, currentFilters, dynFilters, outCols, aggs);
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
    const fullSql = buildLoadSql(fqTable, selectedOutputColumns, fcs, currentFilters, dynFilters, limit, aggs);
    try {
      const data = await runQuery(fullSql, PREVIEW_ROWS, ac.signal, true);
      setLoadStepTiming("fetching", Math.round(performance.now() - tStep));

      tStep = performance.now();
      setLoadPhase("rendering");
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

  const handleGoToDashboard = () => setActiveTab("dashboard");

  const wsAggs = activeWorkspace?.column_aggregations;
  const previewSql = canLoad
    ? buildLoadSql(fqTable!, selectedOutputColumns, allFormulas, filters, dynamicFilters, rowLimit, wsAggs)
    : null;

  return (
    <div className="data-tab">
      {/* ─── Filters ─── */}
      <div ref={setNodeRef} className={isOver ? "dt-filter-row--hover" : undefined}>
        <CollapsibleSection
          title="Filters"
          icon={<Filter size={14} />}
          badge={totalFilterCount > 0 ? <span className="dt-filter-badge">{totalFilterCount}</span> : undefined}
          collapseKey={collapseVer}
        >
          {filters.length === 0 && dynamicFilters.length === 0 ? (
            <div className="dt-filter-empty">
              <Filter size={20} strokeWidth={1.2} />
              <span>Drag columns here to add filters</span>
            </div>
          ) : (
            <div className="dt-filter-grid">
              {filters.map((f) =>
                f.filterType === "date_range" || f.filterType === "date_relative"
                  ? <DateFilterChip key={f.id} filter={f} />
                  : <FilterChip key={f.id} filter={f} />
              )}
            </div>
          )}
          {dynamicFilters.length > 0 && <DynamicFilterPanel />}
        </CollapsibleSection>
      </div>

      {/* ─── Output Columns + Custom Columns ─── */}
      <CollapsibleSection
        title="Columns"
        icon={<Columns3 size={14} />}
        badge={
          selectedOutputColumns.length > 0
            ? <span className="dt-filter-badge">{selectedOutputColumns.length}</span>
            : undefined
        }
        collapseKey={collapseVer}
      >
        <div className="dt-columns-row">
          <div className="dt-columns-panel">
            <ColumnPicker />
          </div>
          {showCustomCols && (
            <div className="dt-columns-panel">
              <FormulaBuilder />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ─── Action bar ─── */}
      <div className="data-tab-actionbar">
        <div className="data-load-info">
          {selectedOutputColumns.length > 0 && (
            <span className="data-load-cols">{selectedOutputColumns.length} columns</span>
          )}
          {totalFilterCount > 0 && (
            <span className="data-load-cols">{totalFilterCount} filter(s)</span>
          )}
        </div>

        <div className="data-load-actions">
          {(selectedOutputColumns.length > 0 || totalFilterCount > 0) && (
            <button className="colpick-btn" onClick={() => setShowSummary(true)}>
              <ClipboardList size={12} /> Summary
            </button>
          )}
          {previewSql && (
            <button className="colpick-btn" onClick={() => setShowPreviewSql(true)}>
              <Code size={12} /> Preview SQL
            </button>
          )}
          <button
            className={`data-load-btn ${hasUnapplied ? "data-load-btn--pending" : ""}`}
            onClick={handleLoadData}
            disabled={!canLoad || baseDatasetLoading}
          >
            {baseDatasetLoading ? (
              <><Loader2 size={14} className="spin" /> Loading…</>
            ) : (
              <><Play size={14} /> Load Data</>
            )}
          </button>
          {baseDatasetLoading && (
            <button
              className="data-load-btn data-load-btn--cancel"
              onClick={handleCancelLoad}
            >
              <XCircle size={14} /> Cancel
            </button>
          )}

          {baseDataset && (
            <button className="data-load-btn data-load-btn--go" onClick={handleGoToDashboard}>
              <CheckCircle2 size={14} /> Go to Dashboard
            </button>
          )}
        </div>

        {baseDatasetError && (
          <div className="data-load-error">
            <AlertTriangle size={14} /> {baseDatasetError}
          </div>
        )}
      </div>

      {/* ─── Loading Progress ─── */}
      {baseDatasetLoading && loadPhase !== "idle" && (
        <LoadStepper phase={loadPhase} timings={stepTimings} />
      )}

      {/* ─── Data Preview ─── */}
      {!baseDatasetLoading && baseDataset && (
        <CollapsibleSection
          title="Data Preview"
          icon={<TableIcon size={14} />}
          badge={<span className="dt-filter-badge">{baseDataset.rows.length} rows</span>}
        >
          <DataPreview showDownload={showDownload} />
        </CollapsibleSection>
      )}

      {showPreviewSql && previewSql && (
        <SqlModal sql={previewSql} onClose={() => setShowPreviewSql(false)} />
      )}
      {showSummary && (
        <SelectionSummaryModal onClose={() => setShowSummary(false)} />
      )}
    </div>
  );
}
