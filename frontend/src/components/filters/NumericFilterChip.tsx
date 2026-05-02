import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Hash } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { usePopover } from "./usePopover";
import FilterChipShell from "./FilterChipShell";
import type { FilterItem, NumericOp } from "@/types/dashboard";

interface Props {
  filter: FilterItem;
}

const OPS: { id: NumericOp; label: string; symbol: string }[] = [
  { id: ">",  label: "Greater than", symbol: ">" },
  { id: ">=", label: "Greater or equal", symbol: ">=" },
  { id: "<",  label: "Less than", symbol: "<" },
  { id: "<=", label: "Less or equal", symbol: "<=" },
  { id: "=",  label: "Equals", symbol: "=" },
  { id: "!=", label: "Not equal", symbol: "≠" },
  { id: "between", label: "Between", symbol: "↔" },
];

function formatDisplay(op: NumericOp | undefined, v1: number | undefined, v2: number | undefined): string {
  if (v1 === undefined) return "Any";
  if (op === "between") {
    return v2 !== undefined ? `${v1} – ${v2}` : `>= ${v1}`;
  }
  const sym = OPS.find((o) => o.id === op)?.symbol ?? op ?? ">";
  return `${sym} ${v1}`;
}

export default function NumericFilterChip({ filter }: Props) {
  const { removeFilter, setFilterNumeric, updateFilterType } = useStore();
  const alias = useColumnAlias();
  const columnLabel = alias(filter.column);
  const { open, setOpen, chipRef, popoverRef, getPosition, portalTarget } = usePopover(300, 280);

  const [localOp, setLocalOp] = useState<NumericOp>(filter.numericOp ?? ">");
  const [localVal, setLocalVal] = useState(filter.numericValue?.toString() ?? "");
  const [localVal2, setLocalVal2] = useState(filter.numericValue2?.toString() ?? "");

  useEffect(() => {
    if (open) {
      setLocalOp(filter.numericOp ?? ">");
      setLocalVal(filter.numericValue?.toString() ?? "");
      setLocalVal2(filter.numericValue2?.toString() ?? "");
    }
  }, [open, filter.numericOp, filter.numericValue, filter.numericValue2]);

  const handleApply = () => {
    const v1 = localVal !== "" ? Number(localVal) : undefined;
    const v2 = localOp === "between" && localVal2 !== "" ? Number(localVal2) : undefined;
    setFilterNumeric(filter.id, localOp, v1, v2);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalVal("");
    setLocalVal2("");
    setFilterNumeric(filter.id, localOp, undefined, undefined);
  };

  const isActive = filter.numericValue !== undefined;
  const displayLabel = formatDisplay(filter.numericOp, filter.numericValue, filter.numericValue2);

  return (
    <FilterChipShell
      ref={chipRef}
      icon={Hash}
      name={columnLabel}
      label={displayLabel}
      open={open}
      variant="numeric"
      isActive={isActive}
      onToggle={() => setOpen((v) => !v)}
      onRemove={() => removeFilter(filter.id)}
    >
      {open && createPortal(
        <div className="flt-popover-portal" style={getPosition()} ref={popoverRef}>
          <div className="flt-popover flt-popover--numeric">
            <div className="flt-popover-header">
              <span className="flt-popover-title">
                <Hash size={14} /> {columnLabel}
              </span>
              <button
                className="flt-switch-type-btn"
                onClick={() => updateFilterType(filter.id, "value_list")}
              >
                Value List
              </button>
            </div>

            <div className="num-flt-body">
              <label className="num-flt-label">Operator</label>
              <div className="num-flt-ops">
                {OPS.map((op) => (
                  <button
                    key={op.id}
                    className={`num-flt-op${localOp === op.id ? " num-flt-op--active" : ""}`}
                    onClick={() => setLocalOp(op.id)}
                    title={op.label}
                  >
                    {op.symbol}
                  </button>
                ))}
              </div>

              <label className="num-flt-label">
                {localOp === "between" ? "Min value" : "Value"}
              </label>
              <input
                type="number"
                className="num-flt-input"
                value={localVal}
                placeholder="Enter number..."
                onChange={(e) => setLocalVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
              />

              {localOp === "between" && (
                <>
                  <label className="num-flt-label">Max value</label>
                  <input
                    type="number"
                    className="num-flt-input"
                    value={localVal2}
                    placeholder="Enter number..."
                    onChange={(e) => setLocalVal2(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApply()}
                  />
                </>
              )}
            </div>

            <div className="flt-popover-footer">
              <span className="flt-popover-count">
                {isActive
                  ? <strong>{displayLabel}</strong>
                  : "No constraint set"}
              </span>
              <div className="flt-popover-actions">
                <button className="flt-popover-btn" onClick={handleClear}>Clear</button>
                <button
                  className="flt-popover-btn flt-popover-btn--done"
                  disabled={localVal === ""}
                  onClick={handleApply}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </FilterChipShell>
  );
}
