import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Hash, Type, Layers, Sparkles, Plus, Trash2, X,
  ChevronDown, ChevronRight, Check, Search, MousePointerClick,
} from "lucide-react";
import {
  previewPatternMatches, detectColumnGroups, type SuggestedGroup,
} from "@/lib/columnGroupResolver";
import { NUMERIC_RE } from "@/lib/constants";
import type { ColumnGroupConfig, ColumnGroupDef, ColumnMeta } from "@/types/dashboard";

interface GroupingSectionProps {
  columnMetas: ColumnMeta[];
  config: ColumnGroupConfig;
  onChange: (cfg: ColumnGroupConfig) => void;
}

type Level = "dimensions" | "measures";

/* ── Column Picker Modal ── */

function ColumnPickerModal({
  title,
  available,
  initialSelected,
  onApply,
  onClose,
}: {
  title: string;
  available: string[];
  initialSelected: Set<string>;
  onApply: (selected: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!search) return available;
    const q = search.toLowerCase();
    return available.filter((c) => c.toLowerCase().includes(q));
  }, [available, search]);

  const toggle = (col: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered));
  const clearAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filtered) next.delete(c);
      return next;
    });
  };

  const handleApply = () => {
    onApply(available.filter((c) => selected.has(c)));
    onClose();
  };

  const selCount = filtered.filter((c) => selected.has(c)).length;

  return (
    <div className="grp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grp-modal">
        <div className="grp-modal-header">
          <span className="grp-modal-title">
            <MousePointerClick size={14} /> Pick Columns — {title}
          </span>
          <button className="grp-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="grp-modal-toolbar">
          <div className="grp-modal-search">
            <Search size={13} />
            <input
              className="grp-modal-search-input"
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button className="grp-modal-search-clear" onClick={() => setSearch("")}><X size={11} /></button>
            )}
          </div>
          <div className="grp-modal-actions">
            <button className="grp-modal-action" onClick={selectAll}>Select All</button>
            <button className="grp-modal-action" onClick={clearAll}>Clear All</button>
            <span className="grp-modal-sel-count">{selCount} / {filtered.length} selected</span>
          </div>
        </div>

        <div className="grp-modal-list">
          {filtered.length === 0 && (
            <p className="grp-modal-empty">
              {search ? "No columns match your search" : "No available columns"}
            </p>
          )}
          {filtered.map((col) => {
            const checked = selected.has(col);
            return (
              <button
                key={col}
                className={`grp-modal-item${checked ? " grp-modal-item--on" : ""}`}
                onClick={() => toggle(col)}
              >
                <span className={`grp-modal-check${checked ? " grp-modal-check--on" : ""}`}>
                  {checked && <Check size={10} />}
                </span>
                <span className="grp-modal-col-name">{col}</span>
              </button>
            );
          })}
        </div>

        <div className="grp-modal-footer">
          <button className="grp-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="grp-modal-apply" onClick={handleApply}>
            <Check size={14} /> Apply ({selected.size} column{selected.size !== 1 ? "s" : ""})
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Level Section (Dimensions or Measures) ── */

