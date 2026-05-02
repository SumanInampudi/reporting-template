import { Plus, Trash2 } from "lucide-react";
import ConditionRow from "./ConditionRow";
import type { ColumnMeta, FilterCondition, FilterGroup, LogicalJoin } from "@/types/dashboard";

interface Props {
  group: FilterGroup;
  groupIdx: number;
  columns: ColumnMeta[];
  onUpdate: (patch: Partial<FilterGroup>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function makeCondition(): FilterCondition {
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    column: "",
    operator: "=",
    valueType: "literal",
    value: "",
    value2: "",
  };
}

export { makeCondition };

export default function FilterGroupCard({
  group, groupIdx, columns, onUpdate, onRemove, canRemove,
}: Props) {
  const updateCondition = (idx: number, patch: Partial<FilterCondition>) => {
    const next = group.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onUpdate({ conditions: next });
  };

  const removeCondition = (idx: number) => {
    onUpdate({ conditions: group.conditions.filter((_, i) => i !== idx) });
  };

  const addCondition = () => {
    onUpdate({ conditions: [...group.conditions, makeCondition()] });
  };

  const toggleJoin = () => {
    const next: LogicalJoin = group.join === "AND" ? "OR" : "AND";
    onUpdate({ join: next });
  };

  return (
    <div className="df-group">
      <div className="df-group-header">
        <span className="df-group-label">Group {groupIdx + 1}</span>
        <button className="df-join-toggle" onClick={toggleJoin}>
          {group.join}
        </button>
        <span className="df-group-spacer" />
        <button
          className="df-group-remove"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove group"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="df-group-body">
        {group.conditions.map((cond, i) => (
          <div key={cond.id}>
            {i > 0 && (
              <div className="df-cond-join-label">{group.join}</div>
            )}
            <ConditionRow
              condition={cond}
              columns={columns}
              onChange={(patch) => updateCondition(i, patch)}
              onRemove={() => removeCondition(i)}
              canRemove={group.conditions.length > 1}
            />
          </div>
        ))}

        <button className="df-add-cond-btn" onClick={addCondition}>
          <Plus size={12} /> Add Condition
        </button>
      </div>
    </div>
  );
}
