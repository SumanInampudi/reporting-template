import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ChevronDown, ChevronRight, Database, FileText, Filter,
  FunctionSquare, Loader2, Plus, Play, Table2, Trash2, X, CheckCircle2,
} from "lucide-react";
import { fetchCatalogs, fetchColumnsIn, fetchSchemas, fetchTablesIn, runQuery } from "@/lib/api";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type {
  ColumnMeta, DimensionSource, DimensionSourceType,
  DimensionStaticValue, FilterSortOrder,
} from "@/types/dashboard";

function DimensionSourcesSection({ columns, aliases, sources, onChange, defaultCatalog, defaultSchema, defaultTable, partitionColumns }: {
  columns: string[];
  aliases: Record<string, string>;
  sources: DimensionSource[];
  onChange: (sources: DimensionSource[]) => void;
  defaultCatalog: string;
  defaultSchema: string;
  defaultTable: string;
  partitionColumns: string[];
}) {
  const fqTable = defaultCatalog && defaultSchema && defaultTable
    ? `\`${defaultCatalog}\`.\`${defaultSchema}\`.\`${defaultTable}\`` : "";

  const addSource = () => {
    const id = `dim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...sources, {
      id,
      column: "",
      label: "",
      required: false,
      sourceType: "static",
      staticValues: [{ value: "", display: "" }],
    }]);
  };

  const addPartitionFilter = (col: string) => {
    const id = `dim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...sources, {
      id,
      column: col,
      label: aliases[col] || col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      required: true,
      sourceType: "query",
      query: fqTable ? `SELECT DISTINCT \`${col}\` FROM ${fqTable} ORDER BY 1` : "",
    }]);
  };

  const updateSource = (idx: number, patch: Partial<DimensionSource>) => {
    onChange(sources.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);

  const removeSource = (idx: number) => {
    onChange(sources.filter((_, i) => i !== idx));
    setConfirmRemoveIdx(null);
  };

  const usedColumns = new Set(sources.map((s) => s.column));
  const availableColumns = columns.filter((c) => !usedColumns.has(c));
  const uncoveredPartitions = partitionColumns.filter((p) => !usedColumns.has(p));

  return (
    <div className="dim-section">
      <div className="dim-info-banner">
        <AlertCircle size={14} />
        <div>
          <strong>Optional</strong> — Configure custom filters to pre-populate filter values
          from lookup tables, custom queries, static lists, or SQL formulas instead of scanning the main table.
          Useful for large datasets where <code>SELECT DISTINCT</code> is slow.
        </div>
      </div>

      {uncoveredPartitions.length > 0 && (
        <div className="dim-partition-banner">
          <Database size={14} />
          <div>
            <strong>Performance Tip</strong> — This table is partitioned by{" "}
            {uncoveredPartitions.map((p, i) => (
              <span key={p}>
                {i > 0 && ", "}<code>{p}</code>
              </span>
            ))}
            . Adding mandatory filters on partition columns enables <strong>partition pruning</strong> and
            significantly speeds up queries.
          </div>
          <div className="dim-partition-actions">
            {uncoveredPartitions.map((col) => (
              <button key={col} className="dim-partition-add-btn" onClick={() => addPartitionFilter(col)}>
                <Plus size={12} /> {aliases[col] || col}
              </button>
            ))}
          </div>
        </div>
      )}

      {sources.length === 0 ? (
        <div className="dim-empty">
          <Filter size={24} />
          <p>No custom filters configured.</p>
          <p className="dim-empty-hint">
            Add filters to define how filter values are populated in the workspace.
          </p>
          <button className="dim-add-btn" onClick={addSource}>
            <Plus size={14} /> Add a Filter
          </button>
        </div>
      ) : (
        <>
          {sources.map((src, idx) => (
            <FilterCard
              key={src.id}
              source={src}
              index={idx}
              allColumns={columns}
              availableColumns={src.column ? [src.column, ...availableColumns] : availableColumns}
              aliases={aliases}
              onUpdate={(patch) => updateSource(idx, patch)}
              onRemove={() => setConfirmRemoveIdx(idx)}
              defaultCatalog={defaultCatalog}
              defaultSchema={defaultSchema}
              fqTable={fqTable}
            />
          ))}
          <button className="dim-add-btn dim-add-btn--bottom" onClick={addSource}>
            <Plus size={14} /> Add a Filter
          </button>
        </>
      )}

      {confirmRemoveIdx !== null && (
        <ConfirmDialog
          title="Remove Filter"
          message={`Are you sure you want to remove "${sources[confirmRemoveIdx]?.label || sources[confirmRemoveIdx]?.column || "this filter"}"? This action cannot be undone.`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => removeSource(confirmRemoveIdx)}
          onCancel={() => setConfirmRemoveIdx(null)}
        />
      )}
    </div>
  );
}

