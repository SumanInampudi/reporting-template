import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Loader2, X, SearchX } from "lucide-react";

export interface SearchableSelectProps {
  label: string;
  value: string | null;
  options: string[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ss-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchableSelect({
  label,
  value,
  options,
  placeholder = "Select...",
  loading = false,
  disabled = false,
  onChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(0);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => setHighlighted(0), [query, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
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
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const scrollIntoView = (idx: number) => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[idx]) {
      (items[idx] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div className="ss-field" ref={wrapRef}>
      <label className="ss-label">{label}</label>

      <button
        className={`ss-trigger ${disabled ? "disabled" : ""} ${open ? "open" : ""}`}
        onClick={() => !disabled && setOpen(!open)}
        type="button"
      >
        <span className={`ss-value ${!value ? "placeholder" : ""}`}>
          {value || placeholder}
        </span>
        {loading && <Loader2 size={13} className="spin ss-icon" />}
        {value && !loading && (
          <X size={13} className="ss-clear" onClick={handleClear} />
        )}
        <ChevronDown size={14} className={`ss-chevron ${open ? "rotated" : ""}`} />
      </button>

      {open && (
        <div className="ss-dropdown" onKeyDown={handleKeyDown}>
          <div className="ss-search-wrap">
            <Search size={13} className="ss-search-icon" />
            <input
              ref={inputRef}
              className="ss-search"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <span className="ss-result-count">
                {filtered.length} {filtered.length === 1 ? "match" : "matches"}
              </span>
            )}
          </div>
          <div className="ss-list" ref={listRef}>
            {filtered.length === 0 && (
              <div className="ss-empty">
                {loading ? (
                  <><Loader2 size={16} className="spin" /> Loading...</>
                ) : (
                  <>
                    <SearchX size={20} />
                    <span>No {label.toLowerCase()} matching "<strong>{query}</strong>"</span>
                  </>
                )}
              </div>
            )}
            {filtered.map((opt, i) => (
              <button
                key={opt}
                className={`ss-option ${opt === value ? "selected" : ""} ${i === highlighted ? "highlighted" : ""}`}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <HighlightMatch text={opt} query={query} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
