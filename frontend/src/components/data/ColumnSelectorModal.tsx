import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Check, Search, Hash, Type, Sigma,
  ChevronDown, ChevronRight, GripVertical,
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
import { resolveColumnGroups, type ResolvedGroup } from "@/lib/columnGroupResolver";
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

function SortableSelectedCol({ name, displayLabel, meta, isFormula, agg, onAggChange, onRemove }: {
  name: string; displayLabel: string; meta: ColumnMeta | undefined; isFormula: boolean;
  agg?: ColumnAggregation; onAggChange?: (agg: ColumnAggregation) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: name });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isNum = meta ? NUMERIC_RE.test(meta.data_type) : false;

  return (
    <div ref={setNodeRef} style={style} className="csm-sel-item" {...attributes}>
      <span className="csm-sel-grip" {...listeners}><GripVertical size={11} /></span>
      <span className={`colpick-icon ${isFormula ? "colpick-icon--formula" : isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
        {isFormula ? <Sigma size={10} /> : isNum ? <Hash size={10} /> : <Type size={10} />}
      </span>
      <span className="csm-sel-name">{displayLabel}</span>
      {isNum && !isFormula && onAggChange && (
        <select
          className="csm-agg-select"
          value={agg ?? "NONE"}
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
    activeWorkspace, setColumnAggregation,
  } = useStore();
  const alias = useColumnAlias();

  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const overlayRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const colKey = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;
  const allCols: ColumnMeta[] = useMemo(
    () => (colKey ? columns[colKey] ?? [] : []),
    [colKey, columns],
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
  const rawGroups = useMemo(
    () => resolveColumnGroups(allCols, activeWorkspace?.column_groups),
    [allCols, activeWorkspace?.column_groups],
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

  const filteredGroups: ResolvedGroup[] = useMemo(
    () => rawGroups.map((g) => ({ ...g, columns: filterBySearch(g.columns) })).filter((g) => g.columns.length > 0),
    [rawGroups, filterBySearch],
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
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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
    const isCollapsed = collapsed.has(group.key);
    const allIn = names.length > 0 && names.every((n) => selSet.has(n));
    const someIn = !allIn && names.some((n) => selSet.has(n));
    const isBuiltInNum = group.key === "measures";
    const Icon = isBuiltInNum ? Hash : Type;
    const iconClass = isBuiltInNum ? "colpick-icon--num" : "colpick-icon--text";
    return (
      <div key={group.key} className="csm-group">
        <div className="csm-group-header">
          <button className="csm-group-toggle" onClick={() => toggleSection(group.key)}>
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
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
        {!isCollapsed && (
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
              {filteredGroups.map((g) => renderGroup(g))}
            </div>
          </div>

          {/* RIGHT: Selected columns (reorderable) */}
          <div className="csm-pane">
            <div className="csm-pane-header">
              <span className="csm-pane-title">Selected Columns</span>
              <span className="csm-pane-count csm-pane-count--accent">{selectedOutputColumns.length}</span>
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
                      <div key={name} className="csm-sel-item">
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
                            agg={isNum ? activeWorkspace?.column_aggregations?.[name] : undefined}
                            onAggChange={isNum ? (a) => setColumnAggregation(name, a) : undefined}
                            onRemove={() => toggleOutputColumn(name)}
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
