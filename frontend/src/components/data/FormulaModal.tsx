import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Hash, Type, Check, Search, ShieldCheck, Loader2, AlertTriangle, CircleAlert } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { runQuery } from "@/lib/api";
import { NUMERIC_RE } from "@/lib/constants";
import { validateFormula, validateAlias, type ValidationIssue } from "@/lib/formulaValidation";
import type { ColumnMeta, FormulaColumn } from "@/types/dashboard";

const DATA_TYPES: FormulaColumn["dataType"][] = ["STRING", "INT", "DOUBLE", "BOOLEAN"];

const FUNCTION_TEMPLATES = [
  { label: "CONCAT", snippet: "CONCAT(, )", cursor: 7 },
  { label: "COALESCE", snippet: "COALESCE(, 0)", cursor: 9 },
  { label: "ROUND", snippet: "ROUND(, 2)", cursor: 6 },
  { label: "CAST", snippet: "CAST( AS )", cursor: 5 },
  { label: "CASE WHEN", snippet: "CASE\n  WHEN  THEN \n  ELSE \nEND", cursor: 12 },
  { label: "IF", snippet: "IF(, , )", cursor: 3 },
  { label: "YEAR", snippet: "YEAR()", cursor: 5 },
  { label: "MONTH", snippet: "MONTH()", cursor: 6 },
  { label: "DATEDIFF", snippet: "DATEDIFF(, )", cursor: 9 },
  { label: "UPPER", snippet: "UPPER()", cursor: 6 },
  { label: "LOWER", snippet: "LOWER()", cursor: 6 },
  { label: "TRIM", snippet: "TRIM()", cursor: 5 },
  { label: "LENGTH", snippet: "LENGTH()", cursor: 7 },
  { label: "SUBSTR", snippet: "SUBSTR(, 1, )", cursor: 7 },
  { label: "ABS", snippet: "ABS()", cursor: 4 },
  { label: "NULLIF", snippet: "NULLIF(, )", cursor: 7 },
];

type ServerValidation = { status: "idle" } | { status: "loading" } | { status: "valid" } | { status: "error"; message: string };

interface Props {
  initial?: FormulaColumn;
  onSave: (data: { alias: string; expression: string; dataType: FormulaColumn["dataType"] }) => void;
  onClose: () => void;
}

