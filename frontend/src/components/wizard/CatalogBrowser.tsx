import { useEffect, useRef, useState } from "react";
import {
  Check, ChevronRight, Database, FolderOpen, Loader2,
  Search, SearchX, Table2, Info,
} from "lucide-react";
import type { ConnectionSetup } from "@/hooks/useConnectionSetup";

type Level = "catalog" | "schema" | "table";

const LEVEL_META: Record<Level, { label: string; icon: typeof Database }> = {
  catalog: { label: "Catalog", icon: Database },
  schema: { label: "Schema", icon: FolderOpen },
  table: { label: "Table", icon: Table2 },
};

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="cb-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** Parse shorthand like "1M", "500K", "2m", "100k" into a number. Returns 0 for empty/invalid. */
function parseRowLimit(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([kKmM]?)$/);
  if (!match) return Number(trimmed) || 0;
  const num = parseFloat(match[1]);
  const suffix = match[2].toLowerCase();
  if (suffix === "k") return Math.round(num * 1_000);
  if (suffix === "m") return Math.round(num * 1_000_000);
  return Math.round(num);
}

/** Format a number to shorthand: 1000000 → "1M", 500000 → "500K", 0 → "" */
function formatRowLimit(value: number): string {
  if (!value || value <= 0) return "";
  if (value >= 1_000_000 && value % 1_000_000 === 0) return `${value / 1_000_000}M`;
  if (value >= 1_000 && value % 1_000 === 0) return `${value / 1_000}K`;
  return value.toLocaleString();
}

interface Props {
  conn: ConnectionSetup;
  rowLimit: number;
  onRowLimitChange: (v: number) => void;
}

