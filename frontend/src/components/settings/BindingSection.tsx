import { useState, useMemo } from "react";
import { X, Plus, Search, ChevronDown } from "lucide-react";
import type { ChartBinding } from "@/types/dashboard";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { isNumericType } from "@/lib/kpiUtils";

interface AvailableColumn {
  name: string;
  dataType: string;
}

interface Props {
  binding: ChartBinding;
  availableColumns: AvailableColumn[];
  onChange: (binding: ChartBinding) => void;
}

type SlotKind = "x" | "y" | "groupBy";

export default function BindingSection({ binding, availableColumns, onChange }: Props) {
  const alias = useColumnAlias();

  const removeCol = (slot: SlotKind, col: string) => {
    if (slot === "x") onChange({ ...binding, xColumns: binding.xColumns.filter((c) => c !== col) });
    else if (slot === "y") onChange({ ...binding, yColumns: binding.yColumns.filter((c) => c !== col) });
    else onChange({ ...binding, groupBy: binding.groupBy.filter((c) => c !== col) });
  };

  const addCol = (slot: SlotKind, col: string) => {
    if (slot === "x") onChange({ ...binding, xColumns: [...binding.xColumns, col] });
    else if (slot === "y") onChange({ ...binding, yColumns: [...binding.yColumns, col] });
    else onChange({ ...binding, groupBy: [...binding.groupBy, col] });
  };

  const allBound = new Set([...binding.xColumns, ...binding.yColumns, ...binding.groupBy]);

  return (
    <div className="stg-section">
      <h4 className="stg-section-title">Data Binding</h4>
      <p className="stg-section-hint">
        Drag columns from the sidebar or use the controls below to configure which columns
        appear on each axis. Multiple dimensions and measures are supported.
      </p>

      <SlotGroup
        label="X Axis (Dimensions)"
        slot="x"
        columns={binding.xColumns}
        availableColumns={availableColumns}
        boundSet={allBound}
        onRemove={(col) => removeCol("x", col)}
        onAdd={(col) => addCol("x", col)}
        filterNumeric={false}
        alias={alias}
      />

      <SlotGroup
        label="Y Axis (Measures)"
        slot="y"
        columns={binding.yColumns}
        availableColumns={availableColumns}
        boundSet={allBound}
        onRemove={(col) => removeCol("y", col)}
        onAdd={(col) => addCol("y", col)}
        filterNumeric={true}
        alias={alias}
      />

      <SlotGroup
        label="Color / Group By"
        slot="groupBy"
        columns={binding.groupBy}
        availableColumns={availableColumns}
        boundSet={allBound}
        onRemove={(col) => removeCol("groupBy", col)}
        onAdd={(col) => addCol("groupBy", col)}
        filterNumeric={false}
        alias={alias}
      />
    </div>
  );
}

/* ── Slot group ──────────────────────────────── */

interface SlotGroupProps {
  label: string;
  slot: SlotKind;
  columns: string[];
  availableColumns: AvailableColumn[];
  boundSet: Set<string>;
  onRemove: (col: string) => void;
  onAdd: (col: string) => void;
  filterNumeric: boolean;
  alias: (col: string) => string;
}

function SlotGroup({
  label, columns, availableColumns, boundSet,
  onRemove, onAdd, filterNumeric, alias,
}: SlotGroupProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    return availableColumns.filter((c) => {
      if (boundSet.has(c.name)) return false;
      if (filterNumeric && !isNumericType(c.dataType)) return false;
      if (!filterNumeric && isNumericType(c.dataType)) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [availableColumns, boundSet, filterNumeric, search]);

  return (
    <div className="bind-slot">
      <div className="bind-slot-header">
        <span className="bind-slot-label">{label}</span>
        <button
          className="bind-slot-add"
          onClick={() => { setShowPicker((v) => !v); setSearch(""); }}
          title="Add column"
        >
          {showPicker ? <ChevronDown size={12} /> : <Plus size={12} />}
          Add
        </button>
      </div>

      {columns.length > 0 ? (
        <div className="bind-tags">
          {columns.map((col) => (
            <span key={col} className="bind-tag">
              {alias(col)}
              <button className="bind-tag-x" onClick={() => onRemove(col)} title="Remove">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="bind-slot-empty">No columns assigned</p>
      )}

      {showPicker && (
        <div className="bind-picker">
          <div className="bind-picker-search">
            <Search size={12} />
            <input
              autoFocus
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bind-picker-list">
            {candidates.length === 0 ? (
              <p className="bind-picker-empty">No available columns</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.name}
                  className="bind-picker-item"
                  onClick={() => { onAdd(c.name); setShowPicker(false); }}
                >
                  {alias(c.name)}
                  <span className="bind-picker-type">{c.dataType}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
