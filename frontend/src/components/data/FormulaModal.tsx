import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Hash, Type, Check, Search, ShieldCheck, Loader2,
  AlertTriangle, CircleAlert, Eye, BookOpen, ChevronDown, ChevronRight,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { runQuery } from "@/lib/api";
import { quoteTableRef } from "@/lib/sqlBuilder";
import { NUMERIC_RE } from "@/lib/constants";
import { validateFormula, validateAlias, type ValidationIssue } from "@/lib/formulaValidation";
import type { ColumnMeta, FormulaColumn, QueryResult } from "@/types/dashboard";

/* ── static data ───────────────────────────────────── */

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
  { label: "DATE_ADD", snippet: "DATE_ADD(, INTERVAL  DAY)", cursor: 9 },
  { label: "DATE_TRUNC", snippet: "DATE_TRUNC('month', )", cursor: 20 },
  { label: "DATE_FORMAT", snippet: "DATE_FORMAT(, 'yyyy-MM-dd')", cursor: 12 },
  { label: "TO_DATE", snippet: "TO_DATE(, 'yyyy-MM-dd')", cursor: 8 },
  { label: "CURRENT_DATE", snippet: "CURRENT_DATE()", cursor: 14 },
  { label: "REGEXP_EXTRACT", snippet: "REGEXP_EXTRACT(, '(.*)', 1)", cursor: 15 },
  { label: "REGEXP_REPLACE", snippet: "REGEXP_REPLACE(, '', '')", cursor: 15 },
  { label: "INITCAP", snippet: "INITCAP()", cursor: 8 },
  { label: "LPAD", snippet: "LPAD(, 10, '0')", cursor: 5 },
  { label: "SPLIT", snippet: "SPLIT(, ',')", cursor: 6 },
  { label: "NVL", snippet: "NVL(, )", cursor: 4 },
];

interface RecipeParam {
  label: string;
  type: "column" | "number" | "string";
  hint?: string;
}

interface Recipe {
  name: string;
  description: string;
  category: "math" | "date" | "text" | "window" | "conditional";
  params: RecipeParam[];
  build: (args: string[]) => string;
}

