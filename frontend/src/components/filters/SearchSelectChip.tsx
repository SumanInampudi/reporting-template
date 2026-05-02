import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Check, X, Loader2 } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { useCascadeRefresh } from "@/hooks/useCascadeRefresh";
import { runQuery } from "@/lib/api";
import { buildBaseFilterClauses, quoteTableRef } from "@/lib/sqlBuilder";
import { usePopover } from "./usePopover";
import FilterChipShell from "./FilterChipShell";
import type { FilterItem } from "@/types/dashboard";

interface Props {
  filter: FilterItem;
}

const MIN_CHARS = 2;

export default function SearchSelectChip({ filter }: Props) {
  const { removeFilter, updateFilterMode, setFilterSelection } = useStore();
  const triggerCascade = useCascadeRefresh();
  const alias = useColumnAlias();
  const columnLabel = alias(filter.column);
  const { open, setOpen, chipRef, popoverRef, getPosition, portalTarget } = usePopover();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSelection, setLocalSelection] = useState<string[]>(filter.selectedValues);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocalSelection(filter.selectedValues);
      setSearch("");
      setResults([]);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, filter.selectedValues]);

  const doSearch = useCallback(async (term: string) => {
    if (term.length < MIN_CHARS) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const effectiveTbl = useStore.getState().effectiveTableRef() ?? filter.table;
      const quotedTable = quoteTableRef(effectiveTbl);
      const quotedCol = `\`${filter.column}\``;
      const bf = useStore.getState().activeWorkspace?.datasource?.base_filters;
      const bfParts = buildBaseFilterClauses(bf);
      const bfWhere = bfParts.length > 0 ? ` AND ${bfParts.join(" AND ")}` : "";
      const escaped = term.replace(/'/g, "''");
      const sql = `SELECT DISTINCT ${quotedCol} FROM ${quotedTable} WHERE ${quotedCol} IS NOT NULL AND LOWER(CAST(${quotedCol} AS STRING)) LIKE '%${escaped.toLowerCase()}%'${bfWhere} ORDER BY ${quotedCol} LIMIT 50`;
      const result = await runQuery(sql, 50);
      setResults(result.rows.map((r) => String(r[0] ?? "")).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [filter.table, filter.column]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
  };

  const handleSearchClick = () => {
    if (search.length < MIN_CHARS) return;
    doSearch(search);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchClick();
    }
  };

  const isForcedSingle = filter.singleSelectForced === true;

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
    setFilterSelection(filter.id, localSelection);
    setOpen(false);
    triggerCascade(filter.column, localSelection);
  };

  const selectionLabel =
    filter.selectedValues.length === 0
      ? "All"
      : filter.selectedValues.length === 1
        ? filter.selectedValues[0]
        : `${filter.selectedValues.length} selected`;

  const hasSelection = filter.selectedValues.length > 0;

  return (
    <FilterChipShell
      ref={chipRef}
      icon={Search}
      name={columnLabel}
      label={selectionLabel}
      open={open}
      variant="text"
      isActive={hasSelection}
      secondaryLabel={hasSelection ? `${filter.selectedValues.length} picked` : undefined}
      onToggle={() => setOpen((v) => !v)}
      onRemove={() => removeFilter(filter.id)}
    >
      {open && createPortal(
        <div className="flt-popover-portal" style={getPosition()} ref={popoverRef}>
          <div className="flt-popover">
            <div className="flt-popover-header">
              <span className="flt-popover-title">
                <Search size={14} /> {columnLabel}
              </span>
              <div className="flt-popover-mode">
                {isForcedSingle ? (
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

            <div className="flt-popover-search">
              <Search size={13} />
              <input
                ref={searchRef}
                className="flt-popover-search-input"
                placeholder={`Type at least ${MIN_CHARS} characters...`}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {search && (
                <button
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                  onClick={() => { setSearch(""); setResults([]); }}
                >
                  <X size={12} />
                </button>
              )}
              <button
                className="ss-search-btn"
                onClick={handleSearchClick}
                disabled={search.length < MIN_CHARS || searching}
                title="Search"
              >
                {searching ? <Loader2 size={12} className="spin" /> : <Search size={12} />}
              </button>
            </div>

            {localSelection.length > 0 && (
              <div className="ss-chip-selected">
                <span className="ss-chip-selected-label">Selected:</span>
                <div className="ss-chip-selected-tags">
                  {localSelection.map((v) => (
                    <span key={v} className="ss-chip-tag">
                      {v}
                      <button className="ss-chip-tag-remove" onClick={() => toggleValue(v)}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flt-popover-list">
              {search.length < MIN_CHARS && results.length === 0 && !searching && (
                <div className="flt-popover-empty">
                  Type to search for values
                </div>
              )}
              {search.length >= MIN_CHARS && !searching && results.length === 0 && !error && (
                <div className="flt-popover-empty">
                  No matching values found
                </div>
              )}
              {error && (
                <div className="flt-popover-error">
                  <p>{error}</p>
                </div>
              )}
              {results.map((val) => {
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

            <div className="flt-popover-footer">
              <span className="flt-popover-count">
                <strong>{localSelection.length}</strong> selected
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
