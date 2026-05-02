import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Loader2, RotateCcw, Search, BookOpen, Plus, Trash2, X, Type, Wand2, FileText,
  Hash, Layers, FolderOpen, Sparkles, ChevronDown, ChevronRight, Check, Eye, EyeOff,
  Sigma,
} from "lucide-react";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { fetchColumnsIn } from "@/lib/api";
import {
  generateAliases, getAbbreviations, setAbbreviations, getDefaultAbbreviations,
  type AliasStrategy, type AbbreviationEntry,
} from "@/lib/aliasUtils";
import {
  previewPatternMatches, detectColumnGroups, type SuggestedGroup,
} from "@/lib/columnGroupResolver";
import { NUMERIC_RE } from "@/lib/constants";
import type { ColumnAggregation, ColumnGroupConfig, ColumnMeta, GroupingMode } from "@/types/dashboard";

interface Props {
  catalog: string;
  schema: string;
  table: string;
  aliases: Record<string, string>;
  onAliasesChange: (aliases: Record<string, string>) => void;
  excludedColumns: string[];
  onExcludedColumnsChange: (cols: string[]) => void;
  columnGroups: ColumnGroupConfig;
  onColumnGroupsChange: (cfg: ColumnGroupConfig) => void;
  columnAggregations: Record<string, ColumnAggregation>;
  onColumnAggregationsChange: (aggs: Record<string, ColumnAggregation>) => void;
}

type StepTab = "aliases" | "aggregations" | "grouping";

const STRATEGY_OPTS: { id: AliasStrategy; label: string; icon: typeof Type; desc: string }[] = [
  { id: "title_case", label: "Title Case", icon: Type, desc: "Remove underscores, capitalize words" },
  { id: "pattern", label: "Smart Abbreviate", icon: Wand2, desc: "Apply abbreviation dictionary" },
  { id: "original", label: "Keep Original", icon: FileText, desc: "Use raw column names" },
];

