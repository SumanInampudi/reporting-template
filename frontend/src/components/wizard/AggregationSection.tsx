import { useMemo, useState } from "react";
import { Hash, Search, Sigma, X } from "lucide-react";
import { NUMERIC_RE } from "@/lib/constants";
import type { ColumnAggregation, ColumnMeta } from "@/types/dashboard";

interface AggregationSectionProps {
  columnMetas: ColumnMeta[];
  columnTypeOverrides: Record<string, string>;
  aliases: Record<string, string>;
  aggregations: Record<string, ColumnAggregation>;
  onChange: (aggs: Record<string, ColumnAggregation>) => void;
  primaryTable?: string;
}

const AGG_OPTS: { id: ColumnAggregation; label: string }[] = [
  { id: "SUM", label: "SUM" },
  { id: "AVG", label: "AVG" },
  { id: "COUNT", label: "COUNT" },
  { id: "COUNT_DISTINCT", label: "DISTINCT" },
  { id: "MIN", label: "MIN" },
  { id: "MAX", label: "MAX" },
  { id: "NONE", label: "NONE" },
];

export default function AggregationSection({ columnMetas, columnTypeOverrides, aliases, aggregations, onChange, primaryTable }: AggregationSectionProps) {
  const [search, setSearch] = useState("");
  const [selAgg, setSelAgg] = useState<Set<string>>(new Set());
  const hasJoinedCols = columnMetas.some((c) => c.source_table && c.source_table !== primaryTable);

  const effectiveMetas = useMemo(
    () => columnMetas.map((c) => columnTypeOverrides[c.col_name]
      ? { ...c, data_type: columnTypeOverrides[c.col_name] }
      : c),
    [columnMetas, columnTypeOverrides],
  );

  const measures = useMemo(
    () => effectiveMetas.filter((c) => NUMERIC_RE.test(c.data_type)),
    [effectiveMetas],
  );
  const dimensions = useMemo(
    () => effectiveMetas.filter((c) => !NUMERIC_RE.test(c.data_type)),
    [effectiveMetas],
  );

  const filteredMeasures = useMemo(() => {
    if (!search.trim()) return measures;
    const q = search.toLowerCase();
    return measures.filter(
      (c) => c.col_name.toLowerCase().includes(q) || (aliases[c.col_name] ?? "").toLowerCase().includes(q),
    );
  }, [measures, search, aliases]);

  const setAgg = (col: string, agg: ColumnAggregation) => {
    onChange({ ...aggregations, [col]: agg });
  };

  const removeAgg = (col: string) => {
    onChange({ ...aggregations, [col]: "NONE" });
  };

  const setAllMeasures = (agg: ColumnAggregation) => {
    const next = { ...aggregations };
    for (const m of measures) next[m.col_name] = agg;
    onChange(next);
  };

  const toggleSelAgg = (col: string) => {
    setSelAgg((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  };
  const toggleAllAgg = () => {
    const names = filteredMeasures.map((c) => c.col_name);
    if (selAgg.size === names.length) { setSelAgg(new Set()); } else { setSelAgg(new Set(names)); }
  };
  const bulkSetAgg = (agg: ColumnAggregation) => {
    const next = { ...aggregations };
    for (const col of selAgg) next[col] = agg;
    onChange(next);
    setSelAgg(new Set());
  };

  return (
    <div className="agg-section">
      <div className="agg-toolbar">
        <div className="agg-search-bar">
          <Search size={14} />
          <input
            className="alias-search-input"
            placeholder="Search measures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="agg-bulk">
          <span className="agg-bulk-label">Set all measures to:</span>
          {AGG_OPTS.slice(0, 4).map((opt) => (
            <button
              key={opt.id}
              className="agg-bulk-btn"
              onClick={() => setAllMeasures(opt.id)}
              title={`Set all measures to ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {selAgg.size > 0 && (
        <div className="alias-bulk-bar">
          <span className="alias-bulk-count">{selAgg.size} selected</span>
          {AGG_OPTS.map((opt) => (
            <button key={opt.id} className="alias-bulk-btn" onClick={() => bulkSetAgg(opt.id)}>
              {opt.label}
            </button>
          ))}
          <button className="alias-bulk-btn alias-bulk-btn--clear" onClick={() => setSelAgg(new Set())}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      <div className="agg-summary">
        <span className="agg-summary-item">
          <Sigma size={13} /> <strong>{measures.length}</strong> measures
        </span>
        <span className="agg-summary-item">
          <Hash size={13} /> <strong>{dimensions.length}</strong> dimensions
        </span>
        <span className="agg-summary-hint">
          Dimensions are automatically included in GROUP BY ALL
        </span>
      </div>

      <div className="alias-table-wrap">
        <table className="alias-table">
          <thead>
            <tr>
              <th className="alias-th-check">
                <input
                  type="checkbox"
                  checked={filteredMeasures.length > 0 && selAgg.size === filteredMeasures.length}
                  onChange={toggleAllAgg}
                  title="Select all visible measures"
                />
              </th>
              <th className="alias-th-col">Column</th>
              {hasJoinedCols && <th className="alias-th-source">Source</th>}
              <th className="alias-th-alias">Display Name</th>
              <th className="agg-th-type">Data Type</th>
              <th className="agg-th-agg">Aggregation</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeasures.map((col) => {
              const agg = aggregations[col.col_name] ?? "SUM";
              return (
                <tr key={col.col_name} className={`alias-row${selAgg.has(col.col_name) ? " alias-row--selected" : ""}`}>
                  <td className="alias-col-check">
                    <input
                      type="checkbox"
                      checked={selAgg.has(col.col_name)}
                      onChange={() => toggleSelAgg(col.col_name)}
                    />
                  </td>
                  <td className="alias-col-name" title={col.col_name}><code>{col.col_name}</code></td>
                  {hasJoinedCols && (
                    <td className="alias-col-source">
                      <span className={`alias-source-badge${col.source_table && col.source_table !== primaryTable ? " alias-source-badge--joined" : ""}`}>
                        {col.source_table ?? primaryTable ?? "—"}
                      </span>
                    </td>
                  )}
                  <td className="alias-col-alias">{aliases[col.col_name] ?? col.col_name}</td>
                  <td className="agg-col-type"><code>{col.data_type}</code></td>
                  <td className="agg-col-agg">
                    <select
                      className="agg-select"
                      value={agg}
                      onChange={(e) => setAgg(col.col_name, e.target.value as ColumnAggregation)}
                    >
                      {AGG_OPTS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      className="agg-remove-btn"
                      onClick={() => removeAgg(col.col_name)}
                      title="Remove aggregation (treat as dimension)"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredMeasures.length === 0 && (
              <tr>
                <td colSpan={hasJoinedCols ? 6 : 5} className="agg-empty">
                  {measures.length === 0 ? "No numeric columns detected" : "No matches"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
