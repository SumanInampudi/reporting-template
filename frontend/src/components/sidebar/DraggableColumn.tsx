import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Network } from "lucide-react";
import { isNumeric } from "@/lib/columnUtils";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { useStore } from "@/hooks/useStore";
import { findHierarchyByColumn } from "@/lib/hierarchyUtils";

interface Props {
  table: string;
  column: string;
  dataType: string;
}

export default function DraggableColumn({ table, column, dataType }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `column-${table}-${column}`,
    data: { type: "column", payload: column, table, dataType },
  });

  const alias = useColumnAlias();
  const numeric = isNumeric(dataType);
  const hierarchies = useStore((s) => s.hierarchies);
  const hierInfo = useMemo(() => {
    const h = findHierarchyByColumn(hierarchies, column);
    if (!h) return null;
    return h.name;
  }, [hierarchies, column]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`sidebar-column ${isDragging ? "dragging" : ""}${hierInfo ? " sidebar-column--hier" : ""}`}
      title={hierInfo ? `${column} — part of "${hierInfo}" hierarchy (drillable)` : column}
    >
      <span className={`col-type-badge ${numeric ? "numeric" : "text"}`}>
        {numeric ? "#" : "A"}
      </span>
      <span className="col-name">{alias(column)}</span>
      {hierInfo && <span title={`Hierarchy: ${hierInfo}`}><Network size={10} className="sidebar-hier-icon" /></span>}
      <span className="col-dtype">{dataType}</span>
    </div>
  );
}
