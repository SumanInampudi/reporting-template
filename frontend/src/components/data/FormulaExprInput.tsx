import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hash, Type } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { NUMERIC_RE } from "@/lib/constants";
import type { ColumnMeta } from "@/types/dashboard";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function FormulaExprInput({ value, onChange, placeholder }: Props) {
  const { columns, selectedCatalog, selectedSchema, selectedTable } = useStore();
  const resolveAlias = useColumnAlias();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<ColumnMeta[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tokenStart, setTokenStart] = useState(0);

  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null);
  const allCols: ColumnMeta[] = useMemo(
    () => (colKey ? columns[colKey] ?? [] : []),
    [colKey, columns],
  );

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
    const matches = allCols
      .filter((c) => c.col_name.toLowerCase().includes(q) || resolveAlias(c.col_name).toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
    setTokenStart(result.start);
    setActiveIdx(0);
  }, [allCols, extractToken, resolveAlias]);

  const insertSuggestion = useCallback((colName: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = value.slice(0, tokenStart);
    const after = value.slice(pos);
    const newVal = before + colName + after;
    onChange(newVal);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const newPos = tokenStart + colName.length;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  }, [value, tokenStart, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (suggestions[activeIdx]) {
        e.preventDefault();
        insertSuggestion(suggestions[activeIdx].col_name);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  }, [suggestions, activeIdx, insertSuggestion]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="formula-expr-wrap" ref={wrapRef}>
      <textarea
        ref={textareaRef}
        className="formula-expr-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTimeout(updateSuggestions, 0);
        }}
        onKeyDown={handleKeyDown}
        onFocus={updateSuggestions}
        placeholder={placeholder}
        rows={2}
      />
      {suggestions.length > 0 && (
        <div className="formula-suggestions">
          {suggestions.map((col, i) => {
            const isNum = NUMERIC_RE.test(col.data_type);
            const displayLabel = resolveAlias(col.col_name);
            const showRaw = displayLabel !== col.col_name;
            return (
              <button
                key={col.col_name}
                className={`formula-suggestion-item ${i === activeIdx ? "formula-suggestion-item--active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSuggestion(col.col_name);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className={`colpick-icon ${isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
                  {isNum ? <Hash size={10} /> : <Type size={10} />}
                </span>
                <span className="formula-suggestion-name">{displayLabel}</span>
                {showRaw && <span className="formula-suggestion-raw">{col.col_name}</span>}
                <span className="colpick-dtype">{col.data_type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
