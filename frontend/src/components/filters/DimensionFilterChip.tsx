import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Filter, Check, Search, X, AlertCircle, ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { useStore } from "@/hooks/useStore";
import { useCascadeRefresh } from "@/hooks/useCascadeRefresh";
import { runQuery } from "@/lib/api";
import { usePopover } from "./usePopover";
import FilterChipShell from "./FilterChipShell";
import type { DimensionSource, FilterSortOrder } from "@/types/dashboard";

interface Props {
  filterId: string;
  source: DimensionSource;
  onRemove?: () => void;
}

export default function DimensionFilterChip({ filterId, source, onRemove }: Props) {
  const {
    dimensionFilters, setDimensionFilterValues,
    setDimensionFilterSelection, dimensionDisplayMaps,
    cascadeVersion,
  } = useStore();
  const triggerCascade = useCascadeRefresh();

  const filter = dimensionFilters.find((f) => f.id === filterId);
  const displayMap = dimensionDisplayMaps[filterId] ?? {};
  const { open, setOpen, chipRef, popoverRef, getPosition, portalTarget } = usePopover();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [localSelection, setLocalSelection] = useState<string[]>(filter?.selectedValues ?? []);
  const fetchedRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!filter || filter.values.length > 0 || fetchedRef.current) return;
    fetchedRef.current = true;
    loadValues();
  }, [filter?.id]);

  const sortValues = (vals: string[], order?: string): string[] => {
    if (order === "custom") return vals;
    const sorted = [...vals].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return order === "desc" ? sorted.reverse() : sorted;
  };

  const loadValues = useCallback(async () => {
    if (!filter) return;
    setLoading(true);
    setError(null);
    const order = source.sortOrder ?? "asc";

    try {
      if (source.sourceType === "static") {
        const values = (source.staticValues ?? []).map((sv) => sv.value).filter(Boolean);
        const dmap: Record<string, string> = {};
        for (const sv of source.staticValues ?? []) {
          if (sv.display && sv.display !== sv.value) dmap[sv.value] = sv.display;
        }
        setDimensionFilterValues(filterId, sortValues(values, order), Object.keys(dmap).length > 0 ? dmap : undefined);
      } else if (source.sourceType === "query" && source.query) {
        const result = await runQuery(source.query, 1000);
        const valCol = source.valueColumn || result.columns[0];
        const dispCol = source.displayColumn || "";
        const valIdx = result.columns.indexOf(valCol);
        const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
        if (valIdx === -1) throw new Error(`Value column "${valCol}" not found in query results`);
        const values: string[] = [];
        const dmap: Record<string, string> = {};
        for (const row of result.rows) {
          const v = String(row[valIdx] ?? "");
          if (!v) continue;
          values.push(v);
          if (dispIdx >= 0) {
            const d = String(row[dispIdx] ?? "");
            if (d && d !== v) dmap[v] = d;
          }
        }
        setDimensionFilterValues(filterId, sortValues(values, order), Object.keys(dmap).length > 0 ? dmap : undefined);
      } else if (source.sourceType === "table" && source.tableName) {
        const cat = source.tableCatalog || "";
        const sch = source.tableSchema || "";
        const tbl = source.tableName;
        const fqTable = cat && sch ? `\`${cat}\`.\`${sch}\`.\`${tbl}\`` : tbl;
        const valCol = source.valueColumn || source.column;
        const dispCol = source.displayColumn || "";
        const selectCols = dispCol && dispCol !== valCol
          ? `\`${valCol}\`, \`${dispCol}\``
          : `\`${valCol}\``;
        const sqlOrder = order === "desc" ? "DESC" : "ASC";
        const sql = `SELECT DISTINCT ${selectCols} FROM ${fqTable} WHERE \`${valCol}\` IS NOT NULL ORDER BY \`${valCol}\` ${sqlOrder} LIMIT 1000`;
        const result = await runQuery(sql, 1000);
        const valIdx = result.columns.indexOf(valCol);
        const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
        const values: string[] = [];
        const dmap: Record<string, string> = {};
        for (const row of result.rows) {
          const v = String(row[valIdx >= 0 ? valIdx : 0] ?? "");
          if (!v) continue;
          values.push(v);
          if (dispIdx >= 0) {
            const d = String(row[dispIdx] ?? "");
            if (d && d !== v) dmap[v] = d;
          }
        }
        setDimensionFilterValues(filterId, values, Object.keys(dmap).length > 0 ? dmap : undefined);
      } else if (source.sourceType === "formula") {
        const fvs = source.formulaValues ?? [];
        if (fvs.length > 0 && fvs.some((fv) => fv.value)) {
          const values = fvs.map((fv) => fv.value).filter(Boolean);
          const dmap: Record<string, string> = {};
          for (const fv of fvs) {
            if (fv.display && fv.display !== fv.value) dmap[fv.value] = fv.display;
          }
          setDimensionFilterValues(filterId, sortValues(values, order), Object.keys(dmap).length > 0 ? dmap : undefined);
        } else if (source.formula && filter.table) {
          const sql = `SELECT DISTINCT (${source.formula}) AS _fv FROM ${filter.table} WHERE (${source.formula}) IS NOT NULL ORDER BY 1 LIMIT 1000`;
          const result = await runQuery(sql, 1000);
          const values = result.rows.map((r) => String(r[0] ?? "")).filter(Boolean);
          setDimensionFilterValues(filterId, sortValues(values, order));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dimension values");
    } finally {
      setLoading(false);
    }
  }, [filterId, source, filter, setDimensionFilterValues]);

  useEffect(() => {
    if (open) {
      setLocalSelection(filter?.selectedValues ?? []);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, filter?.selectedValues]);

  const isForcedSingle = source.forceSingleSelect === true;

  const toggleValue = useCallback((val: string) => {
    if (isForcedSingle) {
      setLocalSelection((prev) => prev[0] === val ? [] : [val]);
    } else {
      setLocalSelection((prev) =>
        prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
      );
    }
  }, [isForcedSingle]);

  const handleDone = () => {
    setDimensionFilterSelection(filterId, localSelection);
    setOpen(false);
    triggerCascade(filterId, localSelection);
  };

  const [runtimeSort, setRuntimeSort] = useState<FilterSortOrder>(source.sortOrder ?? "asc");

  if (!filter) return null;

  const displayVal = (v: string) => displayMap[v] || v;

  const sortedValues = (() => {
    if (runtimeSort === "custom") return filter.values;
    const vals = [...filter.values];
    vals.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return runtimeSort === "desc" ? vals.reverse() : vals;
  })();

  const filtered = search
    ? sortedValues.filter((v) => {
        const q = search.toLowerCase();
        return v.toLowerCase().includes(q) || displayVal(v).toLowerCase().includes(q);
      })
    : sortedValues;

  const cycleDimSort = () => {
    setRuntimeSort((prev) => prev === "asc" ? "desc" : "asc");
  };

  const selectionLabel =
    filter.selectedValues.length === 0
      ? "All"
      : filter.selectedValues.length === 1
        ? displayVal(filter.selectedValues[0])
        : `${filter.selectedValues.length} selected`;

  const isRequired = source.required;
  const isMissing = isRequired && filter.selectedValues.length === 0;

  return (
    <div className={`dim-filter-wrap${isRequired ? " dim-filter-wrap--required" : ""}${isMissing ? " dim-filter-wrap--missing" : ""}${onRemove ? " dim-filter-wrap--removable" : ""}`}>
      <FilterChipShell
        ref={chipRef}
        icon={Filter}
        name={source.label || source.column}
        label={selectionLabel}
        open={open}
        variant="text"
        isActive={filter.selectedValues.length > 0}
        secondaryLabel={isForcedSingle ? undefined : `${filter.selectedValues.length} of ${filter.values.length || "..."}`}
        onToggle={() => setOpen((v) => !v)}
        onRemove={onRemove ?? (() => {})}
      >
      {open && createPortal(
        <div className="flt-popover-portal" style={getPosition()} ref={popoverRef}>
          <div className="flt-popover">
            <div className="flt-popover-header">
              <span className="flt-popover-title">
                <Filter size={14} /> {source.label || source.column}
                {source.required && <span className="dim-chip-required">Required</span>}
              </span>
              <div className="flt-popover-mode">
                <button
                  className="flt-popover-sort-btn"
                  onClick={cycleDimSort}
                  title={`Sort: ${runtimeSort === "asc" ? "A → Z" : "Z → A"}`}
                >
                  {runtimeSort === "asc" ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
                </button>
                <span className="dim-chip-source-badge">{source.sourceType}</span>
                {isForcedSingle && <span className="flt-popover-mode-locked" title="Admin restricted to single select">Single only</span>}
              </div>
            </div>

            <div className="flt-popover-search">
              <Search size={13} />
              <input
                ref={searchRef}
                className="flt-popover-search-input"
                placeholder="Search values..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                  onClick={() => setSearch("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {!isForcedSingle && !loading && !error && filtered.length > 0 && (
              <div className="flt-popover-bulk">
                <button
                  className="flt-popover-bulk-btn"
                  onClick={() => setLocalSelection([...new Set([...localSelection, ...filtered])])}
                >
                  Select all{search ? ` (${filtered.length})` : ""}
                </button>
                <span className="flt-popover-bulk-sep">|</span>
                <button
                  className="flt-popover-bulk-btn"
                  onClick={() => {
                    const remove = new Set(filtered);
                    setLocalSelection(localSelection.filter((v) => !remove.has(v)));
                  }}
                >
                  Deselect all
                </button>
              </div>
            )}

            {loading ? (
              <div className="flt-popover-loading">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonLine key={i} width={`${50 + Math.random() * 40}%`} height={20} />
                ))}
              </div>
            ) : error ? (
              <div className="flt-popover-error">
                <AlertCircle size={14} />
                <p>{error}</p>
                <button
                  className="run-btn"
                  onClick={() => { fetchedRef.current = false; setError(null); loadValues(); }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flt-popover-list">
                {filtered.length === 0 && (
                  <div className="flt-popover-empty">
                    {search ? "No matching values" : "No values available"}
                  </div>
                )}
                {filtered.map((val) => {
                  const selected = localSelection.includes(val);
                  const display = displayVal(val);
                  return (
                    <button
                      key={val}
                      className={`flt-popover-option${selected ? " flt-popover-option--selected" : ""}`}
                      onClick={() => toggleValue(val)}
                    >
                      <span className="flt-popover-option-text">
                        {display}
                        {display !== val && (
                          <span className="dim-chip-val-code">{val}</span>
                        )}
                      </span>
                      {selected && <Check size={12} className="flt-popover-option-tick" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flt-popover-footer">
              <span className="flt-popover-count">
                <strong>{localSelection.length}</strong> of {filter.values.length} selected
              </span>
              <div className="flt-popover-actions">
                <button className="flt-popover-btn" onClick={() => setLocalSelection([])}>Clear</button>
                <button className="flt-popover-btn flt-popover-btn--done" onClick={handleDone}>Done</button>
              </div>
            </div>
          </div>
        </div>,
        portalTarget,
      )}
      </FilterChipShell>
    </div>
  );
}