const RECIPES: Recipe[] = [
  {
    name: "Percent of Total",
    description: "Column value as a percentage of the overall total",
    category: "window",
    params: [{ label: "Value Column", type: "column", hint: "numeric column" }],
    build: ([col]) => `ROUND(${col} / SUM(${col}) OVER () * 100, 2)`,
  },
  {
    name: "Running Total",
    description: "Cumulative sum ordered by a date/sequence column",
    category: "window",
    params: [
      { label: "Value Column", type: "column", hint: "numeric column to sum" },
      { label: "Order By Column", type: "column", hint: "date or sequence column" },
    ],
    build: ([val, order]) => `SUM(${val}) OVER (ORDER BY ${order})`,
  },
  {
    name: "Moving Average (7-row)",
    description: "Average of the current and 6 preceding rows",
    category: "window",
    params: [
      { label: "Value Column", type: "column" },
      { label: "Order By Column", type: "column" },
    ],
    build: ([val, order]) => `ROUND(AVG(${val}) OVER (ORDER BY ${order} ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2)`,
  },
  {
    name: "Row Number",
    description: "Sequential row number partitioned by a group",
    category: "window",
    params: [
      { label: "Partition Column", type: "column" },
      { label: "Order By Column", type: "column" },
    ],
    build: ([part, order]) => `ROW_NUMBER() OVER (PARTITION BY ${part} ORDER BY ${order})`,
  },
  {
    name: "Rank",
    description: "Rank within a partition (gaps allowed)",
    category: "window",
    params: [
      { label: "Partition Column", type: "column" },
      { label: "Order By Column", type: "column" },
    ],
    build: ([part, order]) => `RANK() OVER (PARTITION BY ${part} ORDER BY ${order} DESC)`,
  },
  {
    name: "Year-over-Year %",
    description: "Percentage change between current and prior value",
    category: "window",
    params: [
      { label: "Value Column", type: "column" },
      { label: "Date Column", type: "column" },
    ],
    build: ([val, dt]) =>
      `ROUND((${val} - LAG(${val}) OVER (ORDER BY ${dt})) / NULLIF(LAG(${val}) OVER (ORDER BY ${dt}), 0) * 100, 2)`,
  },
  {
    name: "Margin %",
    description: "(Revenue - Cost) / Revenue * 100",
    category: "math",
    params: [
      { label: "Revenue Column", type: "column" },
      { label: "Cost Column", type: "column" },
    ],
    build: ([rev, cost]) => `ROUND((${rev} - ${cost}) / NULLIF(${rev}, 0) * 100, 2)`,
  },
  {
    name: "Ratio / Division",
    description: "Safe division of two columns (avoids divide-by-zero)",
    category: "math",
    params: [
      { label: "Numerator", type: "column" },
      { label: "Denominator", type: "column" },
      { label: "Decimals", type: "number", hint: "2" },
    ],
    build: ([num, den, dec]) => `ROUND(${num} / NULLIF(${den}, 0), ${dec || "2"})`,
  },
  {
    name: "Bin / Bucket",
    description: "Group numeric values into named buckets",
    category: "conditional",
    params: [
      { label: "Column", type: "column" },
      { label: "Low Threshold", type: "number", hint: "e.g. 100" },
      { label: "High Threshold", type: "number", hint: "e.g. 1000" },
    ],
    build: ([col, lo, hi]) =>
      `CASE\n  WHEN ${col} < ${lo || "100"} THEN 'Low'\n  WHEN ${col} < ${hi || "1000"} THEN 'Medium'\n  ELSE 'High'\nEND`,
  },
  {
    name: "Flag / Boolean",
    description: "Return 'Yes'/'No' based on a condition",
    category: "conditional",
    params: [
      { label: "Column", type: "column" },
      { label: "Operator", type: "string", hint: "> , = , IS NOT NULL" },
      { label: "Compare Value", type: "string", hint: "0 or 'Active'" },
    ],
    build: ([col, op, val]) =>
      `CASE WHEN ${col} ${op || ">"} ${val || "0"} THEN 'Yes' ELSE 'No' END`,
  },
  {
    name: "Null Handling",
    description: "Replace NULL values with a fallback",
    category: "conditional",
    params: [
      { label: "Column", type: "column" },
      { label: "Fallback Value", type: "string", hint: "'Unknown' or 0" },
    ],
    build: ([col, fallback]) => `COALESCE(${col}, ${fallback || "'Unknown'"})`,
  },
  {
    name: "Date Bucket (Truncate)",
    description: "Truncate a date to year, quarter, month, week, or day",
    category: "date",
    params: [
      { label: "Date Column", type: "column" },
      { label: "Granularity", type: "string", hint: "year / quarter / month / week / day" },
    ],
    build: ([col, gran]) => `DATE_TRUNC('${gran || "month"}', ${col})`,
  },
  {
    name: "Days Between",
    description: "Number of days between two date columns",
    category: "date",
    params: [
      { label: "End Date", type: "column" },
      { label: "Start Date", type: "column" },
    ],
    build: ([end, start]) => `DATEDIFF(${end}, ${start})`,
  },
  {
    name: "Concatenate Columns",
    description: "Join two or more columns with a separator",
    category: "text",
    params: [
      { label: "Column A", type: "column" },
      { label: "Column B", type: "column" },
      { label: "Separator", type: "string", hint: "' - ' or ', '" },
    ],
    build: ([a, b, sep]) => `CONCAT(${a}, ${sep ? `${sep}` : "' - '"}, ${b})`,
  },
  {
    name: "Extract Substring",
    description: "Extract part of a string column",
    category: "text",
    params: [
      { label: "Column", type: "column" },
      { label: "Start Position", type: "number", hint: "1" },
      { label: "Length", type: "number", hint: "10" },
    ],
    build: ([col, start, len]) => `SUBSTR(${col}, ${start || "1"}, ${len || "10"})`,
  },
];

