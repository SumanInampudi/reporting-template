import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Check, Plus, ShieldCheck, Loader2, CircleAlert, AlertTriangle, Code,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { runQuery } from "@/lib/api";
import { buildDynamicFilterWhere } from "@/lib/dynamicFilterSql";
import { validateDynamicFilter, type DFValidationIssue } from "@/lib/dynamicFilterValidation";
import FilterGroupCard, { makeCondition } from "./FilterGroupCard";
import type { ColumnMeta, DynamicFilter, FilterGroup, LogicalJoin } from "@/types/dashboard";

interface Props {
  initial?: DynamicFilter;
  onSave: (filter: Omit<DynamicFilter, "id">) => void;
  onClose: () => void;
}

function makeGroup(): FilterGroup {
  return {
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    join: "AND",
    conditions: [makeCondition()],
  };
}

type ServerValidation = { status: "idle" } | { status: "loading" } | { status: "valid" } | { status: "error"; message: string };

export default function DynamicFilterModal({ initial, onSave, onClose }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [rootJoin, setRootJoin] = useState<LogicalJoin>(initial?.rootJoin ?? "AND");
  const [groups, setGroups] = useState<FilterGroup[]>(
    initial?.groups.length ? initial.groups : [makeGroup()],
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [serverValidation, setServerValidation] = useState<ServerValidation>({ status: "idle" });

  const overlayRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const { columns, selectedCatalog, selectedSchema, selectedTable } = useStore();
  const colKey = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;
  const fqTable = colKey;
  const allCols: ColumnMeta[] = useMemo(
    () => (colKey ? columns[colKey] ?? [] : []),
    [colKey, columns],
  );

  const draft: DynamicFilter = useMemo(() => ({
    id: initial?.id ?? "__draft__",
    label, rootJoin, groups, enabled,
  }), [initial?.id, label, rootJoin, groups, enabled]);

  const issues = useMemo(() => validateDynamicFilter(draft, allCols), [draft, allCols]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const hasErrors = errors.length > 0;

  const whereClause = useMemo(() => buildDynamicFilterWhere({ ...draft, enabled: true }), [draft]);

  useEffect(() => {
    setServerValidation({ status: "idle" });
  }, [groups, rootJoin]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const updateGroup = (idx: number, patch: Partial<FilterGroup>) => {
    setGroups((g) => g.map((grp, i) => (i === idx ? { ...grp, ...patch } : grp)));
  };

  const removeGroup = (idx: number) => {
    setGroups((g) => g.filter((_, i) => i !== idx));
  };

  const addGroup = () => {
    setGroups((g) => [...g, makeGroup()]);
  };

  const handleValidate = async () => {
    if (!fqTable || !whereClause || hasErrors) return;
    setServerValidation({ status: "loading" });
    const parts = fqTable.split(".");
    const quoted = parts.length === 3
      ? `\`${parts[0]}\`.\`${parts[1]}\`.\`${parts[2]}\``
      : fqTable;
    const sql = `SELECT 1 FROM ${quoted} WHERE ${whereClause} LIMIT 0`;
    try {
      await runQuery(sql, 0);
      setServerValidation({ status: "valid" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      setServerValidation({ status: "error", message: msg.replace(/^API \d+:\s*/, "").slice(0, 300) });
    }
  };

  const handleSave = () => {
    if (hasErrors || !label.trim()) return;
    onSave({ label: label.trim(), rootJoin, groups, enabled });
  };

  const canSave = label.trim().length > 0 && groups.length > 0 && !hasErrors;

  return (
    <div className="sql-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="df-modal" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        {/* Header */}
        <div className="fm-header drag-handle" onMouseDown={handleMouseDown}>
          <span className="fm-title">
            {initial ? "Edit Filter Rule" : "New Filter Rule"}
          </span>
          <button className="sql-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="df-modal-body">
          {/* Label row */}
          <div className="fm-meta-row">
            <div className="fm-field">
              <label className="fm-label">Filter Label</label>
              <input
                className={`fm-input ${!label.trim() ? "fm-input--error" : ""}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. High-value active orders"
                autoFocus
              />
            </div>
            <div className="fm-field fm-field--sm" style={{ alignItems: "center", justifyContent: "center" }}>
              <label className="fm-label">Enabled</label>
              <button
                className={`stg-toggle ${enabled ? "stg-toggle--on" : ""}`}
                onClick={() => setEnabled((v) => !v)}
              >
                <span className="stg-toggle-thumb" />
              </button>
            </div>
          </div>

          {/* Groups */}
          <div className="df-groups">
            {groups.map((g, i) => (
              <div key={g.id}>
                {i > 0 && (
                  <div className="df-root-join">
                    <button className="df-root-join-btn" onClick={() => setRootJoin(rootJoin === "AND" ? "OR" : "AND")}>
                      {rootJoin}
                    </button>
                  </div>
                )}
                <FilterGroupCard
                  group={g}
                  groupIdx={i}
                  columns={allCols}
                  onUpdate={(patch) => updateGroup(i, patch)}
                  onRemove={() => removeGroup(i)}
                  canRemove={groups.length > 1}
                />
              </div>
            ))}

            <button className="df-add-group-btn" onClick={addGroup}>
              <Plus size={13} /> Add Group
            </button>
          </div>

          {/* SQL Preview */}
          {whereClause && (
            <div className="df-sql-preview">
              <div className="df-sql-preview-header">
                <Code size={12} /> <span>Generated WHERE clause</span>
              </div>
              <code className="df-sql-preview-code">{whereClause}</code>
            </div>
          )}

          {/* Validation messages */}
          {(errors.length > 0 || warnings.length > 0 || serverValidation.status !== "idle") && (
            <div className="fm-validation">
              {errors.map((issue, i) => (
                <div key={`e-${i}`} className="fm-validation-item fm-validation-item--error">
                  <CircleAlert size={13} /> <strong>{issue.path}:</strong> {issue.message}
                </div>
              ))}
              {warnings.map((issue, i) => (
                <div key={`w-${i}`} className="fm-validation-item fm-validation-item--warning">
                  <AlertTriangle size={13} /> <strong>{issue.path}:</strong> {issue.message}
                </div>
              ))}
              {serverValidation.status === "valid" && (
                <div className="fm-validation-item fm-validation-item--valid">
                  <ShieldCheck size={13} /> Expression is valid
                </div>
              )}
              {serverValidation.status === "error" && (
                <div className="fm-validation-item fm-validation-item--error">
                  <CircleAlert size={13} /> {serverValidation.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fm-footer">
          <button
            className="sql-modal-btn fm-validate-btn"
            onClick={handleValidate}
            disabled={!whereClause || hasErrors || serverValidation.status === "loading" || !fqTable}
          >
            {serverValidation.status === "loading"
              ? <><Loader2 size={13} className="spin" /> Validating...</>
              : <><ShieldCheck size={13} /> Validate</>
            }
          </button>
          <span className="fm-footer-spacer" />
          <button className="sql-modal-btn" onClick={onClose}>Cancel</button>
          <button className="fm-save-btn" onClick={handleSave} disabled={!canSave}>
            <Check size={14} /> {initial ? "Update Rule" : "Save Filter Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