/* ── FilterCard ─────────────────────────────────── */

function FilterCard({ source, index, allColumns, availableColumns, aliases, onUpdate, onRemove, defaultCatalog, defaultSchema, fqTable }: {
  source: DimensionSource;
  index: number;
  allColumns: string[];
  availableColumns: string[];
  aliases: Record<string, string>;
  onUpdate: (patch: Partial<DimensionSource>) => void;
  onRemove: () => void;
  defaultCatalog: string;
  defaultSchema: string;
  fqTable: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleColumnChange = (col: string) => {
    onUpdate({
      column: col,
      label: source.label || aliases[col] || col,
    });
  };

  const handleSourceTypeChange = (t: DimensionSourceType) => {
    const patch: Partial<DimensionSource> = { sourceType: t };
    if (t === "static" && (!source.staticValues || source.staticValues.length === 0)) {
      patch.staticValues = [{ value: "", display: "" }];
    }
    if (t === "table") {
      patch.tableCatalog = patch.tableCatalog ?? defaultCatalog;
      patch.tableSchema = patch.tableSchema ?? defaultSchema;
    }
    if (t === "formula" && (!source.formulaValues || source.formulaValues.length === 0)) {
      patch.formulaValues = [{ value: "", display: "" }];
    }
    if (t === "formula" && !source.column) {
      patch.column = `formula_${source.id.slice(-6)}`;
    }
    onUpdate(patch);
  };

  const isFormula = source.sourceType === "formula";

  const addStaticRow = () => {
    onUpdate({ staticValues: [...(source.staticValues ?? []), { value: "", display: "" }] });
  };

  const updateStaticRow = (ri: number, field: keyof DimensionStaticValue, val: string) => {
    const rows = [...(source.staticValues ?? [])];
    rows[ri] = { ...rows[ri], [field]: val };
    onUpdate({ staticValues: rows });
  };

  const removeStaticRow = (ri: number) => {
    onUpdate({ staticValues: (source.staticValues ?? []).filter((_, i) => i !== ri) });
  };

  const addFormulaRow = () => {
    onUpdate({ formulaValues: [...(source.formulaValues ?? []), { value: "", display: "" }] });
  };

  const updateFormulaRow = (ri: number, field: keyof DimensionStaticValue, val: string) => {
    const rows = [...(source.formulaValues ?? [])];
    rows[ri] = { ...rows[ri], [field]: val };
    onUpdate({ formulaValues: rows });
  };

  const removeFormulaRow = (ri: number) => {
    onUpdate({ formulaValues: (source.formulaValues ?? []).filter((_, i) => i !== ri) });
  };

  const SOURCE_TYPES: { key: DimensionSourceType; label: string; icon: typeof FileText }[] = [
    { key: "static", label: "Static List", icon: FileText },
    { key: "query", label: "SQL Query", icon: Database },
    { key: "table", label: "Lookup Table", icon: Table2 },
    { key: "formula", label: "Formula", icon: FunctionSquare },
  ];

  return (
    <div className={`dim-card${source.required ? " dim-card--required" : ""}`}>
      <div className="dim-card-header">
        <button className="dim-card-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="dim-card-index">#{index + 1}</span>
        <span className="dim-card-title">
          {source.label || source.column || "New Filter"}
        </span>
        {source.required && <span className="dim-required-badge">Required</span>}
        <span className="dim-source-type-badge">{source.sourceType}</span>
        <button className="dim-card-remove" onClick={onRemove} title="Remove filter">
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="dim-card-body">
          <div className="dim-field-row">
            {isFormula ? (
              <>
                <div className="dim-field">
                  <label className="dim-label">Filter Name</label>
                  <input
                    className="dim-input"
                    value={source.label}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="e.g. Spend Tier, Region Group"
                  />
                </div>
                <div className="dim-field">
                  <label className="dim-label">
                    Filter Key <span className="dim-optional">(pick a column or type custom)</span>
                  </label>
                  <div className="dim-combo">
                    <input
                      className="dim-input dim-input--mono dim-combo-input"
                      value={source.column}
                      onChange={(e) => onUpdate({ column: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
                      placeholder="e.g. spend_tier"
                      list={`fk-cols-${source.id}`}
                    />
                    <datalist id={`fk-cols-${source.id}`}>
                      {allColumns.map((c) => (
                        <option key={c} value={c}>{aliases[c] ? `${aliases[c]} (${c})` : c}</option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="dim-field">
                  <label className="dim-label">Column</label>
                  <select
                    className="dim-select"
                    value={source.column}
                    onChange={(e) => handleColumnChange(e.target.value)}
                  >
                    <option value="">Select column...</option>
                    {availableColumns.map((c) => (
                      <option key={c} value={c}>{aliases[c] || c} ({c})</option>
                    ))}
                  </select>
                </div>
                <div className="dim-field">
                  <label className="dim-label">Display Label</label>
                  <input
                    className="dim-input"
                    value={source.label}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="Filter label in UI"
                  />
                </div>
              </>
            )}
            <div className="dim-field dim-field--toggle">
              <label className="dim-label">Required</label>
              <button
                className={`dim-toggle${source.required ? " dim-toggle--on" : ""}`}
                onClick={() => onUpdate({ required: !source.required })}
              >
                <span className="dim-toggle-knob" />
              </button>
            </div>
            <div className="dim-field dim-field--toggle">
              <label className="dim-label" title="When enabled, users can only pick one value at a time">Single Select</label>
              <button
                className={`dim-toggle${source.forceSingleSelect ? " dim-toggle--on" : ""}`}
                onClick={() => onUpdate({ forceSingleSelect: !source.forceSingleSelect })}
                title="Force this filter to single-select only — users won't be able to select multiple values"
              >
                <span className="dim-toggle-knob" />
              </button>
            </div>
            <div className="dim-field">
              <label className="dim-label">Sort Order</label>
              <select
                className="dim-select"
                value={source.sortOrder ?? "asc"}
                onChange={(e) => onUpdate({ sortOrder: e.target.value as FilterSortOrder })}
              >
                <option value="asc">A → Z (Ascending)</option>
                <option value="desc">Z → A (Descending)</option>
                {(source.sourceType === "static" || source.sourceType === "formula") && (
                  <option value="custom">Custom (as entered)</option>
                )}
              </select>
            </div>
          </div>

          <div className="dim-field-row">
            <div className="dim-field dim-field--full">
              <label className="dim-label">Source Type</label>
              <div className="dim-source-type-bar">
                {SOURCE_TYPES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    className={`dim-source-type-btn${source.sourceType === key ? " dim-source-type-btn--active" : ""}`}
                    onClick={() => handleSourceTypeChange(key)}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {source.sourceType === "static" && (
            <StaticValuesEditor
              values={source.staticValues ?? []}
              onAdd={addStaticRow}
              onUpdate={updateStaticRow}
              onRemove={removeStaticRow}
            />
          )}

          {source.sourceType === "query" && (
            <QuerySourceEditor source={source} onUpdate={onUpdate} />
          )}

          {source.sourceType === "table" && (
            <TableSourceEditor
              source={source}
              onUpdate={onUpdate}
              defaultCatalog={defaultCatalog}
              defaultSchema={defaultSchema}
            />
          )}

          {source.sourceType === "formula" && (
            <FormulaSourceEditor
              source={source}
              onUpdate={onUpdate}
              fqTable={fqTable}
              allColumns={allColumns}
              aliases={aliases}
              onAddRow={addFormulaRow}
              onUpdateRow={updateFormulaRow}
              onRemoveRow={removeFormulaRow}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Shared: Test Result Preview ────────────────── */

interface TestResult {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  sampleRows?: { value: string; display?: string }[];
  rowCount?: number;
}

function TestPreview({ result }: { result: TestResult }) {
  if (result.status === "idle") return null;

  if (result.status === "loading") {
    return (
      <div className="dim-test dim-test--loading">
        <Loader2 size={13} className="spin" /> Validating...
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="dim-test dim-test--error">
        <AlertCircle size={13} />
        <span>{result.message}</span>
      </div>
    );
  }

  return (
    <div className="dim-test dim-test--success">
      <div className="dim-test-header">
        <CheckCircle2 size={13} />
        <span>Valid — {result.rowCount} value{result.rowCount !== 1 ? "s" : ""} found</span>
      </div>
      {result.sampleRows && result.sampleRows.length > 0 && (
        <div className="dim-test-samples">
          <span className="dim-test-samples-label">Sample values:</span>
          <div className="dim-test-sample-tags">
            {result.sampleRows.map((r, i) => (
              <span key={i} className="dim-test-sample-tag">
                {r.display && r.display !== r.value ? (
                  <>{r.display} <code>{r.value}</code></>
                ) : r.value}
              </span>
            ))}
            {(result.rowCount ?? 0) > (result.sampleRows?.length ?? 0) && (
              <span className="dim-test-sample-more">
                +{(result.rowCount ?? 0) - result.sampleRows.length} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Static Values Editor ───────────────────────── */

function StaticValuesEditor({ values, onAdd, onUpdate, onRemove }: {
  values: DimensionStaticValue[];
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof DimensionStaticValue, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="dim-static">
      <div className="dim-static-header">
        <span className="dim-label">Value &amp; Display Pairs</span>
        <span className="dim-static-hint">
          &ldquo;Value&rdquo; is used in WHERE clauses, &ldquo;Display&rdquo; is shown to users.
          Leave Display blank to use Value as display.
        </span>
      </div>
      <div className="dim-static-rows">
        {values.map((v, i) => (
          <div key={i} className="dim-static-row">
            <input
              className="dim-input"
              placeholder="Value (e.g. NA)"
              value={v.value}
              onChange={(e) => onUpdate(i, "value", e.target.value)}
            />
            <input
              className="dim-input"
              placeholder="Display (e.g. North America)"
              value={v.display}
              onChange={(e) => onUpdate(i, "display", e.target.value)}
            />
            <button className="dim-static-remove" onClick={() => onRemove(i)} title="Remove">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button className="dim-static-add" onClick={onAdd}>
        <Plus size={12} /> Add Value
      </button>
    </div>
  );
}

/* ── Query Source Editor ────────────────────────── */

function QuerySourceEditor({ source, onUpdate }: {
  source: DimensionSource;
  onUpdate: (patch: Partial<DimensionSource>) => void;
}) {
  const [test, setTest] = useState<TestResult>({ status: "idle" });

  const handleTest = useCallback(async () => {
    if (!source.query?.trim()) { setTest({ status: "error", message: "No SQL query provided" }); return; }
    setTest({ status: "loading" });
    try {
      const result = await runQuery(source.query, 1000);
      const valCol = source.valueColumn || result.columns[0];
      const dispCol = source.displayColumn || "";
      const valIdx = result.columns.indexOf(valCol);
      const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
      if (valIdx === -1) { setTest({ status: "error", message: `Value column "${valCol}" not found in results. Available: ${result.columns.join(", ")}` }); return; }
      const samples: { value: string; display?: string }[] = [];
      for (const row of result.rows.slice(0, 10)) {
        const v = String(row[valIdx] ?? "");
        const d = dispIdx >= 0 ? String(row[dispIdx] ?? "") : undefined;
        if (v) samples.push({ value: v, display: d && d !== v ? d : undefined });
      }
      setTest({ status: "success", rowCount: result.rows.length, sampleRows: samples });
    } catch (err) {
      setTest({ status: "error", message: err instanceof Error ? err.message : "Query failed" });
    }
  }, [source.query, source.valueColumn, source.displayColumn]);

  return (
    <div className="dim-query">
      <div className="dim-field dim-field--full">
        <label className="dim-label">SQL Query</label>
        <textarea
          className="dim-textarea"
          rows={3}
          placeholder={"SELECT DISTINCT region_code, region_name\nFROM catalog.schema.dim_regions\nORDER BY region_name"}
          value={source.query ?? ""}
          onChange={(e) => { onUpdate({ query: e.target.value }); setTest({ status: "idle" }); }}
        />
      </div>
      <div className="dim-field-row">
        <div className="dim-field">
          <label className="dim-label">Value Column</label>
          <input
            className="dim-input"
            placeholder="Column for WHERE clause (e.g. region_code)"
            value={source.valueColumn ?? ""}
            onChange={(e) => onUpdate({ valueColumn: e.target.value })}
          />
        </div>
        <div className="dim-field">
          <label className="dim-label">Display Column <span className="dim-optional">(optional)</span></label>
          <input
            className="dim-input"
            placeholder="Column shown to users (e.g. region_name)"
            value={source.displayColumn ?? ""}
            onChange={(e) => onUpdate({ displayColumn: e.target.value })}
          />
        </div>
        <div className="dim-field dim-field--test">
          <button className="dim-test-btn" onClick={handleTest} disabled={test.status === "loading"}>
            {test.status === "loading" ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            Test
          </button>
        </div>
      </div>
      <TestPreview result={test} />
    </div>
  );
}

/* ── Table Source Editor ────────────────────────── */

function TableSourceEditor({ source, onUpdate, defaultCatalog, defaultSchema }: {
  source: DimensionSource;
  onUpdate: (patch: Partial<DimensionSource>) => void;
  defaultCatalog: string;
  defaultSchema: string;
}) {
  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [loadingSch, setLoadingSch] = useState(false);
  const [loadingTbl, setLoadingTbl] = useState(false);
  const [tblColumns, setTblColumns] = useState<string[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [test, setTest] = useState<TestResult>({ status: "idle" });

  const cat = source.tableCatalog || defaultCatalog;
  const sch = source.tableSchema || defaultSchema;
  const tbl = source.tableName || "";

  useEffect(() => {
    setLoadingCat(true);
    fetchCatalogs().then(setCatalogs).catch(() => {}).finally(() => setLoadingCat(false));
  }, []);

  useEffect(() => {
    if (!cat) return;
    setLoadingSch(true);
    fetchSchemas(cat).then(setSchemas).catch(() => {}).finally(() => setLoadingSch(false));
  }, [cat]);

  useEffect(() => {
    if (!cat || !sch) return;
    setLoadingTbl(true);
    fetchTablesIn(cat, sch)
      .then((rows) => setTables(rows.map((r: Record<string, unknown>) => String(r.tableName ?? r.name ?? ""))))
      .catch(() => {})
      .finally(() => setLoadingTbl(false));
  }, [cat, sch]);

  useEffect(() => {
    if (!cat || !sch || !tbl) { setTblColumns([]); return; }
    setLoadingCols(true);
    fetchColumnsIn(cat, sch, tbl)
      .then((res) => setTblColumns(res.columns.map((c) => c.col_name)))
      .catch(() => {})
      .finally(() => setLoadingCols(false));
  }, [cat, sch, tbl]);

  const handleTest = useCallback(async () => {
    if (!tbl) { setTest({ status: "error", message: "No table selected" }); return; }
    setTest({ status: "loading" });
    try {
      const fqTable = cat && sch ? `\`${cat}\`.\`${sch}\`.\`${tbl}\`` : tbl;
      const valCol = source.valueColumn || source.column;
      const dispCol = source.displayColumn || "";
      const selectCols = dispCol && dispCol !== valCol
        ? `\`${valCol}\`, \`${dispCol}\``
        : `\`${valCol}\``;
      const sql = `SELECT DISTINCT ${selectCols} FROM ${fqTable} WHERE \`${valCol}\` IS NOT NULL ORDER BY \`${valCol}\` LIMIT 1000`;
      const result = await runQuery(sql, 1000);
      const valIdx = result.columns.indexOf(valCol);
      const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
      const samples: { value: string; display?: string }[] = [];
      for (const row of result.rows.slice(0, 10)) {
        const v = String(row[valIdx >= 0 ? valIdx : 0] ?? "");
        const d = dispIdx >= 0 ? String(row[dispIdx] ?? "") : undefined;
        if (v) samples.push({ value: v, display: d && d !== v ? d : undefined });
      }
      setTest({ status: "success", rowCount: result.rows.length, sampleRows: samples });
    } catch (err) {
      setTest({ status: "error", message: err instanceof Error ? err.message : "Query failed" });
    }
  }, [cat, sch, tbl, source.valueColumn, source.displayColumn, source.column]);

  return (
    <div className="dim-table-src">
      <div className="dim-field-row">
        <div className="dim-field">
          <label className="dim-label">Catalog</label>
          <select className="dim-select" value={cat} onChange={(e) => { onUpdate({ tableCatalog: e.target.value, tableSchema: "", tableName: "" }); setTest({ status: "idle" }); }} disabled={loadingCat}>
            <option value="">Select...</option>
            {catalogs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dim-field">
          <label className="dim-label">Schema</label>
          <select className="dim-select" value={sch} onChange={(e) => { onUpdate({ tableSchema: e.target.value, tableName: "" }); setTest({ status: "idle" }); }} disabled={loadingSch || !cat}>
            <option value="">Select...</option>
            {schemas.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="dim-field">
          <label className="dim-label">Table</label>
          <select className="dim-select" value={tbl} onChange={(e) => { onUpdate({ tableName: e.target.value }); setTest({ status: "idle" }); }} disabled={loadingTbl || !sch}>
            <option value="">Select...</option>
            {tables.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="dim-field-row">
        <div className="dim-field">
          <label className="dim-label">Value Column</label>
          {tblColumns.length > 0 ? (
            <select className="dim-select" value={source.valueColumn ?? ""} onChange={(e) => onUpdate({ valueColumn: e.target.value })} disabled={loadingCols}>
              <option value="">Select...</option>
              {tblColumns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="dim-input" placeholder="Column for WHERE clause" value={source.valueColumn ?? ""} onChange={(e) => onUpdate({ valueColumn: e.target.value })} />
          )}
        </div>
        <div className="dim-field">
          <label className="dim-label">Display Column <span className="dim-optional">(optional)</span></label>
          {tblColumns.length > 0 ? (
            <select className="dim-select" value={source.displayColumn ?? ""} onChange={(e) => onUpdate({ displayColumn: e.target.value })} disabled={loadingCols}>
              <option value="">(same as value)</option>
              {tblColumns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="dim-input" placeholder="Column shown to users" value={source.displayColumn ?? ""} onChange={(e) => onUpdate({ displayColumn: e.target.value })} />
          )}
        </div>
        <div className="dim-field dim-field--test">
          <button className="dim-test-btn" onClick={handleTest} disabled={test.status === "loading"}>
            {test.status === "loading" ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            Test
          </button>
        </div>
      </div>
      <TestPreview result={test} />
    </div>
  );
}

/* ── Formula Source Editor (with column autocomplete) ── */

function FormulaSourceEditor({ source, onUpdate, fqTable, allColumns, aliases, onAddRow, onUpdateRow, onRemoveRow }: {
  source: DimensionSource;
  onUpdate: (patch: Partial<DimensionSource>) => void;
  fqTable: string;
  allColumns: string[];
  aliases: Record<string, string>;
  onAddRow: () => void;
  onUpdateRow: (idx: number, field: keyof DimensionStaticValue, val: string) => void;
  onRemoveRow: (idx: number) => void;
}) {
  const [test, setTest] = useState<TestResult>({ status: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [acState, setAcState] = useState<{ matches: string[]; idx: number; pos: { top: number; left: number } } | null>(null);

  const WORD_BREAK = /[\s,()=<>!+\-*/|&^~;]/;

  const getPartialWord = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return "";
    const pos = ta.selectionStart;
    const text = ta.value.slice(0, pos);
    let start = text.length;
    while (start > 0 && !WORD_BREAK.test(text[start - 1])) start--;
    return text.slice(start);
  }, []);

  const updateAutocomplete = useCallback(() => {
    const partial = getPartialWord().toLowerCase();
    if (partial.length === 0) { setAcState(null); return; }
    const matches = allColumns.filter((c) => c.toLowerCase().includes(partial));
    if (matches.length === 0 || (matches.length === 1 && matches[0].toLowerCase() === partial)) {
      setAcState(null);
      return;
    }
    const ta = textareaRef.current;
    if (!ta) return;
    const rect = ta.getBoundingClientRect();
    const lineH = 18;
    const text = ta.value.slice(0, ta.selectionStart);
    const lines = text.split("\n");
    const row = lines.length - 1;
    const col = lines[lines.length - 1].length;
    const charW = 7.8;
    setAcState({
      matches: matches.slice(0, 8),
      idx: 0,
      pos: {
        top: (row + 1) * lineH - ta.scrollTop + 4,
        left: Math.min(col * charW, rect.width - 180),
      },
    });
  }, [allColumns, getPartialWord]);

  const insertColumn = useCallback((col: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const text = ta.value;
    let start = pos;
    while (start > 0 && !WORD_BREAK.test(text[start - 1])) start--;
    const before = text.slice(0, start);
    const after = text.slice(pos);
    const inserted = `\`${col}\``;
    const newVal = before + inserted + after;
    onUpdate({ formula: newVal });
    setAcState(null);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + inserted.length;
      ta.setSelectionRange(caret, caret);
    });
  }, [onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!acState) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcState((s) => s ? { ...s, idx: Math.min(s.idx + 1, s.matches.length - 1) } : null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcState((s) => s ? { ...s, idx: Math.max(s.idx - 1, 0) } : null);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertColumn(acState.matches[acState.idx]);
    } else if (e.key === "Escape") {
      setAcState(null);
    }
  }, [acState, insertColumn]);

  const handleTest = useCallback(async () => {
    if (!source.formula?.trim()) { setTest({ status: "error", message: "No formula expression provided" }); return; }
    if (!fqTable) { setTest({ status: "error", message: "No main table configured" }); return; }
    setTest({ status: "loading" });
    try {
      const sql = `SELECT DISTINCT (${source.formula}) AS _formula_val FROM ${fqTable} WHERE (${source.formula}) IS NOT NULL ORDER BY 1 LIMIT 100`;
      const result = await runQuery(sql, 100);
      const samples: { value: string }[] = [];
      for (const row of result.rows.slice(0, 10)) {
        const v = String(row[0] ?? "");
        if (v) samples.push({ value: v });
      }
      setTest({ status: "success", rowCount: result.rows.length, sampleRows: samples });
    } catch (err) {
      setTest({ status: "error", message: err instanceof Error ? err.message : "Formula validation failed" });
    }
  }, [source.formula, fqTable]);

  return (
    <div className="dim-formula">
      <div className="dim-field dim-field--full">
        <label className="dim-label">SQL Formula Expression</label>
        <span className="dim-static-hint">
          A SQL expression evaluated against the main table. Start typing a column name to see suggestions.
        </span>
        <div className="formula-editor-wrap">
          <textarea
            ref={textareaRef}
            className="dim-textarea dim-textarea--formula"
            rows={4}
            placeholder={"CASE\n  WHEN amount > 1000 THEN 'High'\n  WHEN amount > 100  THEN 'Medium'\n  ELSE 'Low'\nEND"}
            value={source.formula ?? ""}
            onChange={(e) => { onUpdate({ formula: e.target.value }); setTest({ status: "idle" }); }}
            onKeyUp={updateAutocomplete}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setAcState(null), 150)}
          />
          {acState && (
            <div className="formula-ac-dropdown" style={{ top: acState.pos.top, left: acState.pos.left }}>
              {acState.matches.map((col, i) => (
                <button
                  key={col}
                  className={`formula-ac-item${i === acState.idx ? " formula-ac-item--active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); insertColumn(col); }}
                >
                  <code>{col}</code>
                  {aliases[col] && <span className="formula-ac-alias">{aliases[col]}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dim-formula-test-row">
          <button className="dim-test-btn" onClick={handleTest} disabled={test.status === "loading"}>
            {test.status === "loading" ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            Test Formula
          </button>
        </div>
      </div>

      <TestPreview result={test} />

      <div className="dim-static">
        <div className="dim-static-header">
          <span className="dim-label">Predefined Values</span>
          <span className="dim-static-hint">
            Define the possible output values of the formula. Users will select from this list.
            Leave blank to auto-detect from the formula test results.
          </span>
        </div>
        <div className="dim-static-rows">
          {(source.formulaValues ?? []).map((v, i) => (
            <div key={i} className="dim-static-row">
              <input
                className="dim-input"
                placeholder="Value (e.g. High)"
                value={v.value}
                onChange={(e) => onUpdateRow(i, "value", e.target.value)}
              />
              <input
                className="dim-input"
                placeholder="Display (optional)"
                value={v.display}
                onChange={(e) => onUpdateRow(i, "display", e.target.value)}
              />
              <button className="dim-static-remove" onClick={() => onRemoveRow(i)} title="Remove">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button className="dim-static-add" onClick={onAddRow}>
          <Plus size={12} /> Add Value
        </button>
      </div>
    </div>
  );
}

export default DimensionSourcesSection;
