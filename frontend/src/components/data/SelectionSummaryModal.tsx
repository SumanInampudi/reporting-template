import { useEffect, useRef, useState } from "react";
import {
  X, Copy, Check, Database, Columns3, Filter, FunctionSquare, Sigma, Rows3,
  ChevronDown,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { useDraggableModal } from "@/hooks/useDraggableModal";

interface Props { onClose: () => void }

function Section({ icon, title, count, children }: {
  icon: React.ReactNode; title: string; count: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div className="ss-section">
      <button className="ss-section-hdr" onClick={() => setOpen((v) => !v)}>
        <ChevronDown size={12} className={`ss-chevron${open ? " ss-chevron--open" : ""}`} />
        {icon}
        <span className="ss-section-title">{title}</span>
        <span className="ss-section-count">{count}</span>
      </button>
      {open && <div className="ss-section-body">{children}</div>}
    </div>
  );
}

function filterSummary(f: ReturnType<typeof useStore.getState>["filters"][number], alias: (c: string) => string): string {
  const name = alias(f.column);
  if (f.filterType === "date_range" || f.filterType === "date_relative") {
    if (f.datePreset && f.datePreset !== "custom") return `${name}: ${f.datePreset.replace(/_/g, " ")}`;
    if (f.dateFrom && f.dateTo) return `${name}: ${f.dateFrom} → ${f.dateTo}`;
    return `${name}: (date filter)`;
  }
  if (f.filterType === "numeric_range" && f.numericOp) {
    const opLabel: Record<string, string> = { "=": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤", between: "between" };
    const op = opLabel[f.numericOp] ?? f.numericOp;
    if (f.numericOp === "between") return `${name} ${op} ${f.numericValue ?? ""} and ${f.numericValue2 ?? ""}`;
    return `${name} ${op} ${f.numericValue ?? ""}`;
  }
  if (f.selectedValues.length === 0) return `${name}: (no selection)`;
  if (f.selectedValues.length <= 3) return `${name}: ${f.selectedValues.join(", ")}`;
  return `${name}: ${f.selectedValues.slice(0, 3).join(", ")} +${f.selectedValues.length - 3} more`;
}

export default function SelectionSummaryModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const colAlias = useColumnAlias();
  const { offset, handleMouseDown } = useDraggableModal();

  const {
    selectedCatalog, selectedSchema, selectedTable,
    selectedOutputColumns, formulaColumns,
    filters, dynamicFilters,
    activeWorkspace, effectiveRowLimit,
  } = useStore();

  const aggs = activeWorkspace?.column_aggregations ?? {};
  const aggEntries = Object.entries(aggs).filter(([col]) => selectedOutputColumns.includes(col));
  const limit = effectiveRowLimit();
  const fqTable = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;
  const enabledDynamic = dynamicFilters.filter((d) => d.enabled);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const buildPlainText = (): string => {
    const lines: string[] = ["=== Selection Summary ===", ""];
    if (fqTable) lines.push(`Table: ${fqTable}`, "");
    if (selectedOutputColumns.length > 0) {
      lines.push(`Columns (${selectedOutputColumns.length}):`);
      selectedOutputColumns.forEach((c) => lines.push(`  • ${colAlias(c)}`));
      lines.push("");
    }
    if (formulaColumns.length > 0) {
      lines.push(`Custom Columns (${formulaColumns.length}):`);
      formulaColumns.forEach((fc) => lines.push(`  • ${fc.alias} = ${fc.expression}`));
      lines.push("");
    }
    if (filters.length > 0) {
      lines.push(`Filters (${filters.length}):`);
      filters.forEach((f) => lines.push(`  • ${filterSummary(f, colAlias)}`));
      lines.push("");
    }
    if (enabledDynamic.length > 0) {
      lines.push(`Dynamic Filters (${enabledDynamic.length}):`);
      enabledDynamic.forEach((d) => lines.push(`  • ${d.label} (${d.groups.length} group(s))`));
      lines.push("");
    }
    if (aggEntries.length > 0) {
      lines.push(`Aggregations (${aggEntries.length}):`);
      aggEntries.forEach(([col, agg]) => lines.push(`  • ${colAlias(col)}: ${agg}`));
      lines.push("");
    }
    lines.push(`Row Limit: ${limit > 0 ? limit.toLocaleString() : "No limit"}`);
    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = buildPlainText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sql-modal-overlay" ref={overlayRef} onClick={(e) => e.target === overlayRef.current && onClose()}>
      <div className="ss-modal" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="ss-header drag-handle" onMouseDown={handleMouseDown}>
          <span className="ss-title">Selection Summary</span>
          <div className="ss-header-actions">
            <button className="ss-copy-btn" onClick={handleCopy}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
            <button className="ss-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="ss-body">
          {fqTable && (
            <div className="ss-table-row">
              <Database size={14} />
              <span className="ss-table-name">{fqTable}</span>
            </div>
          )}

          <Section icon={<Columns3 size={13} />} title="Output Columns" count={selectedOutputColumns.length}>
            <div className="ss-tag-list">
              {selectedOutputColumns.map((c) => (
                <span key={c} className="ss-tag">{colAlias(c)}</span>
              ))}
            </div>
          </Section>

          <Section icon={<FunctionSquare size={13} />} title="Custom Columns" count={formulaColumns.length}>
            <div className="ss-list">
              {formulaColumns.map((fc) => (
                <div key={fc.id} className="ss-formula">
                  <span className="ss-formula-name">{fc.alias}</span>
                  <code className="ss-formula-expr">{fc.expression}</code>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Filter size={13} />} title="Filters" count={filters.length}>
            <div className="ss-list">
              {filters.map((f) => (
                <div key={f.id} className="ss-filter-row">{filterSummary(f, colAlias)}</div>
              ))}
            </div>
          </Section>

          <Section icon={<Filter size={13} />} title="Dynamic Filters" count={enabledDynamic.length}>
            <div className="ss-list">
              {enabledDynamic.map((d) => (
                <div key={d.id} className="ss-filter-row">
                  <strong>{d.label}</strong> — {d.groups.length} group(s), joined by {d.rootJoin}
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Sigma size={13} />} title="Aggregations" count={aggEntries.length}>
            <div className="ss-tag-list">
              {aggEntries.map(([col, agg]) => (
                <span key={col} className="ss-tag">{colAlias(col)}: <strong>{agg}</strong></span>
              ))}
            </div>
          </Section>

          <div className="ss-row-limit">
            <Rows3 size={13} />
            <span>Row Limit: <strong>{limit > 0 ? limit.toLocaleString() : "No limit"}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
