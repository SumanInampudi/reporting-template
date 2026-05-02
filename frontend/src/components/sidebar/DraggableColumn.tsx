import { useDraggable } from "@dnd-kit/core";
import { isNumeric } from "@/lib/columnUtils";
import { useColumnAlias } from "@/hooks/useColumnAlias";

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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`sidebar-column ${isDragging ? "dragging" : ""}`}
      title={column}
    >
      <span className={`col-type-badge ${numeric ? "numeric" : "text"}`}>
        {numeric ? "#" : "A"}
      </span>
      <span className="col-name">{alias(column)}</span>
      <span className="col-dtype">{dataType}</span>
    </div>
  );
}