const RECIPE_CATEGORIES = [
  { key: "window" as const, label: "Window / Analytics" },
  { key: "math" as const, label: "Math" },
  { key: "conditional" as const, label: "Conditional" },
  { key: "date" as const, label: "Date" },
  { key: "text" as const, label: "Text" },
];

/* ── types ─────────────────────────────────────────── */

type ServerValidation =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid" }
  | { status: "error"; message: string };

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: QueryResult }
  | { status: "error"; message: string };

type SuggestionItem =
  | { kind: "column"; col: ColumnMeta; displayName: string }
  | { kind: "function"; label: string; snippet: string; cursor: number };

interface Props {
  initial?: FormulaColumn;
  onSave: (data: { alias: string; expression: string; dataType: FormulaColumn["dataType"] }) => void;
  onClose: () => void;
}

/* ── component ─────────────────────────────────────── */

export default function FormulaModal({ initial, onSave, onClose }: Props) {
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [expression, setExpression] = useState(initial?.expression ?? "");
  const [dataType, setDataType] = useState<FormulaColumn["dataType"]>(initial?.dataType ?? "DOUBLE");
  const [colSearch, setColSearch] = useState("");
  const [serverValidation, setServerValidation] = useState<ServerValidation>({ status: "idle" });
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [helperTab, setHelperTab] = useState<"columns" | "functions" | "recipes">("columns");

  // autocomplete
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [acActiveIdx, setAcActiveIdx] = useState(0);
  const [acTokenStart, setAcTokenStart] = useState(0);

  // recipes
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [recipeArgs, setRecipeArgs] = useState<string[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["window"]));

  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const resolveAlias = useColumnAlias();
  const { columns, selectedCatalog, selectedSchema, selectedTable, selectedOutputColumns } = useStore();
  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null);
  const fqTable = useStore((s) => s.effectiveTableRef)();

  const allCols: ColumnMeta[] = useMemo(
    () => (colKey ? columns[colKey] ?? [] : []),
    [colKey, columns],
  );
  const colNameSet = useMemo(() => new Set(allCols.map((c) => c.col_name)), [allCols]);

  const filteredCols = useMemo(() => {
    if (!colSearch) return allCols;
    const q = colSearch.toLowerCase();
    return allCols.filter((c) =>
      c.col_name.toLowerCase().includes(q) ||
      resolveAlias(c.col_name).toLowerCase().includes(q),
    );
  }, [allCols, colSearch, resolveAlias]);

  const aliasIssues = useMemo(() => validateAlias(alias), [alias]);
  const exprIssues = useMemo(() => validateFormula(expression, colNameSet), [expression, colNameSet]);
  const clientErrors = [...aliasIssues, ...exprIssues].filter((i) => i.level === "error");
  const clientWarnings = [...aliasIssues, ...exprIssues].filter((i) => i.level === "warning");
  const hasClientErrors = clientErrors.length > 0;

  /* ── effects ─────────────────────────────────────── */

  useEffect(() => {
    setServerValidation({ status: "idle" });
  }, [expression]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (suggestions.length > 0) { setSuggestions([]); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, suggestions.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* ── autocomplete ────────────────────────────────── */

  const extractToken = useCallback((): { token: string; start: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const pos = ta.selectionStart;
    const text = ta.value.slice(0, pos);
    const match = text.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!match) return null;
    return { token: match[1], start: pos - match[1].length };
  }, []);

  const updateSuggestions = useCallback(() => {
    const result = extractToken();
    if (!result || result.token.length < 1) {
      setSuggestions([]);
      return;
    }
    const q = result.token.toLowerCase();
    const colMatches: SuggestionItem[] = allCols
      .filter((c) => c.col_name.toLowerCase().includes(q) || resolveAlias(c.col_name).toLowerCase().includes(q))
      .slice(0, 6)
      .map((c) => ({ kind: "column", col: c, displayName: resolveAlias(c.col_name) }));
    const fnMatches: SuggestionItem[] = FUNCTION_TEMPLATES
      .filter((f) => f.label.toLowerCase().includes(q))
      .slice(0, 4)
      .map((f) => ({ kind: "function", label: f.label, snippet: f.snippet, cursor: f.cursor }));
    const all = [...colMatches, ...fnMatches].slice(0, 8);
    setSuggestions(all);
    setAcTokenStart(result.start);
    setAcActiveIdx(0);
  }, [allCols, extractToken, resolveAlias]);

  const insertSuggestion = useCallback((text: string, cursorOffset?: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = expression.slice(0, acTokenStart);
    const after = expression.slice(pos);
    const newVal = before + text + after;
    setExpression(newVal);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const newPos = cursorOffset != null ? acTokenStart + cursorOffset : acTokenStart + text.length;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  }, [expression, acTokenStart]);

  const handleAcKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Tab" || e.key === "Enter") {
      const item = suggestions[acActiveIdx];
      if (item) {
        e.preventDefault();
        if (item.kind === "column") insertSuggestion(item.col.col_name);
        else insertSuggestion(item.snippet, item.cursor);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setSuggestions([]);
    }
  }, [suggestions, acActiveIdx, insertSuggestion]);

  /* ── insert from sidebar ─────────────────────────── */

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

  /* ── validate ────────────────────────────────────── */

  const handleValidate = async () => {
    if (!fqTable || !expression.trim() || hasClientErrors) return;
    setServerValidation({ status: "loading" });
    const quoted = quoteTableRef(fqTable);
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

  /* ── preview ─────────────────────────────────────── */

  const handlePreview = async () => {
    if (!fqTable || !expression.trim() || hasClientErrors) return;
    setPreview({ status: "loading" });
    const quoted = quoteTableRef(fqTable);
    const contextCols = selectedOutputColumns
      .filter((c) => !c.startsWith("__fc__") && !c.startsWith("__sf__"))
      .slice(0, 3);
    const selectParts = [
      ...contextCols.map((c) => `\`${c}\``),
      `(${expression.trim()}) AS \`__result__\``,
    ];
    const sql = `SELECT ${selectParts.join(", ")} FROM ${quoted} LIMIT 5`;
    try {
      const result = await runQuery(sql, 5, undefined, true);
      setPreview({ status: "ready", result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Preview failed";
      setPreview({ status: "error", message: msg.replace(/^API \d+:\s*/, "").slice(0, 300) });
    }
  };

  /* ── save ────────────────────────────────────────── */

  const handleSave = () => {
    if (!alias.trim() || !expression.trim() || hasClientErrors) return;
    onSave({ alias: alias.trim(), expression: expression.trim(), dataType });
  };

  const canSave = alias.trim().length > 0 && expression.trim().length > 0 && !hasClientErrors;

  /* ── recipe helpers ──────────────────────────────── */

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const selectRecipe = (r: Recipe) => {
    setActiveRecipe(r);
    setRecipeArgs(r.params.map(() => ""));
  };

  const applyRecipe = () => {
    if (!activeRecipe) return;
    const expr = activeRecipe.build(recipeArgs);
    setExpression(expr);
    setActiveRecipe(null);
  };

  /* ── render ──────────────────────────────────────── */

  return (
    <div className="sql-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="fm-modal" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="fm-header drag-handle" onMouseDown={handleMouseDown}>
          <span className="fm-title">
            {initial ? "Edit Calculated Field" : "New Calculated Field"}
          </span>
          <button className="sql-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="fm-body">
          {/* ── name + type row ── */}
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

          {/* ── expression textarea with autocomplete ── */}
          <div className="fm-field">
            <label className="fm-label">SQL Expression</label>
            <div className="formula-expr-wrap" ref={wrapRef}>
              <textarea
                ref={textareaRef}
                className={`fm-textarea ${exprIssues.some((i) => i.level === "error") ? "fm-textarea--error" : ""}`}
                value={expression}
                onChange={(e) => {
                  setExpression(e.target.value);
                  setTimeout(updateSuggestions, 0);
                }}
                onKeyDown={handleAcKeyDown}
                placeholder="e.g. order_qty * unit_price"
                rows={6}
              />
              {suggestions.length > 0 && (
                <div className="formula-suggestions">
                  {suggestions.map((item, i) => {
                    if (item.kind === "column") {
                      const isNum = NUMERIC_RE.test(item.col.data_type);
                      return (
                        <button
                          key={`c-${item.col.col_name}`}
                          className={`formula-suggestion-item ${i === acActiveIdx ? "formula-suggestion-item--active" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); insertSuggestion(item.col.col_name); }}
                          onMouseEnter={() => setAcActiveIdx(i)}
                        >
                          <span className={`colpick-icon ${isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
                            {isNum ? <Hash size={10} /> : <Type size={10} />}
                          </span>
                          <span className="formula-suggestion-name">{item.displayName}</span>
                          <span className="formula-suggestion-raw">{item.col.col_name}</span>
                          <span className="colpick-dtype">{item.col.data_type}</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={`f-${item.label}`}
                        className={`formula-suggestion-item formula-suggestion-item--fn ${i === acActiveIdx ? "formula-suggestion-item--active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); insertSuggestion(item.snippet, item.cursor); }}
                        onMouseEnter={() => setAcActiveIdx(i)}
                      >
                        <code className="fm-fn-label" style={{ minWidth: 0 }}>{item.label}</code>
                        <span className="formula-suggestion-name">{item.snippet.split("\n")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── validation feedback ── */}
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

          {/* ── preview ── */}
          {preview.status !== "idle" && (
            <div className="fm-preview">
              {preview.status === "loading" && (
                <div className="fm-preview-loading"><Loader2 size={14} className="spin" /> Loading preview...</div>
              )}
              {preview.status === "error" && (
                <div className="fm-preview-error"><CircleAlert size={13} /> {preview.message}</div>
              )}
              {preview.status === "ready" && (
                <div className="fm-preview-table-wrap">
                  <table className="fm-preview-table">
                    <thead>
                      <tr>
                        {preview.result.columns.map((c) => (
                          <th key={c}>{c === "__result__" ? (alias || "Result") : resolveAlias(c)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.result.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell == null ? <span className="fm-preview-null">NULL</span> : String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                      {preview.result.rows.length === 0 && (
                        <tr><td colSpan={preview.result.columns.length} className="fm-preview-empty">No rows returned</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── helper tabs ── */}
          <div className="fm-helper-tabs">
            <button className={`fm-helper-tab ${helperTab === "columns" ? "fm-helper-tab--active" : ""}`} onClick={() => setHelperTab("columns")}>
              <Hash size={12} /> Columns <span className="fm-helper-count">{allCols.length}</span>
            </button>
            <button className={`fm-helper-tab ${helperTab === "functions" ? "fm-helper-tab--active" : ""}`} onClick={() => setHelperTab("functions")}>
              <Type size={12} /> Functions
            </button>
            <button className={`fm-helper-tab ${helperTab === "recipes" ? "fm-helper-tab--active" : ""}`} onClick={() => setHelperTab("recipes")}>
              <BookOpen size={12} /> Recipes
            </button>
          </div>

          <div className="fm-helpers fm-helpers--single">
            {/* ── Columns panel ── */}
            {helperTab === "columns" && (
              <div className="fm-helper-panel">
                <div className="fm-helper-search">
                  <Search size={11} />
                  <input
                    className="fm-helper-search-input"
                    placeholder="Search columns..."
                    value={colSearch}
                    onChange={(e) => setColSearch(e.target.value)}
                  />
                </div>
                <div className="fm-helper-list">
                  {filteredCols.map((col) => {
                    const isNum = NUMERIC_RE.test(col.data_type);
                    const displayLabel = resolveAlias(col.col_name);
                    const showRaw = displayLabel !== col.col_name;
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
                        <span className="fm-helper-name">{displayLabel}</span>
                        {showRaw && <span className="fm-helper-raw">{col.col_name}</span>}
                        <span className="colpick-dtype">{col.data_type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Functions panel ── */}
            {helperTab === "functions" && (
              <div className="fm-helper-panel">
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
            )}

            {/* ── Recipes panel ── */}
            {helperTab === "recipes" && (
              <div className="fm-helper-panel fm-recipes-panel">
                {activeRecipe ? (
                  <div className="fm-recipe-form">
                    <div className="fm-recipe-form-header">
                      <span className="fm-recipe-form-title">{activeRecipe.name}</span>
                      <button className="fm-recipe-back" onClick={() => setActiveRecipe(null)}>
                        <X size={12} /> Back
                      </button>
                    </div>
                    <p className="fm-recipe-desc">{activeRecipe.description}</p>
                    <div className="fm-recipe-params">
                      {activeRecipe.params.map((p, pi) => (
                        <div key={pi} className="fm-recipe-param">
                          <label className="fm-label">{p.label}</label>
                          {p.type === "column" ? (
                            <select
                              className="fm-select"
                              value={recipeArgs[pi] || ""}
                              onChange={(e) => {
                                const next = [...recipeArgs];
                                next[pi] = e.target.value;
                                setRecipeArgs(next);
                              }}
                            >
                              <option value="">Select column...</option>
                              {allCols.map((c) => (
                                <option key={c.col_name} value={c.col_name}>{resolveAlias(c.col_name)}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="fm-input"
                              value={recipeArgs[pi] || ""}
                              onChange={(e) => {
                                const next = [...recipeArgs];
                                next[pi] = e.target.value;
                                setRecipeArgs(next);
                              }}
                              placeholder={p.hint || ""}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="fm-recipe-preview-expr">
                      <label className="fm-label">Generated Expression</label>
                      <code className="fm-recipe-expr-code">{activeRecipe.build(recipeArgs)}</code>
                    </div>
                    <button className="fm-recipe-apply" onClick={applyRecipe}>
                      <Check size={13} /> Apply to Expression
                    </button>
                  </div>
                ) : (
                  <div className="fm-recipe-list">
                    {RECIPE_CATEGORIES.map((cat) => {
                      const items = RECIPES.filter((r) => r.category === cat.key);
                      if (items.length === 0) return null;
                      const open = expandedCats.has(cat.key);
                      return (
                        <div key={cat.key} className="fm-recipe-cat">
                          <button className="fm-recipe-cat-hdr" onClick={() => toggleCat(cat.key)}>
                            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span>{cat.label}</span>
                            <span className="fm-helper-count">{items.length}</span>
                          </button>
                          {open && (
                            <div className="fm-recipe-cat-items">
                              {items.map((r) => (
                                <button key={r.name} className="fm-recipe-item" onClick={() => selectRecipe(r)}>
                                  <span className="fm-recipe-item-name">{r.name}</span>
                                  <span className="fm-recipe-item-desc">{r.description}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── footer ── */}
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
          <button
            className="sql-modal-btn fm-preview-btn"
            onClick={handlePreview}
            disabled={!expression.trim() || hasClientErrors || preview.status === "loading" || !fqTable}
          >
            {preview.status === "loading"
              ? <><Loader2 size={13} className="spin" /> Loading...</>
              : <><Eye size={13} /> Preview</>
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
