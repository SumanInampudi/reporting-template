import { useMemo } from "react";
import { Pencil, X, ToggleLeft, ToggleRight } from "lucide-react";
import type { DynamicFilter } from "@/types/dashboard";

function conditionPreviewLines(filter: DynamicFilter): string[] {
  const lines: string[] = [];
  filter.groups.forEach((g, gi) => {
    if (gi > 0) lines.push(filter.rootJoin);
    g.conditions.forEach((c, ci) => {
      if (ci > 0) lines.push(`  ${g.join}`);
      if (!c.column) { lines.push("  (incomplete)"); return; }
      if (c.operator === "IS NULL" || c.operator === "IS NOT NULL") {
        lines.push(`  ${c.column} ${c.operator}`);
      } else if (c.operator === "BETWEEN") {
        const rhs = c.valueType === "column" ? c.value || "?" : (c.value ? `'${c.value}'` : "?");
        const rhs2 = c.valueType === "column" ? c.value2 || "?" : (c.value2 ? `'${c.value2}'` : "?");
        lines.push(`  ${c.column} BETWEEN ${rhs} AND ${rhs2}`);
      } else {
        const rhs = c.valueType === "column" ? (c.value || "?") : (c.value ? `'${c.value}'` : "?");
        lines.push(`  ${c.column} ${c.operator} ${rhs}`);
      }
    });
  });
  return lines;
}

interface Props {
  filter: DynamicFilter;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

export default function DynamicFilterChip({ filter, onEdit, onToggle, onRemove }: Props) {
  const previewLines = conditionPreviewLines(filter);
  const conditionCount = useMemo(
    () => filter.groups.reduce((sum, g) => sum + g.conditions.length, 0),
    [filter.groups],
  );
  const hasConditions = conditionCount > 0;
  const conditionLines = previewLines.filter(
    (l) => l !== "AND" && l !== "OR" && !l.trimStart().startsWith("AND") && !l.trimStart().startsWith("OR"),
  );
  const visibleCount = 1;
  const hiddenCount = conditionLines.length - visibleCount;

  return (
    <div className={`df-chip ${!filter.enabled ? "df-chip--disabled" : ""}`}>
      <button className="df-chip-toggle" onClick={onToggle} title={filter.enabled ? "Disable" : "Enable"}>
        {filter.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
      </button>
      <div className="df-chip-body" onClick={onEdit}>
        <div className="df-chip-header">
          <span className="df-chip-label">{filter.label || "Untitled"}</span>
          {hasConditions && (
            <span className="df-chip-count">
              {conditionCount} {conditionCount === 1 ? "rule" : "rules"}
            </span>
          )}
        </div>
        {hasConditions && (
          <>
            <div className="df-chip-preview">
              {previewLines.map((line, i) => (
                <span key={i} className={
                  line === "AND" || line === "OR"
                    ? "df-chip-preview-join"
                    : line.trimStart().startsWith("AND") || line.trimStart().startsWith("OR")
                      ? "df-chip-preview-join"
                      : "df-chip-preview-cond"
                }>
                  {line}
                </span>
              ))}
            </div>
            {hiddenCount > 0 && (
              <span className="df-chip-more">+{hiddenCount} more</span>
            )}
          </>
        )}
      </div>
      <div className="df-chip-actions">
        <button className="df-chip-edit" onClick={onEdit} title="Edit">
          <Pencil size={11} />
        </button>
        <button className="df-chip-remove" onClick={onRemove} title="Remove">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
