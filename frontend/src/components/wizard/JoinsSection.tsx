import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Plus, Trash2, X, ChevronDown, Check, GitMerge,
  ArrowRight as ArrowRightIcon,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { fetchColumnsIn, fetchTablesIn } from "@/lib/api";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { JoinConfig, JoinType, ColumnMeta } from "@/types/dashboard";

const JOIN_TYPES: { id: JoinType; label: string; desc: string }[] = [
  { id: "LEFT", label: "LEFT JOIN", desc: "All rows from the primary table, matching rows from the joined table" },
  { id: "INNER", label: "INNER JOIN", desc: "Only rows that match in both tables" },
  { id: "RIGHT", label: "RIGHT JOIN", desc: "All rows from the joined table, matching rows from the primary table" },
];

function SearchableDropdown({ value, options, placeholder, loading, disabled, onChange }: {
  value: string;
  options: string[];
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="join-searchable" ref={wrapRef}>
      <div className={`join-search-trigger${disabled ? " disabled" : ""}`} onClick={() => !disabled && setOpen(!open)}>
        <span className={value ? "join-search-val" : "join-search-placeholder"}>
          {loading ? "Loading..." : value || placeholder}
        </span>
        <ChevronDown size={12} />
      </div>
      {open && !disabled && (
        <div className="join-search-dropdown">
          <div className="join-search-input-wrap">
            <Search size={12} />
            <input
              className="join-search-input"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button className="join-search-clear" onClick={() => setQuery("")}><X size={10} /></button>
            )}
          </div>
          <div className="join-search-list">
            {value && (
              <button className="join-search-opt join-search-opt--clear" onClick={() => handleSelect("")}>
                — Clear selection —
              </button>
            )}
            {filtered.length === 0 && (
              <div className="join-search-empty">No matches</div>
            )}
            {filtered.map((o) => (
              <button
                key={o}
                className={`join-search-opt${o === value ? " join-search-opt--active" : ""}`}
                onClick={() => handleSelect(o)}
              >
                {o}
                {o === value && <Check size={10} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JoinsSection({ catalog, schema, primaryTable, primaryColumns, joins, onChange }: {
  catalog: string;
  schema: string;
  primaryTable: string;
  primaryColumns: string[];
  joins: JoinConfig[];
  onChange: (joins: JoinConfig[]) => void;
}) {
  const [tables, setTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [joinColsCache, setJoinColsCache] = useState<Record<string, string[]>>({});
  const [loadingCols, setLoadingCols] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!catalog || !schema) return;
    setLoadingTables(true);
    fetchTablesIn(catalog, schema)
      .then((rows) => {
        const names = rows.map(
          (r: Record<string, unknown>) => (r.tableName ?? r.table_name ?? Object.values(r)[1] ?? Object.values(r)[0]) as string,
        ).filter((t: string) => t !== primaryTable);
        setTables(names);
      })
      .catch(() => {})
      .finally(() => setLoadingTables(false));
  }, [catalog, schema, primaryTable]);

  const loadJoinCols = async (table: string) => {
    if (joinColsCache[table] || loadingCols[table]) return;
    setLoadingCols((p) => ({ ...p, [table]: true }));
    try {
      const res = await fetchColumnsIn(catalog, schema, table);
      setJoinColsCache((p) => ({ ...p, [table]: res.columns.map((c: ColumnMeta) => c.col_name) }));
    } catch { toast.error("Failed to load columns"); }
    setLoadingCols((p) => ({ ...p, [table]: false }));
  };

  const addJoin = () => {
    onChange([...joins, {
      id: `join-${Date.now()}`,
      table: "",
      joinType: "LEFT",
      leftKey: "",
      rightKey: "",
    }]);
  };

  const updateJoin = (id: string, patch: Partial<JoinConfig>) => {
    onChange(joins.map((j) => j.id === id ? { ...j, ...patch } : j));
  };

  const removeJoin = (id: string) => {
    onChange(joins.filter((j) => j.id !== id));
    setConfirmDelete(null);
  };

  const handleTableSelect = (id: string, table: string) => {
    updateJoin(id, { table, rightKey: "" });
    if (table) loadJoinCols(table);
  };

  return (
    <div className="joins-section">
      <div className="dim-info-banner">
        <div className="dim-info-icon"><GitMerge size={16} /></div>
        <div className="dim-info-text">
          <strong>Table Joins</strong> — Optionally join secondary tables to your primary table.
          Columns from joined tables appear as a separate group in the sidebar. The join is only
          applied when users select columns from multiple tables — single-table queries stay fast.
        </div>
      </div>

      {joins.length === 0 ? (
        <div className="dim-empty">
          <GitMerge size={24} />
          <p>No joins configured.</p>
          <p className="dim-empty-hint">
            Add a join to combine data from multiple tables. Users can pick columns from any
            configured table — the query engine joins them automatically when needed.
          </p>
          <button className="dim-add-btn" onClick={addJoin}>
            <Plus size={14} /> Add Join
          </button>
        </div>
      ) : (
        <>
          <div className="joins-list">
            {joins.map((j, idx) => {
              const rightCols = j.table ? joinColsCache[j.table] ?? [] : [];
              const isLoadingRight = j.table ? loadingCols[j.table] ?? false : false;
              return (
                <div key={j.id} className="join-card">
                  <div className="join-card-header">
                    <span className="join-card-num">Join {idx + 1}</span>
                    <button className="dim-remove-btn" onClick={() => setConfirmDelete(j.id)} title="Remove">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="join-card-row">
                    <label className="join-label">Join Type</label>
                    <select
                      className="join-select"
                      value={j.joinType}
                      onChange={(e) => updateJoin(j.id, { joinType: e.target.value as JoinType })}
                    >
                      {JOIN_TYPES.map((jt) => (
                        <option key={jt.id} value={jt.id} title={jt.desc}>{jt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="join-card-row">
                    <label className="join-label">Table</label>
                    <SearchableDropdown
                      value={j.table}
                      options={tables}
                      placeholder="Search & select table..."
                      loading={loadingTables}
                      onChange={(t) => handleTableSelect(j.id, t)}
                    />
                  </div>

                  <div className="join-card-keys">
                    <div className="join-key-col">
                      <label className="join-label">Primary Key ({primaryTable})</label>
                      <SearchableDropdown
                        value={j.leftKey}
                        options={primaryColumns}
                        placeholder="Search column..."
                        onChange={(c) => updateJoin(j.id, { leftKey: c })}
                      />
                    </div>
                    <ArrowRightIcon size={16} className="join-arrow" />
                    <div className="join-key-col">
                      <label className="join-label">Foreign Key ({j.table || "..."})</label>
                      <SearchableDropdown
                        value={j.rightKey}
                        options={rightCols}
                        placeholder={isLoadingRight ? "Loading..." : "Search column..."}
                        loading={isLoadingRight}
                        disabled={!j.table || isLoadingRight}
                        onChange={(c) => updateJoin(j.id, { rightKey: c })}
                      />
                    </div>
                  </div>

                  {j.table && j.leftKey && j.rightKey && (
                    <div className="join-preview">
                      <code>
                        {j.joinType} JOIN `{catalog}`.`{schema}`.`{j.table}` ON `{primaryTable}`.`{j.leftKey}` = `{j.table}`.`{j.rightKey}`
                      </code>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="dim-add-btn" onClick={addJoin} style={{ marginTop: 12 }}>
            <Plus size={14} /> Add Another Join
          </button>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove Join"
          message="Are you sure you want to remove this join? Columns from the joined table will no longer be available."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => removeJoin(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
