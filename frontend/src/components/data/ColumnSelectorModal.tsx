import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Check, Search, Hash, Type, Sigma, GitMerge,
  ChevronDown, ChevronRight, GripVertical, ChevronsUpDown,
  ChevronsUp, ChevronUp, ChevronsDown,
} from "lucide-react";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { NUMERIC_RE } from "@/lib/constants";
import { resolveColumnGroupsHierarchical, type ResolvedGroup, type ResolvedLevel1Group } from "@/lib/columnGroupResolver";
import type { ColumnAggregation, ColumnMeta } from "@/types/dashboard";

const AGG_OPTIONS: { id: ColumnAggregation; label: string }[] = [
  { id: "SUM", label: "SUM" },
  { id: "AVG", label: "AVG" },
  { id: "COUNT", label: "COUNT" },
  { id: "COUNT_DISTINCT", label: "DISTINCT" },
  { id: "MIN", label: "MIN" },
  { id: "MAX", label: "MAX" },
  { id: "NONE", label: "NONE" },
];

interface Props {
  onClose: () => void;
}

function SortableSelectedCol({ name, displayLabel, meta, isFormula, agg, onAggChange, onRemove, checked, onToggleCheck }: {
  name: string; displayLabel: string; meta: ColumnMeta | undefined; isFormula: boolean;
  agg?: ColumnAggregation; onAggChange?: (agg: ColumnAggregation) => void; onRemove: () => void;
  checked: boolean; onToggleCheck: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: name });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isNum = meta ? NUMERIC_RE.test(meta.data_type) : false;

  return (
    <div ref={setNodeRef} style={style} className={`csm-sel-item${checked ? " csm-sel-item--checked" : ""}`} {...attributes}>
      <button className={`csm-sel-check ${checked ? "csm-sel-check--on" : ""}`} onClick={onToggleCheck}>
        {checked && <Check size={8} />}
      </button>
      <span className="csm-sel-grip" {...listeners}><GripVertical size={11} /></span>
      <span className={`colpick-icon ${isFormula ? "colpick-icon--formula" : isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
        {isFormula ? <Sigma size={10} /> : isNum ? <Hash size={10} /> : <Type size={10} />}
      </span>
      <span className="csm-sel-name">{displayLabel}</span>
      {isNum && !isFormula && onAggChange && (
        <select
          className="csm-agg-select"
          value={agg ?? "SUM"}
          onChange={(e) => onAggChange(e.target.value as ColumnAggregation)}
          onClick={(e) => e.stopPropagation()}
        >
          {AGG_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      )}
      {!isNum && !isFormula && meta && <span className="colpick-dtype">dim</span>}
      {isFormula && <span className="colpick-dtype">formula</span>}
      <button className="csm-sel-remove" onClick={onRemove}><X size={10} /></button>
    </div>
  );
}

export default function ColumnSelectorModal({ onClose }: Props) {
  const {
    selectedCatalog, selectedSchema, selectedTable, columns,
    selectedOutputColumns, setOutputColumns, toggleOutputColumn, reorderOutputColumns,
    activeWorkspace, setColumnAggregation, resolvedAggregations,
  } = useStore();
  const alias = useColumnAlias();

  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const overlayRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null);
  const primaryCols: ColumnMeta[] = useMemo(
    () => (colKey ? columns[colKey] ?? [] : []),
    [colKey, columns],
  );

  const wsJoins = activeWorkspace?.joins ?? [];
  const joinedGroups: { table: string; fqKey: string; cols: ColumnMeta[] }[] = useMemo(() => {
    if (!selectedCatalog || !selectedSchema || wsJoins.length === 0) return [];
    return wsJoins
      .filter((j) => j.table)
      .map((j) => {
        const fqKey = `${selectedCatalog}.${selectedSchema}.${j.table}`;
        return { table: j.table, fqKey, cols: columns[fqKey] ?? [] };
      })
      .filter((g) => g.cols.length > 0);
  }, [selectedCatalog, selectedSchema, wsJoins, columns]);

  const allCols: ColumnMeta[] = useMemo(
    () => [...primaryCols, ...joinedGroups.flatMap((g) => g.cols)],
    [primaryCols, joinedGroups],
  );

  const colMap = useMemo(() => {
    const m = new Map<string, ColumnMeta>();
    for (const c of allCols) m.set(c.col_name, c);
    return m;
  }, [allCols]);

  const selSet = useMemo(() => new Set(selectedOutputColumns), [selectedOutputColumns]);

  const resolveLabel = useCallback(
    (name: string) => name.startsWith("__fc__") ? name.replace(/^__fc__.*?__/, "") : alias(name),
    [alias],
  );

  /* ── Column groups (resolved from workspace config) ── */
  const rawHierarchy = useMemo(
    () => resolveColumnGroupsHierarchical(primaryCols, activeWorkspace?.column_groups),
    [primaryCols, activeWorkspace?.column_groups],
  );

  const measures = useMemo(
    () => allCols.filter((c) => NUMERIC_RE.test(c.data_type)),
    [allCols],
  );
  const dimensions = useMemo(
    () => allCols.filter((c) => !NUMERIC_RE.test(c.data_type)),
    [allCols],
  );

  const filterBySearch = useCallback(
    (cols: ColumnMeta[]) => {
      if (!leftSearch) return cols;
      const q = leftSearch.toLowerCase();
      return cols.filter((c) =>
        c.col_name.toLowerCase().includes(q) || alias(c.col_name).toLowerCase().includes(q),
      );
    },
    [leftSearch, alias],
  );

  const filteredHierarchy: ResolvedLevel1Group[] = useMemo(
    () => rawHierarchy.map((l1) => ({
      ...l1,
      allColumns: filterBySearch(l1.allColumns),
      subGroups: l1.subGroups.map((sg) => ({ ...sg, columns: filterBySearch(sg.columns) })).filter((sg) => sg.columns.length > 0),
    })).filter((l1) => l1.allColumns.length > 0),
    [rawHierarchy, filterBySearch],
  );

  const filteredJoinedGroups = useMemo(
    () => joinedGroups.map((g) => ({ ...g, cols: filterBySearch(g.cols) })).filter((g) => g.cols.length > 0),
    [joinedGroups, filterBySearch],
  );

  const allSelected = allCols.length > 0 && allCols.every((c) => selSet.has(c.col_name));

  const filteredSelected = useMemo(() => {
    if (!rightSearch) return selectedOutputColumns;
    const q = rightSearch.toLowerCase();
    return selectedOutputColumns.filter((n) => {
      const label = resolveLabel(n);
      return label.toLowerCase().includes(q) || n.toLowerCase().includes(q);
    });
  }, [selectedOutputColumns, rightSearch, resolveLabel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const keys: string[] = [];
    for (const l1 of rawHierarchy) {
      keys.push(l1.key);
      for (const sg of l1.subGroups) keys.push(`${l1.key}::${sg.key}`);
    }
    for (const jg of joinedGroups) keys.push(`join-${jg.table}`);
    setExpanded(new Set(keys));
  }, [rawHierarchy, joinedGroups]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const toggleGroupNames = useCallback((names: string[]) => {
    const allIn = names.every((n) => selSet.has(n));
    if (allIn) {
      const remove = new Set(names);
      setOutputColumns(selectedOutputColumns.filter((n) => !remove.has(n)));
    } else {
      const current = new Set(selectedOutputColumns);
      for (const n of names) current.add(n);
      setOutputColumns(Array.from(current));
    }
  }, [selSet, selectedOutputColumns, setOutputColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = selectedOutputColumns.indexOf(active.id as string);
    const to = selectedOutputColumns.indexOf(over.id as string);
    if (from >= 0 && to >= 0) reorderOutputColumns(from, to);
  }, [selectedOutputColumns, reorderOutputColumns]);

  /* ── Multi-select for batch reorder ── */
  const [checkedCols, setCheckedCols] = useState<Set<string>>(new Set());

  const toggleCheck = useCallback((name: string) => {
    setCheckedCols((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const checkedCount = checkedCols.size;
  const allChecked = selectedOutputColumns.length > 0 && selectedOutputColumns.every((n) => checkedCols.has(n));

  const toggleCheckAll = useCallback(() => {
    if (allChecked) {
      setCheckedCols(new Set());
    } else {
      setCheckedCols(new Set(selectedOutputColumns));
    }
  }, [allChecked, selectedOutputColumns]);

  const batchMove = useCallback((direction: "top" | "up" | "down" | "bottom") => {
    if (checkedCount === 0) return;
    const arr = [...selectedOutputColumns];
    const checked = new Set(checkedCols);
    const selected = arr.filter((c) => checked.has(c));
    const rest = arr.filter((c) => !checked.has(c));

    let result: string[];
    switch (direction) {
      case "top":
        result = [...selected, ...rest];
        break;
      case "bottom":
        result = [...rest, ...selected];
        break;
      case "up": {
        result = [...arr];
        const indices = selected.map((s) => result.indexOf(s)).sort((a, b) => a - b);
        for (const idx of indices) {
          if (idx <= 0 || checked.has(result[idx - 1])) continue;
          [result[idx - 1], result[idx]] = [result[idx], result[idx - 1]];
        }
        break;
      }
      case "down": {
        result = [...arr];
        const indices = selected.map((s) => result.indexOf(s)).sort((a, b) => b - a);
        for (const idx of indices) {
          if (idx >= result.length - 1 || checked.has(result[idx + 1])) continue;
          [result[idx + 1], result[idx]] = [result[idx], result[idx + 1]];
        }
        break;
      }
    }
    setOutputColumns(result);
  }, [selectedOutputColumns, checkedCols, checkedCount, setOutputColumns]);

  const handleSelectAll = () => {
    if (allSelected) setOutputColumns([]);
    else setOutputColumns(allCols.map((c) => c.col_name));
  };

  const renderColumnItem = (col: ColumnMeta) => {
    const checked = selSet.has(col.col_name);
    const isNum = NUMERIC_RE.test(col.data_type);
    return (
      <button
        key={col.col_name}
        className={`csm-col-item ${checked ? "csm-col-item--selected" : ""}`}
        onClick={() => toggleOutputColumn(col.col_name)}
      >
        <span className={`colpick-check ${checked ? "colpick-check--on" : ""}`}>
          {checked && <Check size={10} />}
        </span>
        <span className={`colpick-icon ${isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
          {isNum ? <Hash size={10} /> : <Type size={10} />}
        </span>
        <span className="csm-col-name">{alias(col.col_name)}</span>
        <span className="colpick-dtype">{col.data_type}</span>
      </button>
    );
  };

  const renderGroup = (group: ResolvedGroup) => {
    const names = group.columns.map((c) => c.col_name);
    const isOpen = expanded.has(group.key);
    const allIn = names.length > 0 && names.every((n) => selSet.has(n));
    const someIn = !allIn && names.some((n) => selSet.has(n));
    const isBuiltInNum = group.key === "measures";
    const Icon = isBuiltInNum ? Hash : Type;
    const iconClass = isBuiltInNum ? "colpick-icon--num" : "colpick-icon--text";
    return (
      <div key={group.key} className="csm-group">
        <div className="csm-group-header">
          <button className="csm-group-toggle" onClick={() => toggleSection(group.key)}>
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Icon size={12} className={iconClass} />
            <span className="csm-group-label">{group.label}</span>
            <span className="csm-group-count">{names.length}</span>
          </button>
          <button
            className={`colpick-group-check ${allIn ? "colpick-group-check--on" : someIn ? "colpick-group-check--partial" : ""}`}
            onClick={() => toggleGroupNames(names)}
            title={allIn ? "Deselect group" : "Select group"}
          >
            {allIn && <Check size={9} />}
            {someIn && !allIn && <span style={{ fontSize: "9px" }}>-</span>}
          </button>
        </div>
        {isOpen && (
          <div className="csm-group-items">
            {group.columns.map((c) => renderColumnItem(c))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sql-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="csm-modal" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        {/* Header */}
        <div className="fm-header drag-handle" onMouseDown={handleMouseDown}>
          <span className="fm-title">Select Output Columns</span>
          <button className="sql-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body: dual pane */}
        <div className="csm-body">
          {/* LEFT: Available columns */}
          <div className="csm-pane">
            <div className="csm-pane-header">
              <span className="csm-pane-title">Available Columns</span>
              <span className="csm-pane-count">{allCols.length}</span>
            </div>

            <div className="csm-pane-actions">
              <button className="colpick-btn" onClick={handleSelectAll}>
                {allSelected ? "Clear All" : "Select All"}
              </button>
              <button className="colpick-btn" onClick={() => setOutputColumns(dimensions.map((c) => c.col_name))}>
                Dimensions
              </button>
              <button className="colpick-btn" onClick={() => setOutputColumns(measures.map((c) => c.col_name))}>
                Measures
              </button>
              <button className="colpick-btn" onClick={expandAll}>
                <ChevronsUpDown size={10} /> Expand
              </button>
              <button className="colpick-btn" onClick={collapseAll}>
                <ChevronsUpDown size={10} /> Collapse
              </button>
            </div>

            <div className="csm-pane-search">
              <Search size={12} />
              <input
                className="csm-pane-search-input"
                placeholder="Search columns..."
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
              />
              {leftSearch && (
                <button className="csm-search-clear" onClick={() => setLeftSearch("")}><X size={11} /></button>
              )}
            </div>

            <div className="csm-pane-list">
              {filteredHierarchy.map((l1) => {
                const l1Open = expanded.has(l1.key);
                const l1Names = l1.allColumns.map((c) => c.col_name);
                const l1AllIn = l1Names.length > 0 && l1Names.every((n) => selSet.has(n));
                const l1SomeIn = !l1AllIn && l1Names.some((n) => selSet.has(n));
                const L1Icon = l1.isNumeric ? Hash : Type;
                const hasSubCategories = l1.subGroups.length > 1 || (l1.subGroups.length === 1 && l1.subGroups[0].key !== l1.key);
                return (
                  <div key={l1.key} className="csm-group csm-group--level1">
                    <div className="csm-group-header">
                      <button className="csm-group-toggle" onClick={() => toggleSection(l1.key)}>
                        {l1Open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <L1Icon size={12} className={l1.isNumeric ? "colpick-icon--num" : "colpick-icon--text"} />
                        <span className="csm-group-label">{l1.label}</span>
                        <span className="csm-group-count">{l1Names.length}</span>
                      </button>
                      <button
                        className={`colpick-group-check ${l1AllIn ? "colpick-group-check--on" : l1SomeIn ? "colpick-group-check--partial" : ""}`}
                        onClick={() => toggleGroupNames(l1Names)}
                        title={l1AllIn ? "Deselect all" : "Select all"}
                      >
                        {l1AllIn && <Check size={9} />}
                        {l1SomeIn && !l1AllIn && <span style={{ fontSize: "9px" }}>-</span>}
                      </button>
                    </div>
                    {l1Open && hasSubCategories && l1.subGroups.map((sg) => {
                      const sgKey = `${l1.key}::${sg.key}`;
                      const sgOpen = expanded.has(sgKey);
                      const sgNames = sg.columns.map((c) => c.col_name);
                      const sgAllIn = sgNames.length > 0 && sgNames.every((n) => selSet.has(n));
                      const sgSomeIn = !sgAllIn && sgNames.some((n) => selSet.has(n));
                      return (
                        <div key={sgKey} className="csm-group csm-group--sub">
                          <div className="csm-group-header">
                            <button className="csm-group-toggle" onClick={() => toggleSection(sgKey)}>
                              {sgOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              <span className="csm-group-label csm-group-label--sub">{sg.label}</span>
                              <span className="csm-group-count">{sgNames.length}</span>
                            </button>
                            <button
                              className={`colpick-group-check ${sgAllIn ? "colpick-group-check--on" : sgSomeIn ? "colpick-group-check--partial" : ""}`}
                              onClick={() => toggleGroupNames(sgNames)}
                            >
                              {sgAllIn && <Check size={9} />}
                              {sgSomeIn && !sgAllIn && <span style={{ fontSize: "9px" }}>-</span>}
                            </button>
                          </div>
                          {sgOpen && (
                            <div className="csm-group-items">
                              {sg.columns.map((c) => renderColumnItem(c))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {l1Open && !hasSubCategories && (
                      <div className="csm-group-items">
                        {l1.allColumns.map((c) => renderColumnItem(c))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredJoinedGroups.map((jg) => {
                const names = jg.cols.map((c) => c.col_name);
                const isOpen = expanded.has(`join-${jg.table}`);
                const allIn = names.length > 0 && names.every((n) => selSet.has(n));
                const someIn = !allIn && names.some((n) => selSet.has(n));
                return (
                  <div key={`join-${jg.table}`} className="csm-group">
                    <div className="csm-group-header">
                      <button className="csm-group-toggle" onClick={() => toggleSection(`join-${jg.table}`)}>
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <GitMerge size={12} className="colpick-icon--text" />
                        <span className="csm-group-label">{jg.table}</span>
                        <span className="csm-group-count">{names.length}</span>
                      </button>
                      <button
                        className={`colpick-group-check ${allIn ? "colpick-group-check--on" : someIn ? "colpick-group-check--partial" : ""}`}
                        onClick={() => toggleGroupNames(names)}
                        title={allIn ? "Deselect group" : "Select group"}
                      >
                        {allIn && <Check size={9} />}
                        {someIn && !allIn && <span style={{ fontSize: "9px" }}>-</span>}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="csm-group-items">
                        {jg.cols.map((c) => renderColumnItem(c))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Selected columns (reorderable) */}
          <div className="csm-pane">
            <div className="csm-pane-header">
              <span className="csm-pane-title">Selected Columns</span>
              <span className="csm-pane-count csm-pane-count--accent">{selectedOutputColumns.length}</span>
            </div>

            {/* Batch move toolbar */}
            <div className="csm-batch-bar">
              <button
                className={`csm-batch-check-all ${allChecked ? "csm-batch-check-all--on" : ""}`}
                onClick={toggleCheckAll}
                disabled={selectedOutputColumns.length === 0}
              >
                {allChecked ? <Check size={9} /> : null}
              </button>
              <span className="csm-batch-label">
                {checkedCount > 0 ? `${checkedCount} selected` : "Select to reorder"}
              </span>
              <div className="csm-batch-actions">
                <button className="csm-batch-btn" onClick={() => batchMove("top")} disabled={checkedCount === 0} title="Move to top">
                  <ChevronsUp size={13} />
                </button>
                <button className="csm-batch-btn" onClick={() => batchMove("up")} disabled={checkedCount === 0} title="Move up">
                  <ChevronUp size={13} />
                </button>
                <button className="csm-batch-btn" onClick={() => batchMove("down")} disabled={checkedCount === 0} title="Move down">
                  <ChevronDown size={13} />
                </button>
                <button className="csm-batch-btn" onClick={() => batchMove("bottom")} disabled={checkedCount === 0} title="Move to bottom">
                  <ChevronsDown size={13} />
                </button>
              </div>
            </div>

            <div className="csm-pane-search">
              <Search size={12} />
              <input
                className="csm-pane-search-input"
                placeholder="Search selected..."
                value={rightSearch}
                onChange={(e) => setRightSearch(e.target.value)}
              />
              {rightSearch && (
                <button className="csm-search-clear" onClick={() => setRightSearch("")}><X size={11} /></button>
              )}
            </div>

            <div className="csm-pane-list">
              {selectedOutputColumns.length === 0 ? (
                <div className="csm-empty">
                  Select columns from the left panel. They will appear here for reordering.
                </div>
              ) : rightSearch ? (
                <div className="csm-sel-list">
                  {filteredSelected.map((name) => {
                    const isFormula = name.startsWith("__fc__");
                    const meta = colMap.get(name);
                    const isNum = meta ? NUMERIC_RE.test(meta.data_type) : false;
                    return (
                      <div key={name} className={`csm-sel-item${checkedCols.has(name) ? " csm-sel-item--checked" : ""}`}>
                        <button className={`csm-sel-check ${checkedCols.has(name) ? "csm-sel-check--on" : ""}`} onClick={() => toggleCheck(name)}>
                          {checkedCols.has(name) && <Check size={8} />}
                        </button>
                        <span className="csm-sel-grip" style={{ opacity: 0.3 }}><GripVertical size={11} /></span>
                        <span className={`colpick-icon ${isFormula ? "colpick-icon--formula" : isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
                          {isFormula ? <Sigma size={10} /> : isNum ? <Hash size={10} /> : <Type size={10} />}
                        </span>
                        <span className="csm-sel-name">{resolveLabel(name)}</span>
                        <button className="csm-sel-remove" onClick={() => toggleOutputColumn(name)}><X size={10} /></button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={selectedOutputColumns} strategy={verticalListSortingStrategy}>
                    <div className="csm-sel-list">
                      {selectedOutputColumns.map((name) => {
                        const meta = colMap.get(name);
                        const isNum = meta ? NUMERIC_RE.test(meta.data_type) : false;
                        return (
                          <SortableSelectedCol
                            key={name}
                            name={name}
                            displayLabel={resolveLabel(name)}
                            meta={meta}
                            isFormula={name.startsWith("__fc__")}
                            agg={isNum ? (resolvedAggregations()[name] ?? "SUM") : undefined}
                            onAggChange={isNum ? (a) => setColumnAggregation(name, a) : undefined}
                            onRemove={() => toggleOutputColumn(name)}
                            checked={checkedCols.has(name)}
                            onToggleCheck={() => toggleCheck(name)}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="csm-footer">
          <span className="csm-footer-info">
            <strong>{selectedOutputColumns.length}</strong> of {allCols.length} columns selected
          </span>
          <button className="fm-save-btn" onClick={onClose}>
            <Check size={14} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
