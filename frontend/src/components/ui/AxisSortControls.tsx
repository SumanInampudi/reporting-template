import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { SortOrder } from "@/types/dashboard";

interface Props {
  value: SortOrder;
  onChange: (v: SortOrder) => void;
  xLabel?: string;
  yLabel?: string;
}

function cycleSort(current: SortOrder, axis: "x" | "y"): SortOrder {
  if (axis === "x") {
    if (current === "x-asc") return "x-desc";
    if (current === "x-desc") return "none";
    return "x-asc";
  }
  if (current === "y-asc") return "y-desc";
  if (current === "y-desc") return "none";
  return "y-asc";
}

function SortIcon({ direction }: { direction: "asc" | "desc" | "none" }) {
  if (direction === "asc") return <ArrowUp size={10} />;
  if (direction === "desc") return <ArrowDown size={10} />;
  return <Minus size={10} />;
}

export default function AxisSortControls({ value, onChange, xLabel, yLabel }: Props) {
  const xDir = value === "x-asc" ? "asc" : value === "x-desc" ? "desc" : "none";
  const yDir = value === "y-asc" ? "asc" : value === "y-desc" ? "desc" : "none";

  return (
    <>
      <button
        className={`axis-sort axis-sort--x ${xDir !== "none" ? "axis-sort--active" : ""}`}
        onClick={() => onChange(cycleSort(value, "x"))}
        title={`Sort X-axis (${xLabel ?? "category"}): ${xDir}`}
      >
        <span className="axis-sort-label">X</span>
        <SortIcon direction={xDir} />
      </button>
      <button
        className={`axis-sort axis-sort--y ${yDir !== "none" ? "axis-sort--active" : ""}`}
        onClick={() => onChange(cycleSort(value, "y"))}
        title={`Sort Y-axis (${yLabel ?? "value"}): ${yDir}`}
      >
        <span className="axis-sort-label">Y</span>
        <SortIcon direction={yDir} />
      </button>
    </>
  );
}
