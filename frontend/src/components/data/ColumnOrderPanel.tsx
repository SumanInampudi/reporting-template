import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Hash, Type, Sigma } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { NUMERIC_RE } from "@/lib/constants";
import type { ColumnMeta } from "@/types/dashboard";

function SortableColumn({ name, displayLabel, meta, isFormula, onRemove }: {
  name: string;
  displayLabel: string;
  meta: ColumnMeta | undefined;
  isFormula: boolean;
  onRemove: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isNum = meta ? NUMERIC_RE.test(meta.data_type) : false;

  return (
    <div ref={setNodeRef} style={style} className="col-order-item" {...attributes}>
      <span className="col-order-grip" {...listeners}><GripVertical size={12} /></span>
      <span className={`colpick-icon ${isFormula ? "colpick-icon--formula" : isNum ? "colpick-icon--num" : "colpick-icon--text"}`}>
        {isFormula ? <Sigma size={10} /> : isNum ? <Hash size={10} /> : <Type size={10} />}
      </span>
      <span className="col-order-name" title={name}>{displayLabel}</span>
      {meta && <span className="colpick-dtype">{meta.data_type}</span>}
      {isFormula && <span className="colpick-dtype">formula</span>}
      <button className="col-order-remove" onClick={onRemove} title="Remove"><X size={10} /></button>
    </div>
  );
}

export default function ColumnOrderPanel({ embedded = false }: { embedded?: boolean }) {
  const {
    selectedOutputColumns, reorderOutputColumns, toggleOutputColumn,
    columns, selectedCatalog, selectedSchema, selectedTable,
  } = useStore();
  const alias = useColumnAlias();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const colKey = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;
  const colMap = new Map<string, ColumnMeta>();
  if (colKey) {
    for (const c of columns[colKey] ?? []) colMap.set(c.col_name, c);
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = selectedOutputColumns.indexOf(active.id as string);
    const to = selectedOutputColumns.indexOf(over.id as string);
    if (from >= 0 && to >= 0) reorderOutputColumns(from, to);
  }, [selectedOutputColumns, reorderOutputColumns]);

  if (selectedOutputColumns.length === 0) return null;

  const resolveLabel = (name: string) =>
    name.startsWith("__fc__") ? name.replace(/^__fc__.*?__/, "") : alias(name);

  const list = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={selectedOutputColumns} strategy={verticalListSortingStrategy}>
        <div className="col-order-list">
          {selectedOutputColumns.map((name) => (
            <SortableColumn
              key={name}
              name={name}
              displayLabel={resolveLabel(name)}
              meta={colMap.get(name)}
              isFormula={name.startsWith("__fc__")}
              onRemove={() => toggleOutputColumn(name)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );

  if (embedded) return list;

  return (
    <div className="col-order-panel">
      <div className="col-order-header">
        <span className="col-order-title">Column Order</span>
        <span className="colpick-count">{selectedOutputColumns.length}</span>
      </div>
      {list}
    </div>
  );
}
