import { useMemo } from "react";
import { X } from "lucide-react";
import { operatorsForType } from "@/lib/dynamicFilterValidation";
import type { ColumnMeta, FilterCondition, FilterOperator, FilterValueType } from "@/types/dashboard";

interface Props {
  condition: FilterCondition;
  columns: ColumnMeta[];
  onChange: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const UNARY_OPS = new Set<string>(["IS NULL", "IS NOT NULL"]);

export default function ConditionRow({ condition, columns, onChange, onRemove, canRemove }: Props) {
  const selectedMeta = useMemo(
    () => columns.find((c) => c.col_name === condition.column),
    [columns, condition.column],
  );
  const operators = useMemo(
    () => (selectedMeta ? operatorsForType(selectedMeta.data_type) : operatorsForType("STRING")),
    [selectedMeta],
  );

  const isUnary = UNARY_OPS.has(condition.operator);
  const isBetween = condition.operator === "BETWEEN";

  const handleColumnChange = (col: string) => {
    const meta = columns.find((c) => c.col_name === col);
    const ops = meta ? operatorsForType(meta.data_type) : operatorsForType("STRING");
    const newOp = ops.includes(condition.operator) ? condition.operator : ops[0];
    onChange({ column: col, operator: newOp });
  };

  const condPreview = useMemo(() => {
    if (!condition.column) return null;
    const lhs = condition.column;
    if (UNARY_OPS.has(condition.operator)) return `${lhs} ${condition.operator}`;
    if (!condition.value) return `${lhs} ${condition.operator} ?`;
    const rhs = condition.valueType === "column" ? condition.value : `'${condition.value}'`;
    if (condition.operator === "BETWEEN") {
      const rhs2 = condition.value2
        ? (condition.valueType === "column" ? condition.value2 : `'${condition.value2}'`)
        : "?";
      return `${lhs} BETWEEN ${rhs} AND ${rhs2}`;
    }
    return `${lhs} ${condition.operator} ${rhs}`;
  }, [condition]);

  return (
    <div className="df-cond-wrap">
      <div className="df-cond-row">
        {/* Column select */}
        <select
          className="df-cond-select df-cond-select--col"
          value={condition.column}
          onChange={(e) => handleColumnChange(e.target.value)}
        >
          <option value="">— Column —</option>
          {columns.map((c) => (
            <option key={c.col_name} value={c.col_name}>
              {c.col_name}
            </option>
          ))}
        </select>

        {/* Operator select */}
        <select
          className="df-cond-select df-cond-select--op"
          value={condition.operator}
          onChange={(e) => onChange({ operator: e.target.value as FilterOperator })}
        >
          {operators.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>

        {/* Value type toggle + value input */}
        {!isUnary && (
          <>
            <div className="df-vtype-toggle">
              <button
                className={`df-vtype-opt ${condition.valueType === "literal" ? "df-vtype-opt--active" : ""}`}
                onClick={() => { if (condition.valueType !== "literal") onChange({ valueType: "literal" as FilterValueType, value: "", value2: "" }); }}
              >
                Value
              </button>
              <button
                className={`df-vtype-opt ${condition.valueType === "column" ? "df-vtype-opt--active" : ""}`}
                onClick={() => { if (condition.valueType !== "column") onChange({ valueType: "column" as FilterValueType, value: "", value2: "" }); }}
              >
                Column
              </button>
            </div>

            {condition.valueType === "column" ? (
              <select
                className="df-cond-select df-cond-select--val"
                value={condition.value}
                onChange={(e) => onChange({ value: e.target.value })}
              >
                <option value="">— Compare to Column —</option>
                {columns
                  .filter((c) => c.col_name !== condition.column)
                  .map((c) => (
                    <option key={c.col_name} value={c.col_name}>{c.col_name}</option>
                  ))}
              </select>
            ) : condition.operator === "IN" || condition.operator === "NOT IN" ? (
              <input
                className="df-cond-input df-cond-input--val"
                value={condition.value}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="val1, val2, ..."
              />
            ) : (
              <input
                className="df-cond-input df-cond-input--val"
                value={condition.value}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="Value"
              />
            )}

            {isBetween && (
              <>
                <span className="df-cond-and">AND</span>
                {condition.valueType === "column" ? (
                  <select
                    className="df-cond-select df-cond-select--val"
                    value={condition.value2}
                    onChange={(e) => onChange({ value2: e.target.value })}
                  >
                    <option value="">— Column —</option>
                    {columns
                      .filter((c) => c.col_name !== condition.column)
                      .map((c) => (
                        <option key={c.col_name} value={c.col_name}>{c.col_name}</option>
                      ))}
                  </select>
                ) : (
                  <input
                    className="df-cond-input df-cond-input--val"
                    value={condition.value2}
                    onChange={(e) => onChange({ value2: e.target.value })}
                    placeholder="Upper bound"
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Remove button */}
        <button
          className="df-cond-remove"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove condition"
        >
          <X size={13} />
        </button>
      </div>

      {/* Inline condition preview */}
      {condPreview && (
        <div className="df-cond-preview">{condPreview}</div>
      )}
    </div>
  );
}