export default function CatalogBrowser({ conn, rowLimit, onRowLimitChange }: Props) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeLevel: Level = !conn.selectedCatalog
    ? "catalog"
    : !conn.selectedSchema
      ? "schema"
      : "table";

  const items =
    activeLevel === "catalog" ? conn.catalogs :
    activeLevel === "schema" ? conn.schemas :
    conn.tables;

  const loading =
    activeLevel === "catalog" ? conn.catalogsLoading :
    activeLevel === "schema" ? conn.schemasLoading :
    conn.tablesLoading;

  const filtered = query
    ? items.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    setQuery("");
    setHighlighted(0);
  }, [activeLevel]);

  useEffect(() => setHighlighted(0), [query]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [activeLevel]);

  const handleSelect = (val: string) => {
    if (activeLevel === "catalog") conn.handleCatalogChange(val);
    else if (activeLevel === "schema") conn.handleSchemaChange(val);
    else conn.setSelectedTable(val);
    setQuery("");
  };

  const handleBreadcrumbClick = (level: Level) => {
    if (level === "catalog") {
      conn.handleCatalogChange("");
    } else if (level === "schema") {
      conn.handleSchemaChange("");
    } else {
      conn.setSelectedTable("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
      scrollIntoView(highlighted + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      scrollIntoView(highlighted - 1);
    } else if (e.key === "Enter" && filtered[highlighted]) {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    } else if (e.key === "Backspace" && !query) {
      if (activeLevel === "table") handleBreadcrumbClick("schema");
      else if (activeLevel === "schema") handleBreadcrumbClick("catalog");
    }
  };

  const scrollIntoView = (idx: number) => {
    if (!listRef.current) return;
    const el = listRef.current.children[idx];
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  };

  const selectedValue =
    activeLevel === "catalog" ? "" :
    activeLevel === "schema" ? conn.selectedCatalog :
    conn.selectedTable;

  const allDone = !!conn.selectedCatalog && !!conn.selectedSchema && !!conn.selectedTable;

  const meta = LEVEL_META[activeLevel];
  const Icon = meta.icon;

  return (
    <div className="cb-root">
      {/* ── Header row ── */}
      <div className="cb-header">
        <div className="cb-header-left">
          <h2 className="cb-title">Data Source</h2>
          <p className="cb-subtitle">Navigate to your target table</p>
        </div>
        <div className="cb-conn-status">
          {conn.connTesting ? (
            <span className="cb-badge cb-badge--loading">
              <Loader2 size={12} className="spin" /> Connecting…
            </span>
          ) : conn.connStatus?.ok ? (
            <span className="cb-badge cb-badge--ok">
              <Check size={12} /> Connected
            </span>
          ) : (
            <span className="cb-badge cb-badge--fail">
              {conn.connStatus?.message ?? "Not tested"}
            </span>
          )}
        </div>
      </div>

      {/* ── Breadcrumb path ── */}
      <div className="cb-breadcrumb">
        <button
          className={`cb-crumb ${!conn.selectedCatalog ? "cb-crumb--active" : "cb-crumb--done"}`}
          onClick={() => conn.selectedCatalog && handleBreadcrumbClick("catalog")}
          type="button"
        >
          <Database size={13} />
          <span>{conn.selectedCatalog || "Catalog"}</span>
        </button>

        <ChevronRight size={12} className="cb-crumb-sep" />

        <button
          className={`cb-crumb ${
            conn.selectedCatalog && !conn.selectedSchema
              ? "cb-crumb--active"
              : conn.selectedSchema
                ? "cb-crumb--done"
                : "cb-crumb--disabled"
          }`}
          onClick={() => conn.selectedSchema && handleBreadcrumbClick("schema")}
          disabled={!conn.selectedCatalog}
          type="button"
        >
          <FolderOpen size={13} />
          <span>{conn.selectedSchema || "Schema"}</span>
        </button>

        <ChevronRight size={12} className="cb-crumb-sep" />

        <button
          className={`cb-crumb ${
            conn.selectedSchema && !conn.selectedTable
              ? "cb-crumb--active"
              : conn.selectedTable
                ? "cb-crumb--done"
                : "cb-crumb--disabled"
          }`}
          onClick={() => conn.selectedTable && handleBreadcrumbClick("table")}
          disabled={!conn.selectedSchema}
          type="button"
        >
          <Table2 size={13} />
          <span>{conn.selectedTable || "Table"}</span>
        </button>
      </div>

      {/* ── Active panel ── */}
      {allDone ? (
        <>
          <div className="cb-done-panel">
            <div className="cb-done-icon"><Check size={28} /></div>
            <div className="cb-done-text">
              <span className="cb-done-label">Selected table</span>
              <span className="cb-done-path">
                {conn.selectedCatalog}.{conn.selectedSchema}.{conn.selectedTable}
              </span>
            </div>
            <button
              className="cb-done-change"
              onClick={() => conn.setSelectedTable("")}
              type="button"
            >
              Change
            </button>
          </div>
          <RowLimitField value={rowLimit} onChange={onRowLimitChange} />
        </>
      ) : (
        <div className="cb-panel" onKeyDown={handleKeyDown}>
          {/* Panel header with level label + search */}
          <div className="cb-panel-header">
            <div className="cb-panel-level">
              <Icon size={14} />
              <span>Select {meta.label}</span>
              {!loading && filtered.length > 0 && (
                <span className="cb-panel-count">{filtered.length}</span>
              )}
            </div>
            <div className="cb-search-wrap">
              <Search size={13} className="cb-search-icon" />
              <input
                ref={inputRef}
                className="cb-search"
                placeholder={`Filter ${meta.label.toLowerCase()}s…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <span className="cb-search-count">
                  {filtered.length} {filtered.length === 1 ? "match" : "matches"}
                </span>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="cb-list" ref={listRef}>
            {loading ? (
              <div className="cb-empty">
                <Loader2 size={20} className="spin" />
                <span>Loading {meta.label.toLowerCase()}s…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="cb-empty">
                <SearchX size={20} />
                <span>
                  {query
                    ? <>No {meta.label.toLowerCase()}s matching "<strong>{query}</strong>"</>
                    : `No ${meta.label.toLowerCase()}s available`
                  }
                </span>
              </div>
            ) : (
              filtered.map((item, i) => (
                <button
                  key={item}
                  className={`cb-item ${i === highlighted ? "cb-item--hl" : ""} ${item === selectedValue ? "cb-item--sel" : ""}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlighted(i)}
                  type="button"
                >
                  <Icon size={14} className="cb-item-icon" />
                  <span className="cb-item-name">
                    <HighlightMatch text={item} query={query} />
                  </span>
                  <ChevronRight size={12} className="cb-item-arrow" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RowLimitField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(() => formatRowLimit(value));
  const [showHelp, setShowHelp] = useState(false);

  const handleBlur = () => {
    const parsed = parseRowLimit(text);
    onChange(parsed);
    setText(formatRowLimit(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
  };

  return (
    <div className="cb-row-limit">
      <div className="cb-row-limit-header">
        <label className="cb-row-limit-label">
          Max Row Limit
          <span className="wizard-label-opt"> (optional)</span>
        </label>
        <button
          type="button"
          className="row-limit-help-btn"
          onClick={() => setShowHelp((v) => !v)}
          title="How does this work?"
        >
          <Info size={14} />
        </button>
      </div>
      <input
        className="wizard-input cb-row-limit-input"
        placeholder="e.g. 1M, 500K, 100000 — leave empty for no limit"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <p className="cb-row-limit-hint">
        {value > 0
          ? <>Limit: <strong>{value.toLocaleString()}</strong> rows</>
          : "No limit — all matching rows will be fetched"}
      </p>
      {showHelp && (
        <div className="cb-row-limit-help">
          <p><strong>How it works:</strong> Before loading data, the app runs a fast <code>COUNT(*)</code> to check the result size. If it exceeds this limit, you'll be prompted to refine your filters instead of running a heavy query.</p>
          <p>Supports shorthand: <code>1M</code> = 1,000,000 · <code>500K</code> = 500,000 · <code>2.5M</code> = 2,500,000</p>
        </div>
      )}
    </div>
  );
}
