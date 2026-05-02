import { useDroppable } from "@dnd-kit/core";
import { Filter, Play } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import FilterChip from "./FilterChip";
import DateFilterChip from "./DateFilterChip";
import NumericFilterChip from "./NumericFilterChip";

export default function FilterBar() {
  const { filters, applyFilters, appliedFilters } = useStore();

  const { setNodeRef, isOver } = useDroppable({
    id: "filter-bar-drop",
    data: { type: "filter-bar" },
  });

  const hasUnapplied = (() => {
    if (filters.length !== appliedFilters.length) return true;
    return filters.some((f) => {
      const af = appliedFilters.find((a) => a.id === f.id);
      if (!af) return true;
      if (f.dateFrom !== af.dateFrom || f.dateTo !== af.dateTo) return true;
      if (f.filterType !== af.filterType) return true;
      if (f.numericOp !== af.numericOp || f.numericValue !== af.numericValue || f.numericValue2 !== af.numericValue2) return true;
      return (
        f.selectedValues.length !== af.selectedValues.length ||
        f.selectedValues.some((v, i) => v !== af.selectedValues[i])
      );
    });
  })();

  const activeCount = filters.filter((f) =>
    f.selectedValues.length > 0 || (f.dateFrom && f.dateTo) || f.numericValue !== undefined,
  ).length;

  return (
    <div
      ref={setNodeRef}
      className={`filter-bar${isOver ? " filter-bar--drop-hover" : ""}`}
    >
      <div className="filter-bar-label">
        <Filter size={14} />
        <span>Filters</span>
        {activeCount > 0 && <span className="filter-bar-badge">{activeCount}</span>}
      </div>

      <div className="filter-bar-chips">
        {filters.length === 0 && (
          <span className="filter-bar-hint">
            Drag columns here to add filters
          </span>
        )}
        {filters.map((f) =>
          f.filterType === "date_range" || f.filterType === "date_relative"
            ? <DateFilterChip key={f.id} filter={f} />
            : f.filterType === "numeric_range"
              ? <NumericFilterChip key={f.id} filter={f} />
              : <FilterChip key={f.id} filter={f} />
        )}
      </div>

      <button
        className={`filter-apply-btn${hasUnapplied ? " filter-apply-btn--pending" : ""}`}
        onClick={applyFilters}
        title="Apply filters to all charts"
      >
        <Play size={13} />
        <span>Apply</span>
      </button>
    </div>
  );
}