export default function AliasStep({
  catalog, schema, table, aliases, onAliasesChange,
  excludedColumns, onExcludedColumnsChange,
  columnGroups, onColumnGroupsChange,
  columnAggregations, onColumnAggregationsChange,
}: Props) {
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMetas, setColumnMetas] = useState<ColumnMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<AliasStrategy>("title_case");
  const [search, setSearch] = useState("");
  const [showAbbrModal, setShowAbbrModal] = useState(false);
  const [activeTab, setActiveTab] = useState<StepTab>("aliases");

  useEffect(() => {
    if (!catalog || !schema || !table) return;
    setLoading(true);
    fetchColumnsIn(catalog, schema, table)
      .then((cols) => {
        const names = cols.map((c) => c.col_name);
        setColumns(names);
        setColumnMetas(cols);
        if (Object.keys(aliases).length === 0) {
          onAliasesChange(generateAliases(names, "title_case"));
        }
        if (Object.keys(columnAggregations).length === 0) {
          const noSumRe = /pct|percent|ratio|rate|avg|average|mean/i;
          const defaultAggs: Record<string, ColumnAggregation> = {};
          for (const c of cols) {
            if (NUMERIC_RE.test(c.data_type)) {
              defaultAggs[c.col_name] = noSumRe.test(c.col_name) ? "NONE" : "SUM";
            }
          }
          if (Object.keys(defaultAggs).length > 0) onColumnAggregationsChange(defaultAggs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [catalog, schema, table]);

  const applyStrategy = (s: AliasStrategy) => {
    setStrategy(s);
    onAliasesChange(generateAliases(columns, s));
  };

  const updateAlias = (col: string, value: string) => {
    onAliasesChange({ ...aliases, [col]: value });
  };

  const resetAlias = (col: string) => {
    onAliasesChange({ ...aliases, [col]: generateAliases([col], strategy)[col] });
  };

  const excludedSet = new Set(excludedColumns);
  const toggleExclude = (col: string) => {
    if (excludedSet.has(col)) {
      onExcludedColumnsChange(excludedColumns.filter((c) => c !== col));
    } else {
      onExcludedColumnsChange([...excludedColumns, col]);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return columns;
    const q = search.toLowerCase();
    return columns.filter(
      (c) => c.toLowerCase().includes(q) || (aliases[c] ?? "").toLowerCase().includes(q),
    );
  }, [columns, search, aliases]);

  if (loading) {
    return (
      <div className="alias-step-loading">
        <Loader2 size={24} className="spin" />
        <p>Loading columns from <strong>{table}</strong>...</p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="alias-step-loading">
        <p>No columns found. Please go back and select a table.</p>
      </div>
    );
  }

  return (
    <div className="alias-step">
      {/* ── Tab bar ── */}
      <div className="astep-tab-bar">
        <button
          className={`astep-tab${activeTab === "aliases" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("aliases")}
        >
          <Type size={14} /> Display Names
        </button>
        <button
          className={`astep-tab${activeTab === "aggregations" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("aggregations")}
        >
          <Sigma size={14} /> Aggregations
        </button>
        <button
          className={`astep-tab${activeTab === "grouping" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("grouping")}
        >
          <Layers size={14} /> Grouping
        </button>
      </div>

      {/* ── Display Names tab ── */}
      {activeTab === "aliases" && (
        <div className="astep-panel">
          <p className="alias-step-desc">
            Choose how column names appear in the UI. Queries always use the original names.
          </p>

          <div className="alias-strategy-bar">
            {STRATEGY_OPTS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  className={`alias-strategy-btn${strategy === opt.id ? " alias-strategy-btn--active" : ""}`}
                  onClick={() => applyStrategy(opt.id)}
                  title={opt.desc}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
            <button className="alias-abbr-btn" onClick={() => setShowAbbrModal(true)} title="Manage abbreviation dictionary">
              <BookOpen size={14} /> Dictionary
            </button>
          </div>

          <div className="alias-search-bar">
            <Search size={14} />
            <input
              className="alias-search-input"
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="alias-count">
              {excludedColumns.length > 0 && (
                <span className="alias-excluded-count">{excludedColumns.length} hidden · </span>
              )}
              {filtered.length} / {columns.length}
            </span>
          </div>

          <div className="alias-table-wrap">
            <table className="alias-table">
              <thead>
                <tr>
                  <th className="alias-th-vis" title="Visibility — hidden columns won't appear in the workspace">
                    <Eye size={13} />
                  </th>
                  <th className="alias-th-col">Column Name</th>
                  <th className="alias-th-alias">Display Alias</th>
                  <th className="alias-th-action" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((col) => {
                  const isExcluded = excludedSet.has(col);
                  return (
                    <tr key={col} className={`alias-row${isExcluded ? " alias-row--excluded" : ""}`}>
                      <td className="alias-col-vis">
                        <button
                          className={`alias-vis-btn${isExcluded ? " alias-vis-btn--off" : ""}`}
                          onClick={() => toggleExclude(col)}
                          title={isExcluded ? "Show this column" : "Hide this column"}
                        >
                          {isExcluded ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </td>
                      <td className="alias-col-name" title={col}><code>{col}</code></td>
                      <td className="alias-col-alias">
                        <input
                          className="alias-input"
                          value={aliases[col] ?? col}
                          onChange={(e) => updateAlias(col, e.target.value)}
                          disabled={isExcluded}
                        />
                      </td>
                      <td className="alias-col-action">
                        <button className="alias-reset-btn" onClick={() => resetAlias(col)} title="Reset to strategy default">
                          <RotateCcw size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aggregations tab ── */}
      {activeTab === "aggregations" && (
        <div className="astep-panel">
          <p className="alias-step-desc">
            Configure default aggregations for measure columns.
            Dimensions (non-numeric) are used in <code>GROUP BY ALL</code>.
            Measures are wrapped in the chosen aggregation (e.g. <code>SUM</code>).
          </p>
          <AggregationSection
            columnMetas={columnMetas}
            aliases={aliases}
            aggregations={columnAggregations}
            onChange={onColumnAggregationsChange}
          />
        </div>
      )}

      {/* ── Grouping tab ── */}
      {activeTab === "grouping" && (
        <div className="astep-panel">
          <p className="alias-step-desc">
            Choose how columns are organized in selectors. Default splits by data type.
          </p>
          <GroupingSection
            columns={columns}
            config={columnGroups}
            onChange={onColumnGroupsChange}
          />
        </div>
      )}

      {showAbbrModal && createPortal(
        <AbbreviationModal
          onClose={() => setShowAbbrModal(false)}
          onApply={() => {
            onAliasesChange(generateAliases(columns, strategy));
            setShowAbbrModal(false);
          }}
        />,
        document.getElementById("themed-portal") ?? document.body,
      )}
    </div>
  );
}

/* ── Column Grouping Section ────────────────────── */

function GroupingSection({ columns, config, onChange }: {
  columns: string[];
  config: ColumnGroupConfig;
  onChange: (cfg: ColumnGroupConfig) => void;
}) {
  const mode = config.mode;
  const groups = config.groups ?? [];
  const [suggestions, setSuggestions] = useState<(SuggestedGroup & { selected: boolean })[] | null>(null);
  const [colRefOpen, setColRefOpen] = useState(false);

  const setMode = (m: GroupingMode) => {
    onChange({ ...config, mode: m });
    if (m === "custom" && groups.length === 0) setSuggestions(null);
  };

  const addGroup = () => {
    const name = `Group ${groups.length + 1}`;
    onChange({ ...config, mode: "custom", groups: [...groups, { name, patterns: [] }] });
  };

  const removeGroup = (idx: number) => {
    const next = groups.filter((_, i) => i !== idx);
    onChange({ ...config, groups: next, mode: next.length === 0 ? "measures_dimensions" : "custom" });
  };

  const renameGroup = (idx: number, name: string) => {
    const next = groups.map((g, i) => (i === idx ? { ...g, name } : g));
    onChange({ ...config, groups: next });
  };

  const addPatternFromInput = (gIdx: number, input: HTMLInputElement) => {
    const p = input.value.trim();
    if (!p) return;
    const next = groups.map((g, i) =>
      i === gIdx && !g.patterns.includes(p) ? { ...g, patterns: [...g.patterns, p] } : g,
    );
    onChange({ ...config, groups: next });
    input.value = "";
  };

  const removePattern = (gIdx: number, pIdx: number) => {
    const next = groups.map((g, i) =>
      i === gIdx ? { ...g, patterns: g.patterns.filter((_, j) => j !== pIdx) } : g,
    );
    onChange({ ...config, groups: next });
  };

  const handleAutoDetect = () => {
    const detected = detectColumnGroups(columns);
    const sorted = detected.sort((a, b) => b.columns.length - a.columns.length);
    const top = sorted.slice(0, 10);
    setSuggestions(top.map((g) => ({ ...g, selected: false })));
  };

  const toggleSuggestion = (idx: number) => {
    setSuggestions((prev) =>
      prev?.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)) ?? null,
    );
  };

  const selectAllSuggestions = () => {
    setSuggestions((prev) => prev?.map((s) => ({ ...s, selected: true })) ?? null);
  };

  const deselectAllSuggestions = () => {
    setSuggestions((prev) => prev?.map((s) => ({ ...s, selected: false })) ?? null);
  };

  const applySuggestions = () => {
    if (!suggestions) return;
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;
    const newGroups = selected.map((s) => ({ name: s.name, patterns: [s.pattern] }));
    onChange({ mode: "custom", groups: newGroups });
    setSuggestions(null);
  };

  const ungroupedCount = useMemo(() => {
    if (groups.length === 0) return columns.length;
    const allPatterns = groups.flatMap((g) => g.patterns);
    const matched = previewPatternMatches(columns, allPatterns);
    return columns.length - matched.length;
  }, [columns, groups]);

  return (
    <div className="grouping-section">
      <div className="grouping-mode-bar">
        <button
          className={`grouping-mode-btn${mode === "measures_dimensions" ? " grouping-mode-btn--active" : ""}`}
          onClick={() => setMode("measures_dimensions")}
        >
          <Hash size={14} /> Measures & Dimensions
        </button>
        <button
          className={`grouping-mode-btn${mode === "custom" ? " grouping-mode-btn--active" : ""}`}
          onClick={() => setMode("custom")}
        >
          <FolderOpen size={14} /> Custom Groups
        </button>
      </div>

      {mode === "measures_dimensions" && (
        <p className="grouping-hint">
          Columns will be split into <strong>Dimensions</strong> (text, date, boolean) and <strong>Measures</strong> (numeric) based on data type.
        </p>
      )}

      {mode === "custom" && (
        <div className="grouping-custom">
          {/* Auto-detect button */}
          {groups.length === 0 && !suggestions && (
            <button className="grouping-detect-btn" onClick={handleAutoDetect}>
              <Sparkles size={16} /> Auto-Detect Groups
              <span className="grouping-detect-sub">Analyze column name patterns</span>
            </button>
          )}

          {/* Suggested groups from auto-detect */}
          {suggestions && (
            <div className="grouping-suggestions">
              <div className="grouping-suggestions-header">
                <Sparkles size={14} />
                <span>Top {suggestions.length} group{suggestions.length !== 1 ? "s" : ""} detected</span>
                <span className="grouping-suggestions-hint">
                  Select groups to keep &bull; Remaining columns go to &ldquo;Other&rdquo;
                </span>
              </div>
              <div className="grouping-sg-select-bar">
                <button className="grouping-sg-select-link" onClick={selectAllSuggestions}>Select all</button>
                <span className="grouping-sg-select-sep">&bull;</span>
                <button className="grouping-sg-select-link" onClick={deselectAllSuggestions}>Deselect all</button>
                <span className="grouping-sg-select-count">
                  {suggestions.filter((s) => s.selected).length} / {suggestions.length} selected
                </span>
              </div>
              {suggestions.map((sg, idx) => (
                <button
                  key={idx}
                  className={`grouping-sg-card${sg.selected ? " grouping-sg-card--selected" : ""}`}
                  onClick={() => toggleSuggestion(idx)}
                >
                  <span className={`grouping-sg-check${sg.selected ? " grouping-sg-check--on" : ""}`}>
                    {sg.selected && <Check size={10} />}
                  </span>
                  <div className="grouping-sg-info">
                    <span className="grouping-sg-name">{sg.name}</span>
                    <span className="grouping-sg-pattern">{sg.pattern}</span>
                  </div>
                  <span className="grouping-sg-count">{sg.columns.length} cols</span>
                </button>
              ))}
              <div className="grouping-suggestions-actions">
                <button
                  className="grouping-detect-apply"
                  onClick={applySuggestions}
                  disabled={suggestions.filter((s) => s.selected).length === 0}
                >
                  <Check size={14} /> Apply Selected
                </button>
                <button className="grouping-detect-cancel" onClick={() => setSuggestions(null)}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Existing groups */}
          {groups.map((group, gIdx) => {
            const matched = previewPatternMatches(columns, group.patterns);
            return (
              <div key={gIdx} className="grouping-card">
                <div className="grouping-card-header">
                  <Layers size={14} />
                  <input
                    className="grouping-name-input"
                    value={group.name}
                    onChange={(e) => renameGroup(gIdx, e.target.value)}
                    placeholder="Group name"
                  />
                  <span className="grouping-match-count">{matched.length} matched</span>
                  <button className="grouping-remove-btn" onClick={() => removeGroup(gIdx)} title="Remove group">
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="grouping-patterns">
                  {group.patterns.map((p, pIdx) => (
                    <span key={pIdx} className="grouping-pattern-tag">
                      {p}
                      <button onClick={() => removePattern(gIdx, pIdx)}><X size={10} /></button>
                    </span>
                  ))}
                  <div className="grouping-pattern-add">
                    <input
                      id={`pat-input-${gIdx}`}
                      className="grouping-pattern-input"
                      placeholder="e.g. order_*"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addPatternFromInput(gIdx, e.currentTarget);
                      }}
                    />
                    <button
                      className="grouping-pattern-add-btn"
                      onClick={() => {
                        const input = document.getElementById(`pat-input-${gIdx}`) as HTMLInputElement | null;
                        if (input) addPatternFromInput(gIdx, input);
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {matched.length > 0 && (
                  <div className="grouping-preview">
                    {matched.slice(0, 10).map((c) => (
                      <span key={c} className="grouping-preview-tag">{c}</span>
                    ))}
                    {matched.length > 10 && (
                      <span className="grouping-preview-tag grouping-preview-tag--more">
                        +{matched.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {groups.length > 0 && (
            <>
              <div className="grouping-actions-bar">
                <button className="grouping-add-btn" onClick={addGroup}>
                  <Plus size={14} /> Add Group
                </button>
                <button className="grouping-detect-small" onClick={handleAutoDetect} title="Re-analyze patterns">
                  <Sparkles size={12} /> Re-Detect
                </button>
              </div>
              <p className="grouping-hint">
                {ungroupedCount > 0
                  ? <>{ungroupedCount} column{ungroupedCount !== 1 ? "s" : ""} not matching any pattern will appear under "Other".</>
                  : <>All columns are assigned to groups.</>}
              </p>
            </>
          )}

          {/* Column reference panel */}
          <div className="grouping-colref">
            <button className="grouping-colref-toggle" onClick={() => setColRefOpen((v) => !v)}>
              {colRefOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Column Reference ({columns.length})
            </button>
            {colRefOpen && (
              <div className="grouping-colref-list">
                {columns.map((c) => (
                  <span key={c} className="grouping-colref-tag">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Aggregation Section ────────────────────────── */

const AGG_OPTS: { id: ColumnAggregation; label: string }[] = [
  { id: "SUM", label: "SUM" },
  { id: "AVG", label: "AVG" },
  { id: "COUNT", label: "COUNT" },
  { id: "COUNT_DISTINCT", label: "DISTINCT" },
  { id: "MIN", label: "MIN" },
  { id: "MAX", label: "MAX" },
  { id: "NONE", label: "NONE" },
];

function AggregationSection({ columnMetas, aliases, aggregations, onChange }: {
  columnMetas: ColumnMeta[];
  aliases: Record<string, string>;
  aggregations: Record<string, ColumnAggregation>;
  onChange: (aggs: Record<string, ColumnAggregation>) => void;
}) {
  const [search, setSearch] = useState("");

  const measures = useMemo(
    () => columnMetas.filter((c) => NUMERIC_RE.test(c.data_type)),
    [columnMetas],
  );
  const dimensions = useMemo(
    () => columnMetas.filter((c) => !NUMERIC_RE.test(c.data_type)),
    [columnMetas],
  );

  const filteredMeasures = useMemo(() => {
    if (!search.trim()) return measures;
    const q = search.toLowerCase();
    return measures.filter(
      (c) => c.col_name.toLowerCase().includes(q) || (aliases[c.col_name] ?? "").toLowerCase().includes(q),
    );
  }, [measures, search, aliases]);

  const setAgg = (col: string, agg: ColumnAggregation) => {
    onChange({ ...aggregations, [col]: agg });
  };

  const removeAgg = (col: string) => {
    onChange({ ...aggregations, [col]: "NONE" });
  };

  const setAllMeasures = (agg: ColumnAggregation) => {
    const next = { ...aggregations };
    for (const m of measures) next[m.col_name] = agg;
    onChange(next);
  };

  return (
    <div className="agg-section">
      <div className="agg-toolbar">
        <div className="agg-search-bar">
          <Search size={14} />
          <input
            className="alias-search-input"
            placeholder="Search measures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="agg-bulk">
          <span className="agg-bulk-label">Set all measures to:</span>
          {AGG_OPTS.slice(0, 4).map((opt) => (
            <button
              key={opt.id}
              className="agg-bulk-btn"
              onClick={() => setAllMeasures(opt.id)}
              title={`Set all measures to ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="agg-summary">
        <span className="agg-summary-item">
          <Sigma size={13} /> <strong>{measures.length}</strong> measures
        </span>
        <span className="agg-summary-item">
          <Hash size={13} /> <strong>{dimensions.length}</strong> dimensions
        </span>
        <span className="agg-summary-hint">
          Dimensions are automatically included in GROUP BY ALL
        </span>
      </div>

      <div className="alias-table-wrap">
        <table className="alias-table">
          <thead>
            <tr>
              <th className="alias-th-col">Column</th>
              <th className="alias-th-alias">Display Name</th>
              <th className="agg-th-type">Data Type</th>
              <th className="agg-th-agg">Aggregation</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeasures.map((col) => {
              const agg = aggregations[col.col_name] ?? "SUM";
              return (
                <tr key={col.col_name} className="alias-row">
                  <td className="alias-col-name" title={col.col_name}><code>{col.col_name}</code></td>
                  <td className="alias-col-alias">{aliases[col.col_name] ?? col.col_name}</td>
                  <td className="agg-col-type"><code>{col.data_type}</code></td>
                  <td className="agg-col-agg">
                    <select
                      className="agg-select"
                      value={agg}
                      onChange={(e) => setAgg(col.col_name, e.target.value as ColumnAggregation)}
                    >
                      {AGG_OPTS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      className="agg-remove-btn"
                      onClick={() => removeAgg(col.col_name)}
                      title="Remove aggregation (treat as dimension)"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredMeasures.length === 0 && (
              <tr>
                <td colSpan={4} className="agg-empty">
                  {measures.length === 0 ? "No numeric columns detected" : "No matches"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Abbreviation Dictionary Modal ───────────────── */

function AbbreviationModal({ onClose, onApply }: { onClose: () => void; onApply: () => void }) {
  const [entries, setEntries] = useState<AbbreviationEntry[]>(() => [...getAbbreviations()]);
  const [newWord, setNewWord] = useState("");
  const [newAbbr, setNewAbbr] = useState("");
  const { offset, handleMouseDown } = useDraggableModal();

  const updateEntry = (idx: number, field: "word" | "abbr", value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEntry = () => {
    const w = newWord.trim().toLowerCase();
    const a = newAbbr.trim();
    if (!w || !a) return;
    if (entries.some((e) => e.word.toLowerCase() === w)) return;
    setEntries((prev) => [...prev, { word: w, abbr: a }]);
    setNewWord("");
    setNewAbbr("");
  };

  const handleApply = () => {
    setAbbreviations(entries);
    onApply();
  };

  const handleReset = () => {
    setEntries(getDefaultAbbreviations());
  };

  return (
    <div className="alias-modal-backdrop" onClick={onClose}>
      <div className="alias-modal" onClick={(e) => e.stopPropagation()} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="alias-modal-header drag-handle" onMouseDown={handleMouseDown}>
          <h3 className="alias-modal-title"><BookOpen size={16} /> Abbreviation Dictionary</h3>
          <button className="alias-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="alias-modal-desc">
          Define word &rarr; abbreviation rules. When &quot;Smart Abbreviate&quot; is used, matching words are replaced.
        </p>

        <div className="abbr-table-wrap">
          <table className="abbr-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Abbreviation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i}>
                  <td>
                    <input className="abbr-input" value={entry.word} onChange={(e) => updateEntry(i, "word", e.target.value)} />
                  </td>
                  <td>
                    <input className="abbr-input" value={entry.abbr} onChange={(e) => updateEntry(i, "abbr", e.target.value)} />
                  </td>
                  <td>
                    <button className="abbr-remove" onClick={() => removeEntry(i)} title="Remove"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              <tr className="abbr-add-row">
                <td>
                  <input className="abbr-input" placeholder="word" value={newWord} onChange={(e) => setNewWord(e.target.value)} />
                </td>
                <td>
                  <input className="abbr-input" placeholder="abbr" value={newAbbr} onChange={(e) => setNewAbbr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEntry()} />
                </td>
                <td>
                  <button className="abbr-add-btn" onClick={addEntry} title="Add"><Plus size={12} /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="alias-modal-footer">
          <button className="alias-modal-reset" onClick={handleReset}>Reset to Defaults</button>
          <div className="alias-modal-actions">
            <button className="alias-modal-cancel" onClick={onClose}>Cancel</button>
            <button className="alias-modal-apply" onClick={handleApply}>Apply &amp; Regenerate</button>
          </div>
        </div>
      </div>
    </div>
  );
}