function LevelSection({
  level,
  label,
  icon: Icon,
  columnNames,
  groups,
  onGroupsChange,
  allColumnNames,
}: {
  level: Level;
  label: string;
  icon: typeof Hash;
  columnNames: string[];
  groups: ColumnGroupDef[];
  onGroupsChange: (g: ColumnGroupDef[]) => void;
  allColumnNames: string[];
}) {
  const [suggestions, setSuggestions] = useState<(SuggestedGroup & { selected: boolean })[] | null>(null);
  const [colRefOpen, setColRefOpen] = useState(false);
  const [open, setOpen] = useState(groups.length === 0);
  const [pickerGroupIdx, setPickerGroupIdx] = useState<number | null>(null);

  const assignedByGroup = useMemo(() => {
    const result: Map<number, Set<string>> = new Map();
    const globalAssigned = new Set<string>();
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const patternMatched = previewPatternMatches(columnNames, g.patterns);
      const explicit = (g.columns ?? []).filter((c) => columnNames.includes(c));
      const combined = new Set([...patternMatched, ...explicit]);
      const thisGroup = new Set<string>();
      for (const c of combined) {
        if (!globalAssigned.has(c)) {
          globalAssigned.add(c);
          thisGroup.add(c);
        }
      }
      result.set(i, thisGroup);
    }
    return { byGroup: result, all: globalAssigned };
  }, [columnNames, groups]);

  const availableForGroup = useCallback(
    (gIdx: number): string[] => {
      const thisGroupCols = assignedByGroup.byGroup.get(gIdx) ?? new Set<string>();
      return columnNames.filter(
        (c) => !assignedByGroup.all.has(c) || thisGroupCols.has(c),
      );
    },
    [columnNames, assignedByGroup],
  );

  const addGroup = () => {
    onGroupsChange([...groups, { name: `${label} Group ${groups.length + 1}`, patterns: [], columns: [] }]);
  };

  const removeGroup = (idx: number) => {
    onGroupsChange(groups.filter((_, i) => i !== idx));
  };

  const renameGroup = (idx: number, name: string) => {
    onGroupsChange(groups.map((g, i) => (i === idx ? { ...g, name } : g)));
  };

  const addPatternFromInput = (gIdx: number, input: HTMLInputElement) => {
    const p = input.value.trim();
    if (!p) return;
    onGroupsChange(
      groups.map((g, i) =>
        i === gIdx && !g.patterns.includes(p) ? { ...g, patterns: [...g.patterns, p] } : g,
      ),
    );
    input.value = "";
  };

  const removePattern = (gIdx: number, pIdx: number) => {
    onGroupsChange(
      groups.map((g, i) =>
        i === gIdx ? { ...g, patterns: g.patterns.filter((_, j) => j !== pIdx) } : g,
      ),
    );
  };

  const applyPickedColumns = (gIdx: number, selected: string[]) => {
    onGroupsChange(
      groups.map((g, i) => (i === gIdx ? { ...g, columns: selected } : g)),
    );
  };

  const removePickedColumn = (gIdx: number, col: string) => {
    onGroupsChange(
      groups.map((g, i) =>
        i === gIdx ? { ...g, columns: (g.columns ?? []).filter((c) => c !== col) } : g,
      ),
    );
  };

  const handleAutoDetect = () => {
    const detected = detectColumnGroups(allColumnNames, 2, columnNames);
    const sorted = detected.sort((a, b) => b.columns.length - a.columns.length);
    setSuggestions(sorted.slice(0, 10).map((g) => ({ ...g, selected: false })));
  };

  const toggleSuggestion = (idx: number) => {
    setSuggestions((prev) =>
      prev?.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)) ?? null,
    );
  };

  const selectAllSuggestions = () =>
    setSuggestions((prev) => prev?.map((s) => ({ ...s, selected: true })) ?? null);

  const deselectAllSuggestions = () =>
    setSuggestions((prev) => prev?.map((s) => ({ ...s, selected: false })) ?? null);

  const applySuggestions = () => {
    if (!suggestions) return;
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;
    const newGroups = selected.map((s) => ({ name: s.name, patterns: [s.pattern], columns: [] as string[] }));
    onGroupsChange([...groups, ...newGroups]);
    setSuggestions(null);
  };

  const ungroupedCount = useMemo(() => {
    return columnNames.length - assignedByGroup.all.size;
  }, [columnNames, assignedByGroup]);

  if (columnNames.length === 0) return null;

  return (
    <div className="grouping-level-section">
      <button className="grouping-level-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} />
        <span className="grouping-level-title">{label}</span>
        <span className="grouping-level-count">{columnNames.length} columns</span>
      </button>

      {open && (
        <div className="grouping-level-body">
          {groups.length === 0 && !suggestions && (
            <div className="grouping-level-empty">
              <p className="grouping-hint">
                No sub-categories defined. All {label.toLowerCase()} columns will appear in a single group.
              </p>
              <div className="grouping-level-actions">
                <button className="grouping-detect-btn" onClick={handleAutoDetect}>
                  <Sparkles size={14} /> Auto-Detect Sub-Categories
                </button>
                <button className="grouping-add-btn" onClick={addGroup}>
                  <Plus size={14} /> Add Manually
                </button>
              </div>
            </div>
          )}

          {suggestions && (
            <div className="grouping-suggestions">
              <div className="grouping-suggestions-header">
                <Sparkles size={14} />
                <span>Top {suggestions.length} sub-categor{suggestions.length !== 1 ? "ies" : "y"} detected</span>
                <span className="grouping-suggestions-hint">
                  Select groups to keep &bull; Remaining go to &ldquo;Other&rdquo;
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

          {groups.map((group, gIdx) => {
            const patternMatched = previewPatternMatches(columnNames, group.patterns);
            const explicitCols = (group.columns ?? []).filter((c) => columnNames.includes(c));
            const allMatched = [...new Set([...patternMatched, ...explicitCols])];
            return (
              <div key={gIdx} className="grouping-card">
                <div className="grouping-card-header">
                  <Layers size={14} />
                  <input
                    className="grouping-name-input"
                    value={group.name}
                    onChange={(e) => renameGroup(gIdx, e.target.value)}
                    placeholder="Sub-category name"
                  />
                  <span className="grouping-match-count">{allMatched.length} matched</span>
                  <button className="grouping-remove-btn" onClick={() => removeGroup(gIdx)} title="Remove sub-category">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Pattern-based assignment */}
                <div className="grouping-patterns">
                  {group.patterns.map((p, pIdx) => (
                    <span key={pIdx} className="grouping-pattern-tag">
                      {p}
                      <button onClick={() => removePattern(gIdx, pIdx)}><X size={10} /></button>
                    </span>
                  ))}
                  <div className="grouping-pattern-add">
                    <input
                      id={`pat-input-${level}-${gIdx}`}
                      className="grouping-pattern-input"
                      placeholder="e.g. order_*"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addPatternFromInput(gIdx, e.currentTarget);
                      }}
                    />
                    <button
                      className="grouping-pattern-add-btn"
                      onClick={() => {
                        const input = document.getElementById(`pat-input-${level}-${gIdx}`) as HTMLInputElement | null;
                        if (input) addPatternFromInput(gIdx, input);
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Manually picked columns */}
                <div className="grouping-picked">
                  {explicitCols.map((c) => (
                    <span key={c} className="grouping-picked-tag">
                      {c}
                      <button onClick={() => removePickedColumn(gIdx, c)}><X size={10} /></button>
                    </span>
                  ))}
                  <button className="grp-picker-toggle" onClick={() => setPickerGroupIdx(gIdx)}>
                    <MousePointerClick size={12} /> Pick Columns
                  </button>
                </div>

                {allMatched.length > 0 && (
                  <div className="grouping-preview">
                    {allMatched.slice(0, 10).map((c) => (
                      <span key={c} className="grouping-preview-tag">{c}</span>
                    ))}
                    {allMatched.length > 10 && (
                      <span className="grouping-preview-tag grouping-preview-tag--more">
                        +{allMatched.length - 10} more
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
                  <Plus size={14} /> Add Sub-Category
                </button>
                <button className="grouping-detect-small" onClick={handleAutoDetect} title="Re-analyze patterns">
                  <Sparkles size={12} /> Re-Detect
                </button>
              </div>
              <p className="grouping-hint">
                {ungroupedCount > 0
                  ? <>{ungroupedCount} column{ungroupedCount !== 1 ? "s" : ""} not matching any pattern will appear under &ldquo;Other&rdquo;.</>
                  : <>All columns are assigned to sub-categories.</>}
              </p>
            </>
          )}

          <div className="grouping-colref">
            <button className="grouping-colref-toggle" onClick={() => setColRefOpen((v) => !v)}>
              {colRefOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {label} Column Reference ({columnNames.length})
            </button>
            {colRefOpen && (
              <div className="grouping-colref-list">
                {columnNames.map((c) => (
                  <span key={c} className="grouping-colref-tag">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {pickerGroupIdx !== null && groups[pickerGroupIdx] && (
        <ColumnPickerModal
          title={groups[pickerGroupIdx].name}
          available={availableForGroup(pickerGroupIdx)}
          initialSelected={new Set((groups[pickerGroupIdx].columns ?? []).filter((c) => columnNames.includes(c)))}
          onApply={(sel) => applyPickedColumns(pickerGroupIdx, sel)}
          onClose={() => setPickerGroupIdx(null)}
        />
      )}
    </div>
  );
}

export default function GroupingSection({ columnMetas, config, onChange }: GroupingSectionProps) {
  const dimensionNames = useMemo(
    () => columnMetas.filter((c) => !NUMERIC_RE.test(c.data_type)).map((c) => c.col_name),
    [columnMetas],
  );
  const measureNames = useMemo(
    () => columnMetas.filter((c) => NUMERIC_RE.test(c.data_type)).map((c) => c.col_name),
    [columnMetas],
  );
  const allNames = useMemo(() => columnMetas.map((c) => c.col_name), [columnMetas]);

  const dimGroups = config.dimensionGroups ?? [];
  const meaGroups = config.measureGroups ?? [];

  const setDimGroups = useCallback(
    (g: ColumnGroupDef[]) => onChange({ ...config, dimensionGroups: g }),
    [config, onChange],
  );

  const setMeaGroups = useCallback(
    (g: ColumnGroupDef[]) => onChange({ ...config, measureGroups: g }),
    [config, onChange],
  );

  return (
    <div className="grouping-section">
      <p className="grouping-hint" style={{ marginBottom: 12 }}>
        Columns are automatically split into <strong>Dimensions</strong> (text, date, boolean)
        and <strong>Measures</strong> (numeric). Define optional sub-categories within each
        using patterns or by picking columns directly.
      </p>

      <LevelSection
        level="dimensions"
        label="Dimensions"
        icon={Type}
        columnNames={dimensionNames}
        groups={dimGroups}
        onGroupsChange={setDimGroups}
        allColumnNames={allNames}
      />

      <LevelSection
        level="measures"
        label="Measures"
        icon={Hash}
        columnNames={measureNames}
        groups={meaGroups}
        onGroupsChange={setMeaGroups}
        allColumnNames={allNames}
      />
    </div>
  );
}
