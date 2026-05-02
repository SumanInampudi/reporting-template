import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ChevronDown, ChevronRight, GitMerge, CircleCheck, Shield, Plus, Trash2,
  Search, Database, X, Loader2, Code, ToggleLeft, ToggleRight,
  Table2, FileCode2, CheckCircle2, AlertTriangle, Play, Wand2,
} from "lucide-react";
import { format as formatSql } from "sql-formatter";
import CatalogBrowser from "./CatalogBrowser";
import JoinsSection from "./JoinsSection";
import { fetchColumnsIn, runQuery } from "@/lib/api";
import type { ConnectionSetup } from "@/hooks/useConnectionSetup";
import type { BaseFilter, BaseFilterMode, BaseFilterOperator, DatasourceMode, JoinConfig } from "@/types/dashboard";

const OPERATORS: { value: BaseFilterOperator; label: string }[] = [
  { value: "=",       label: "equals" },
  { value: "!=",      label: "not equals" },
  { value: "IN",      label: "in" },
  { value: "NOT IN",  label: "not in" },
  { value: ">",       label: "greater than" },
  { value: "<",       label: "less than" },
  { value: ">=",      label: "greater or equal" },
  { value: "<=",      label: "less or equal" },
  { value: "BETWEEN", label: "between" },
  { value: "LIKE",    label: "contains" },
];

interface Props {
  conn: ConnectionSetup;
  rowLimit: number;
  onRowLimitChange: (v: number) => void;
  joins: JoinConfig[];
  onJoinsChange: (joins: JoinConfig[]) => void;
  baseFilters: BaseFilter[];
  onBaseFiltersChange: (filters: BaseFilter[]) => void;
  sourceMode: DatasourceMode;
  onSourceModeChange: (m: DatasourceMode) => void;
  customQuery: string;
  onCustomQueryChange: (q: string) => void;
  queryValidated: boolean;
  onQueryValidated: (v: boolean) => void;
  customQueryColumns: { col_name: string; data_type: string }[];
  onCustomQueryColumnsChange: (cols: { col_name: string; data_type: string }[]) => void;
}

let _nextId = 1;
function genId() { return `bf_${Date.now()}_${_nextId++}`; }

/* ── Searchable Column Combobox ── */