export default function FormulaModal({ initial, onSave, onClose }: Props) {
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [expression, setExpression] = useState(initial?.expression ?? "");
  const [dataType, setDataType] = useState<FormulaColumn["dataType"]>(initial?.dataType ?? "DOUBLE");
  const [colSearch, setColSearch] = useState("");
  const [serverValidation, setServerValidation] = useState<ServerValidation>({ status: "idle" });

  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const { columns, selectedCatalog, selectedSchema, selectedTable } = useStore();
  const colKey = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;
  const fqTable = colKey;
  const allCols: ColumnMeta[] = useMemo(
    () => (colKey ? columns[colKey] ?? [] : []),
    [colKey, columns],
  );
  const colNameSet = useMemo(() => new Set(allCols.map((c) => c.col_name)), [allCols]);
  const filteredCols = useMemo(() => {
    if (!colSearch) return allCols;
    const q = colSearch.toLowerCase();
    return allCols.filter((c) => c.col_name.toLowerCase().includes(q));
  }, [allCols, colSearch]);

  const aliasIssues = useMemo(() => validateAlias(alias), [alias]);
  const exprIssues = useMemo(() => validateFormula(expression, colNameSet), [expression, colNameSet]);
  const clientErrors = [...aliasIssues, ...exprIssues].filter((i) => i.level === "error");
  const clientWarnings = [...aliasIssues, ...exprIssues].filter((i) => i.level === "warning");
  const hasClientErrors = clientErrors.length > 0;

  useEffect(() => {
    setServerValidation({ status: "idle" });
  }, [expression]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const insertAtCursor = useCallback((text: string, cursorOffset?: number) => {
    const ta = textareaRef.current;
    if (!ta) {
      setExpression((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = expression.slice(0, start);
    const after = expression.slice(end);
    const newVal = before + text + after;
    setExpression(newVal);
    requestAnimationFrame(() => {
      const pos = cursorOffset != null ? start + cursorOffset : start + text.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }, [expression]);

  const handleValidate = async () => {
    if (!fqTable || !expression.trim() || hasClientErrors) return;
    setServerValidation({ status: "loading" });

    const parts = fqTable.split(".");
    const quoted = parts.length === 3
      ? `\`${parts[0]}\`.\`${parts[1]}\`.\`${parts[2]}\``
      : fqTable;
    const sql = `SELECT (${expression.trim()}) AS __validate__ FROM ${quoted} LIMIT 0`;

    try {
      await runQuery(sql, 0);
      setServerValidation({ status: "valid" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      const cleaned = msg.replace(/^API \d+:\s*/, "").slice(0, 300);
      setServerValidation({ status: "error", message: cleaned });
    }
  };

  const handleSave = () => {
    if (!alias.trim() || !expression.trim() || hasClientErrors) return;
    onSave({ alias: alias.trim(), expression: expression.trim(), dataType });
  };

  const canSave = alias.trim().length > 0 && expression.trim().length > 0 && !hasClientErrors;

  return (
    <div className="sql-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="fm-modal" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="fm-header drag-handle" onMouseDown={handleMouseDown}>
          <span className="fm-title">
            {initial ? "Edit Calculated Column" : "New Calculated Column"}
          </span>
          <button className="sql-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="fm-body">
          <div className="fm-meta-row">
            <div className="fm-field">
              <label className="fm-label">Column Name</label>
              <input
                className={`fm-input ${aliasIssues.length > 0 ? "fm-input--error" : ""}`}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="e.g. total_amount"
                autoFocus
              />
            </div>
            <div className="fm-field fm-field--sm">
              <label className="fm-label">Data Type</label>
              <select className="fm-select" value={dataType} onChange={(e) => setDataType(e.target.value as FormulaColumn["dataType"])}>
                {DATA_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
              </select>
            </div>
          </div>

          <div className="fm-field">
            <label className="fm-label">SQL Expression</label>
            <textarea
              ref={textareaRef}
              className={`fm-textarea ${exprIssues.some((i) => i.level === "error") ? "fm-textarea--error" : ""}`}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g. order_qty * unit_price"
              rows={8}
            />
          </div>

          {/* Validation feedback */}
          {(clientErrors.length > 0 || clientWarnings.length > 0 || serverValidation.status !== "idle") && (
            <div className="fm-validation">
              {clientErrors.map((issue, i) => (
                <div key={`e-${i}`} className="fm-validation-item fm-validation-item--error">
                  <CircleAlert size={13} /> {issue.message}
                </div>
              ))}
              {clientWarnings.map((issue, i) => (
                <div key={`w-${i}`} className="fm-validation-item fm-validation-item--warning">
                  <AlertTriangle size={13} /> {issue.message}
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

          <div className="fm-helpers">
            <div className="fm-helper-panel">
              <div className="fm-helper-header">
                <span className="fm-helper-title">Available Columns</span>
                <span className="fm-helper-count">{allCols.length}</span>
              </div>
              <div className="fm-helper-search">
                <Search size={11} />
                <input
                  className="fm-helper-search-input"
                  placeholder="Filter..."
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                />
              </div>
              <div className="fm-helper-list">
                {filteredCols.map((col) => {
                  const isNum = NUMERIC_RE.test(col.data_type);
                  return (
                    <button
                      key={col.col_name}
                      className="fm-helper-item"
                      onClick={() => insertAtCursor(col.col_name)}
                      title={`${col.col_name} (${col.data_type}) — click to insert`}
                    >
                      <span className={`colpick-icon ${isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
                        {isNum ? <Hash size={10} /> : <Type size={10} />}
                      </span>
                      <span className="fm-helper-name">{col.col_name}</span>
                      <span className="colpick-dtype">{col.data_type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fm-helper-panel">
              <div className="fm-helper-header">
                <span className="fm-helper-title">Functions</span>
              </div>
              <div className="fm-helper-list">
                {FUNCTION_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    className="fm-helper-item fm-helper-item--fn"
                    onClick={() => insertAtCursor(tmpl.snippet, tmpl.cursor)}
                    title={`Insert ${tmpl.label} template`}
                  >
                    <code className="fm-fn-label">{tmpl.label}</code>
                    <span className="fm-fn-preview">{tmpl.snippet.split("\n")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="fm-footer">
          <button
            className="sql-modal-btn fm-validate-btn"
            onClick={handleValidate}
            disabled={!expression.trim() || hasClientErrors || serverValidation.status === "loading" || !fqTable}
          >
            {serverValidation.status === "loading"
              ? <><Loader2 size={13} className="spin" /> Validating...</>
              : <><ShieldCheck size={13} /> Validate</>
            }
          </button>
          <span className="fm-footer-spacer" />
          <button className="sql-modal-btn" onClick={onClose}>Cancel</button>
          <button
            className="fm-save-btn"
            onClick={handleSave}
            disabled={!canSave}
          >
            <Check size={14} /> {initial ? "Update Column" : "Save & Include in Output"}
          </button>
        </div>
      </div>
    </div>
  );
}
