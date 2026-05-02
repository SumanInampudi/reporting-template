import { useState } from "react";
import { Database, Filter, Clock, Rows3, Columns3, AlertCircle, Save, Timer, Server, Keyboard } from "lucide-react";
import { useStore } from "@/hooks/useStore";

const IS_MAC = navigator.platform.toUpperCase().includes("MAC");
const MOD = IS_MAC ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { keys: `${MOD} + Enter`, action: "Load Data" },
  { keys: `${MOD} + E`, action: "Export CSV" },
  { keys: `${MOD} + S`, action: "Save Preset" },
  { keys: "F11", action: "Focus Mode" },
  { keys: "Esc", action: "Exit Focus" },
];

function ShortcutHelp() {
  const [show, setShow] = useState(false);
  return (
    <span
      className="status-bar-item status-bar-shortcuts"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Keyboard size={11} /> Shortcuts
      {show && (
        <div className="shortcut-popup">
          <div className="shortcut-popup-title">Keyboard Shortcuts</div>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="shortcut-row">
              <span className="shortcut-action">{s.action}</span>
              <span className="shortcut-keys">
                {s.keys.split(" + ").map((k, i) => (
                  <span key={i}>
                    {i > 0 && <span className="shortcut-plus">+</span>}
                    <kbd className="shortcut-kbd">{k}</kbd>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function StatusBar() {
  const {
    selectedCatalog, selectedSchema, selectedTable,
    baseDataset, appliedFilters, lastRefreshTime,
    selectedOutputColumns, isDirty, activePresetId,
    filters, lastQueryMs, estimatedRowCount,
  } = useStore();

  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const fqTable = isCustomQuery
    ? "Custom Query"
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : null);

  const previewCount = baseDataset?.rows.length ?? 0;
  const totalRows = estimatedRowCount ?? previewCount;
  const colCount = baseDataset?.columns.filter((c) => c !== "__row_number__" && c !== "__row_count__").length ?? 0;
  const filterCount = appliedFilters.filter(
    (f) => f.selectedValues.length > 0 || (f.dateFrom && f.dateTo),
  ).length;

  const hasUnapplied = (() => {
    if (filters.length !== appliedFilters.length) return true;
    return filters.some((f) => {
      const af = appliedFilters.find((a) => a.id === f.id);
      if (!af) return true;
      return f.selectedValues.length !== af.selectedValues.length ||
        f.selectedValues.some((v, i) => v !== af.selectedValues[i]);
    });
  })();

  const dirty = isDirty();
  const hasPreset = !!activePresetId;

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        {fqTable && (
          <span className="status-bar-item">
            <Database size={11} /> {fqTable}
          </span>
        )}
        {selectedOutputColumns.length > 0 && (
          <span className="status-bar-item">
            <Columns3 size={11} /> {selectedOutputColumns.length} cols
          </span>
        )}
      </div>

      <div className="status-bar-center">
        {hasUnapplied && (
          <span className="status-bar-item status-bar-item--warn">
            <AlertCircle size={11} /> Unapplied filter changes — click Load Data to apply
          </span>
        )}
        {dirty && hasPreset && (
          <span className="status-bar-item status-bar-item--warn">
            <Save size={11} /> Unsaved changes — please save the preset to retain your changes
          </span>
        )}
      </div>

      <div className="status-bar-right">
        {filterCount > 0 && (
          <span className="status-bar-item">
            <Filter size={11} /> {filterCount} filter{filterCount !== 1 ? "s" : ""}
          </span>
        )}
        {previewCount > 0 && (
          <span className="status-bar-item">
            <Rows3 size={11} /> {totalRows.toLocaleString()} rows &times; {colCount} cols
          </span>
        )}
        {baseDataset && (
          <span className="status-bar-item" title="Charts and pivot run aggregation queries server-side">
            <Server size={11} /> Server-side
          </span>
        )}
        {lastQueryMs !== null && (
          <span className="status-bar-item status-bar-item--accent">
            <Timer size={11} /> {fmtMs(lastQueryMs)}
          </span>
        )}
        {lastRefreshTime && (
          <span className="status-bar-item status-bar-item--accent">
            <Clock size={11} /> {lastRefreshTime}
          </span>
        )}
        <ShortcutHelp />
      </div>
    </footer>
  );
}