function ColumnCombobox({ columns, value, onChange }: {
  columns: string[];
  value: string;
  onChange: (col: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return columns;
    const q = search.toLowerCase();
    return columns.filter((c) => c.toLowerCase().includes(q));
  }, [columns, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="bf-combo" ref={wrapRef}>
      <div className="bf-combo-input-wrap" onClick={() => setOpen(true)}>
        <Search size={11} className="bf-combo-icon" />
        <input
          className="bf-combo-input"
          placeholder="Search column..."
          value={open ? search : value || ""}
          onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setSearch(""); }}
        />
        {value && !open && (
          <button className="bf-combo-clear" onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}>
            <X size={10} />
          </button>
        )}
      </div>
      {open && (
        <div className="bf-combo-dropdown">
          {filtered.length === 0 && <div className="bf-combo-empty">No columns match</div>}
          {filtered.map((c) => (
            <button
              key={c}
              className={`bf-combo-option${c === value ? " bf-combo-option--active" : ""}`}
              onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tag-based Value Picker ── */

function ValueTagPicker({ values, onChange, column, fqTable, fetchDisabled }: {
  values: string[];
  onChange: (values: string[]) => void;
  column: string;
  fqTable: string;
  fetchDisabled: boolean;
}) {
  const [inputVal, setInputVal] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchValues = async () => {
    if (!column || !fqTable || fetchDisabled) return;
    setLoading(true);
    try {
      const sql = `SELECT DISTINCT \`${column}\` FROM ${fqTable} WHERE \`${column}\` IS NOT NULL ORDER BY \`${column}\` LIMIT 500`;
      const result = await runQuery(sql, 500);
      const fetched = result.rows.map((r) => String(r[0] ?? "")).filter(Boolean);
      setSuggestions(fetched);
      setShowSugg(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const addValue = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInputVal("");
  };

  const removeValue = (v: string) => onChange(values.filter((x) => x !== v));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addValue(inputVal);
    } else if (e.key === "Backspace" && !inputVal && values.length > 0) {
      removeValue(values[values.length - 1]);
    }
  };

  const availableSuggestions = suggestions.filter((s) => !values.includes(s) && s.toLowerCase().includes(inputVal.toLowerCase()));

  return (
    <div className="bf-tag-picker" ref={wrapRef}>
      <div className="bf-tag-area">
        {values.map((v) => (
          <span key={v} className="bf-tag">
            {v}
            <button className="bf-tag-remove" onClick={() => removeValue(v)}><X size={9} /></button>
          </span>
        ))}
        <input
          className="bf-tag-input"
          placeholder={values.length === 0 ? "Type or fetch values..." : "Add more..."}
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); if (suggestions.length > 0) setShowSugg(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSugg(true); }}
        />
      </div>
      <button
        className="bf-fetch-btn"
        onClick={fetchValues}
        disabled={fetchDisabled || loading || !column}
        title={!column ? "Select a column first" : "Fetch distinct values from database"}
      >
        {loading ? <Loader2 size={12} className="spin" /> : <Database size={12} />}
      </button>
      {showSugg && availableSuggestions.length > 0 && (
        <div className="bf-tag-suggestions">
          {availableSuggestions.slice(0, 50).map((s) => (
            <button key={s} className="bf-tag-sugg-item" onClick={() => addValue(s)}>{s}</button>
          ))}
          {availableSuggestions.length > 50 && (
            <div className="bf-tag-sugg-more">{availableSuggestions.length - 50} more — type to filter</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export default function ConnectionStep({
  conn, rowLimit, onRowLimitChange, joins, onJoinsChange,
  baseFilters, onBaseFiltersChange,
  sourceMode, onSourceModeChange, customQuery, onCustomQueryChange,
  queryValidated, onQueryValidated, customQueryColumns, onCustomQueryColumnsChange,
}: Props) {
  const [joinsOpen, setJoinsOpen] = useState(joins.length > 0);
  const [filtersOpen, setFiltersOpen] = useState(baseFilters.length > 0);
  const [primaryColumns, setPrimaryColumns] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [validatedColumns, setValidatedColumns] = useState<{ col_name: string; data_type: string }[]>(
    () => customQueryColumns ?? [],
  );

  const { selectedCatalog, selectedSchema, selectedTable } = conn;
  const tableSelected = !!(selectedCatalog && selectedSchema && selectedTable);
  const fqTable = tableSelected ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : "";

  useEffect(() => {
    if (!tableSelected) { setPrimaryColumns([]); return; }
    fetchColumnsIn(selectedCatalog, selectedSchema, selectedTable)
      .then((res) => setPrimaryColumns(res.columns.map((c) => c.col_name)))
      .catch(() => setPrimaryColumns([]));
  }, [selectedCatalog, selectedSchema, selectedTable, tableSelected]);

  const handleValidateQuery = useCallback(async () => {
    const trimmed = customQuery.trim();
    if (!trimmed) return;
    setValidating(true);
    setValidationError("");
    setValidatedColumns([]);
    try {
      const wrappedSql = `SELECT * FROM (${trimmed}) AS __cq_validate__ LIMIT 1`;
      const result = await runQuery(wrappedSql, 1);
      if (result.columns && result.columns.length > 0) {
        const types = result.column_types ?? [];
        const cols = result.columns.map((name, i) => ({
          col_name: name,
          data_type: types[i] ?? "STRING",
        }));
        setValidatedColumns(cols);
        onCustomQueryColumnsChange(cols);
        onQueryValidated(true);
      } else {
        setValidationError("Query returned no columns. Verify your SQL.");
        onCustomQueryColumnsChange([]);
        onQueryValidated(false);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Query validation failed");
      onQueryValidated(false);
    } finally {
      setValidating(false);
    }
  }, [customQuery, onQueryValidated, onCustomQueryColumnsChange]);

  const handleQueryChange = useCallback((q: string) => {
    onCustomQueryChange(q);
    if (queryValidated) onQueryValidated(false);
  }, [onCustomQueryChange, queryValidated, onQueryValidated]);

  const handleFormatQuery = useCallback(() => {
    if (!customQuery.trim()) return;
    try {
      const formatted = formatSql(customQuery, { language: "spark", tabWidth: 2 });
      onCustomQueryChange(formatted);
    } catch { /* formatting failed — keep original */ }
  }, [customQuery, onCustomQueryChange]);

  const addFilter = useCallback(() => {
    onBaseFiltersChange([...baseFilters, { id: genId(), column: "", operator: "=", values: [""], mode: "static" }]);
  }, [baseFilters, onBaseFiltersChange]);

  const updateFilter = useCallback((id: string, patch: Partial<BaseFilter>) => {
    onBaseFiltersChange(baseFilters.map((f) => f.id === id ? { ...f, ...patch } : f));
  }, [baseFilters, onBaseFiltersChange]);

  const removeFilter = useCallback((id: string) => {
    onBaseFiltersChange(baseFilters.filter((f) => f.id !== id));
  }, [baseFilters, onBaseFiltersChange]);

  const needsTwoValues = (op: BaseFilterOperator) => op === "BETWEEN";
  const needsMultiValues = (op: BaseFilterOperator) => op === "IN" || op === "NOT IN";

  const toggleMode = (bf: BaseFilter) => {
    const newMode: BaseFilterMode = bf.mode === "query" ? "static" : "query";
    updateFilter(bf.id, { mode: newMode });
  };

  const sourceReady = sourceMode === "query"
    ? (queryValidated && customQuery.trim().length > 0)
    : tableSelected;

  return (
    <div className="connection-step">
      {/* Source Mode Toggle */}
      <div className="cq-mode-toggle">
        <button
          className={`cq-mode-btn${sourceMode === "table" ? " cq-mode-btn--active" : ""}`}
          onClick={() => onSourceModeChange("table")}
          type="button"
        >
          <Table2 size={14} />
          <span>Table</span>
        </button>
        <button
          className={`cq-mode-btn${sourceMode === "query" ? " cq-mode-btn--active" : ""}`}
          onClick={() => onSourceModeChange("query")}
          type="button"
        >
          <FileCode2 size={14} />
          <span>Custom Query</span>
        </button>
      </div>

      {sourceMode === "table" ? (
        <CatalogBrowser conn={conn} rowLimit={rowLimit} onRowLimitChange={onRowLimitChange} />
      ) : (
        <div className="cq-editor-root">
          <div className="cq-editor-header">
            <div className="cq-editor-header-left">
              <h2 className="cb-title">Custom SQL Query</h2>
              <p className="cb-subtitle">Paste your SQL query to use as the data source</p>
            </div>
            <div className="cb-conn-status">
              {conn.connTesting ? (
                <span className="cb-badge cb-badge--loading">
                  <Loader2 size={12} className="spin" /> Connecting…
                </span>
              ) : conn.connStatus?.ok ? (
                <span className="cb-badge cb-badge--ok">
                  <CheckCircle2 size={12} /> Connected
                </span>
              ) : (
                <span className="cb-badge cb-badge--fail">
                  {conn.connStatus?.message ?? "Not tested"}
                </span>
              )}
            </div>
          </div>

          <textarea
            className="cq-textarea"
            placeholder="SELECT column1, column2, ...&#10;FROM catalog.schema.table&#10;WHERE conditions..."
            value={customQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            spellCheck={false}
          />

          <div className="cq-actions">
            <button
              className="cq-validate-btn"
              onClick={handleValidateQuery}
              disabled={validating || !customQuery.trim() || !conn.connStatus?.ok}
              type="button"
            >
              {validating ? (
                <><Loader2 size={14} className="spin" /> Validating…</>
              ) : (
                <><Play size={14} /> Validate Query</>
              )}
            </button>

            <button
              className="cq-format-btn"
              onClick={handleFormatQuery}
              disabled={!customQuery.trim()}
              type="button"
            >
              <Wand2 size={14} /> Format
            </button>

            {queryValidated && (
              <span className="cq-status cq-status--ok">
                <CheckCircle2 size={14} /> Valid — {validatedColumns.length} column{validatedColumns.length !== 1 ? "s" : ""} detected
              </span>
            )}

            {validationError && (
              <span className="cq-status cq-status--error">
                <AlertTriangle size={14} /> {validationError}
              </span>
            )}
          </div>

          {queryValidated && validatedColumns.length > 0 && (() => {
            const numericRe = /INT|LONG|DOUBLE|FLOAT|DECIMAL|NUMERIC|SHORT|BYTE/i;
            const dims = validatedColumns.filter((c) => !numericRe.test(c.data_type));
            const measures = validatedColumns.filter((c) => numericRe.test(c.data_type));
            return (
              <div className="cq-columns-preview">
                {dims.length > 0 && (
                  <div className="cq-col-group">
                    <div className="cq-col-group-header cq-col-group-header--dim">
                      <span className="cq-col-group-dot cq-col-group-dot--dim" />
                      Dimensions
                      <span className="cq-col-group-count">{dims.length}</span>
                    </div>
                    <div className="cq-columns-list">
                      {dims.map((c) => (
                        <span key={c.col_name} className="cq-col-tag cq-col-tag--dim">
                          {c.col_name}
                          <span className="cq-col-type">{c.data_type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {measures.length > 0 && (
                  <div className="cq-col-group">
                    <div className="cq-col-group-header cq-col-group-header--measure">
                      <span className="cq-col-group-dot cq-col-group-dot--measure" />
                      Measures
                      <span className="cq-col-group-count">{measures.length}</span>
                    </div>
                    <div className="cq-columns-list">
                      {measures.map((c) => (
                        <span key={c.col_name} className="cq-col-tag cq-col-tag--numeric">
                          {c.col_name}
                          <span className="cq-col-type">{c.data_type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {sourceReady && (
        <>
          {/* Joins section */}
          <div className="conn-joins-section">
            <button className="conn-joins-toggle" onClick={() => setJoinsOpen(!joinsOpen)}>
              {joinsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <GitMerge size={14} />
              <span>Join Additional Tables</span>
              {joins.length > 0 && (
                <>
                  <CircleCheck size={12} className="astep-tab-check" />
                  <span className="astep-tab-badge">{joins.length}</span>
                </>
              )}
            </button>
            {joinsOpen && (
              <div className="conn-joins-body">
                <JoinsSection
                  catalog={selectedCatalog}
                  schema={selectedSchema}
                  primaryTable={selectedTable}
                  primaryColumns={primaryColumns}
                  joins={joins}
                  onChange={onJoinsChange}
                />
              </div>
            )}
          </div>

          {/* Data Scope section */}
          <div className="conn-joins-section">
            <button className="conn-joins-toggle" onClick={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Shield size={14} />
              <span>Data Scope</span>
              {baseFilters.length > 0 && (
                <>
                  <CircleCheck size={12} className="astep-tab-check" />
                  <span className="astep-tab-badge">{baseFilters.length}</span>
                </>
              )}
            </button>
            {filtersOpen && (
              <div className="conn-joins-body">
                <div className="bf-info">
                  Define the data scope for this workspace. These rules are always applied to every query
                  and cannot be overridden by users.
                </div>

                {baseFilters.map((bf) => (
                  <div key={bf.id} className="bf-row">
                    {/* Mode toggle */}
                    <button
                      className={`bf-mode-toggle${bf.mode === "query" ? " bf-mode-toggle--query" : ""}`}
                      onClick={() => toggleMode(bf)}
                      title={bf.mode === "query" ? "Switch to static filter" : "Switch to SQL expression"}
                    >
                      {bf.mode === "query" ? <Code size={13} /> : <ToggleLeft size={13} />}
                    </button>

                    {bf.mode === "query" ? (
                      /* Query / SQL expression mode */
                      <div className="bf-query-wrap">
                        <Code size={11} className="bf-query-icon" />
                        <input
                          className="bf-query-input"
                          placeholder="SQL WHERE expression, e.g. YEAR(date_col) = 2024"
                          value={bf.queryExpression ?? ""}
                          onChange={(e) => updateFilter(bf.id, { queryExpression: e.target.value })}
                        />
                      </div>
                    ) : (
                      /* Static filter mode */
                      <>
                        <ColumnCombobox
                          columns={primaryColumns}
                          value={bf.column}
                          onChange={(col) => updateFilter(bf.id, { column: col })}
                        />

                        <select
                          className="bf-select bf-op-select"
                          value={bf.operator}
                          onChange={(e) => {
                            const op = e.target.value as BaseFilterOperator;
                            const vals = needsTwoValues(op) ? [bf.values[0] ?? "", bf.values[1] ?? ""]
                              : needsMultiValues(op) ? (bf.values.length > 0 ? bf.values : [""])
                              : [bf.values[0] ?? ""];
                            updateFilter(bf.id, { operator: op, values: vals });
                          }}
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>

                        <div className="bf-values">
                          {needsTwoValues(bf.operator) ? (
                            <>
                              <input
                                className="bf-input"
                                placeholder="From"
                                value={bf.values[0] ?? ""}
                                onChange={(e) => updateFilter(bf.id, { values: [e.target.value, bf.values[1] ?? ""] })}
                              />
                              <span className="bf-and">and</span>
                              <input
                                className="bf-input"
                                placeholder="To"
                                value={bf.values[1] ?? ""}
                                onChange={(e) => updateFilter(bf.id, { values: [bf.values[0] ?? "", e.target.value] })}
                              />
                            </>
                          ) : needsMultiValues(bf.operator) ? (
                            <ValueTagPicker
                              values={bf.values.filter(Boolean)}
                              onChange={(vals) => updateFilter(bf.id, { values: vals })}
                              column={bf.column}
                              fqTable={fqTable}
                              fetchDisabled={!tableSelected}
                            />
                          ) : (
                            <ValueTagPicker
                              values={bf.values.filter(Boolean)}
                              onChange={(vals) => updateFilter(bf.id, { values: vals })}
                              column={bf.column}
                              fqTable={fqTable}
                              fetchDisabled={!tableSelected}
                            />
                          )}
                        </div>
                      </>
                    )}

                    <button className="bf-remove" onClick={() => removeFilter(bf.id)} title="Remove rule">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button className="bf-add" onClick={addFilter}>
                  <Plus size={13} /> Add Rule
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
