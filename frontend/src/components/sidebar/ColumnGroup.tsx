import { useState } from "react";
import { ChevronDown, ChevronRight, Hash, Type } from "lucide-react";
import DraggableColumn from "./DraggableColumn";
import type { ColumnMeta } from "@/types/dashboard";

interface Props {
  title: string;
  icon: "dimension" | "fact";
  columns: ColumnMeta[];
  table: string;
  defaultOpen?: boolean;
}

export default function ColumnGroup({
  title,
  icon,
  columns,
  table,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (columns.length === 0) return null;

  return (
    <div className="col-group">
      <button className="col-group-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon === "dimension" ? (
          <Type size={13} className="col-group-icon dimension" />
        ) : (
          <Hash size={13} className="col-group-icon fact" />
        )}
        <span className="col-group-title">{title}</span>
        <span className="col-group-count">{columns.length}</span>
      </button>

      {open && (
        <div className="col-group-list">
          {columns.map((c) => (
            <DraggableColumn
              key={c.col_name}
              table={table}
              column={c.col_name}
              dataType={c.data_type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
