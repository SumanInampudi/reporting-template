import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ListFilter, Check, Search, X, Calendar, ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { useCascadeRefresh } from "@/hooks/useCascadeRefresh";
import { runQuery } from "@/lib/api";
import { buildBaseFilterClauses, quoteTableRef } from "@/lib/sqlBuilder";
import { usePopover } from "./usePopover";
import FilterChipShell from "./FilterChipShell";
import type { FilterItem, FilterSortOrder } from "@/types/dashboard";

interface Props {
  filter: FilterItem;
}

export default function FilterChip({ filter }: Props) {
  const { removeFilter, updateFilterMode, updateFilterType, setFilterValues, setFilterSelection, setFilterSortOrder } = useStore();
  const triggerCascade = useCascadeRefresh();
  const alias = useColumnAlias();
  const columnLabel = alias(filter.column);
  const isDateColumn = /date|timestamp/i.test(filter.dataType);
  const { open, setOpen, chipRef, popoverRef, getPosition, portalTarget } = usePopover();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localSelection, setLocalSelection] = useState<string[]>(filter.selectedValues);
  const fetchedRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (filter.values.length > 0 || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);

    const effectiveTbl = useStore.getState().effectiveTableRef() ?? filter.table;
    const quotedTable = quoteTableRef(effectiveTbl);
    const quotedCol = `\`${filter.column}\``;

    const bf = useStore.getState().activeWorkspace?.datasource?.base_filters;
    const bfParts = buildBaseFilterClauses(bf);
    const bfWhere = bfParts.length > 0 ? ` AND ${bfParts.join(" AND ")}` : "";
    const sql = `SELECT DISTINCT ${quotedCol} FROM ${quotedTable} WHERE ${quotedCol} IS NOT NULL${bfWhere} ORDER BY ${quotedCol} LIMIT 500`;
    runQuery(sql, 500)
      .then((result) => {
        const vals = result.rows.map((r) => String(r[0] ?? "")).filter(Boolean);
        setFilterValues(filter.id, vals);
      })
      .catch((err) => {
        console.error("Filter values fetch failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load values");
      })
      .finally(() => setLoading(false));
  }, [filter.column, filter.table, filter.values.length, filter.id, setFilterValues]);

  useEffect(() => {
    if (open) {
      setLocalSelection(filter.selectedValues);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, filter.selectedValues]);

  const toggleValue = useCallback((val: string) => {
    if (filter.mode === "single") {
      setLocalSelection((prev) => prev[0] === val ? [] : [val]);
    } else {
      setLocalSelection((prev) =>
        prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
      );
    }
  }, [filter.mode]);

  const handleDone = () => {
    setFilterSelection(filter.id, localSelection);
    setOpen(false);
    triggerCascade(filter.column, localSelection);
  };

  const currentSort: FilterSortOrder = filter.sortOrder ?? "asc";

  const sortedValues = useMemo(() => {
    const vals = [...filter.values];
    if (currentSort === "desc") {
      vals.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    } else if (currentSort === "asc") {
      vals.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return vals;
  }, [filter.values, currentSort]);

  const filtered = search
    ? sortedValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : sortedValues;

  const cycleSortOrder = () => {
    const next: FilterSortOrder = currentSort === "asc" ? "desc" : "asc";
    setFilterSortOrder(filter.id, next);
  };

  const selectionLabel =
    filter.selectedValues.length === 0
      ? "All"
      : filter.selectedValues.length === 1
        ? filter.selectedValues[0]
        : `${filter.selectedValues.length} selected`;

  const isNum = /int|float|double|decimal|number|bigint|long|short/i.test(filter.dataType);
  const isBool = /bool/i.test(filter.dataType);
  const variant = isBool ? "boolean" : isNum ? "numeric" : "text";
  const hasSelection = filter.selectedValues.length > 0;
  const secondaryLabel = filter.mode === "multi"
    ? `${filter.selectedValues.length} of ${filter.values.length || "..."}`
    : undefined;

  return (
    <FilterChipShell
      ref={chipRef}
      icon={ListFilter}
      name={columnLabel}
      label={selectionLabel}
      open={open}
      variant={variant}
      isActive={hasSelection}
      secondaryLabel={secondaryLabel}
      onToggle={() => setOpen((v) => !v)}
      onRemove={() => removeFilter(filter.id)}
    >
      {open && createPortal(
        <div className="flt-popover-portal" style={getPosition()} ref={popoverRef}>
          <div className="flt-popover">
            {/* Header */}
            <div className="flt-popover-header">
              <span className="flt-popover-title">
                <ListFilter size={14} /> {columnLabel}
              </span>
              <div className="flt-popover-mode">
                <button
                  className="flt-popover-sort-btn"
                  onClick={cycleSortOrder}
                  title={`Sort: ${currentSort === "asc" ? "A → Z" : "Z → A"}`}
                >
                  {currentSort === "asc" ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
                </button>
                {filter.singleSelectForced ? (
                  <span className="flt-popover-mode-locked" title="Admin restricted to single select">
                    Single only
                  </span>
                ) : (
                  <>
                    <button
                      className={`flt-popover-mode-btn${filter.mode === "single" ? " flt-popover-mode-btn--active" : ""}`}
                      onClick={() => { updateFilterMode(filter.id, "single"); setLocalSelection((s) => s.slice(0, 1)); }}
                    >
                      Single
                    </button>
                    <button
                      className={`flt-popover-mode-btn${filter.mode === "multi" ? " flt-popover-mode-btn--active" : ""}`}
                      onClick={() => updateFilterMode(filter.id, "multi")}
                    >
                      Multi
                    </button>
                  </>
                )}
              </div>
            </div>

            {isDateColumn && (
              <button
                className="flt-switch-type-btn"
                onClick={() => updateFilterType(filter.id, "date_range")}
              >
                <Calendar size={12} /> Switch to Date Range
              </button>
            )}

            {/* Search */}
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

            {/* Select / Deselect all (multi mode only) */}
            {filter.mode === "multi" && !loading && !error && filtered.length > 0 && (
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

            {/* List */}
            {loading ? (
              <div className="flt-popover-loading">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonLine key={i} width={`${50 + Math.random() * 40}%`} height={20} />
                ))}
              </div>
            ) : error ? (
              <div className="flt-popover-error">
                <p>{error}</p>
                <button
                  className="run-btn"
                  onClick={() => { fetchedRef.current = false; setError(null); }}
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
                  return (
                    <button
                      key={val}
                      className={`flt-popover-option${selected ? " flt-popover-option--selected" : ""}`}
                      onClick={() => toggleValue(val)}
                    >
                      <span className="flt-popover-option-text">{val}</span>
                      {selected && <Check size={12} className="flt-popover-option-tick" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer */}
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
  );
}
