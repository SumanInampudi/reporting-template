import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { usePopover } from "./usePopover";
import FilterChipShell from "./FilterChipShell";
import type { DatePreset, FilterItem, FilterType } from "@/types/dashboard";

interface Props {
  filter: FilterItem;
}

interface PresetOption {
  id: DatePreset;
  label: string;
  from: () => string;
  to: () => string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

const PRESETS: PresetOption[] = [
  { id: "today", label: "Today", from: () => isoDate(new Date()), to: () => isoDate(new Date()) },
  { id: "yesterday", label: "Yesterday", from: () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); }, to: () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); } },
  { id: "last_7_days", label: "Last 7 Days", from: () => { const d = new Date(); d.setDate(d.getDate() - 7); return isoDate(d); }, to: () => isoDate(new Date()) },
  { id: "last_30_days", label: "Last 30 Days", from: () => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); }, to: () => isoDate(new Date()) },
  { id: "last_90_days", label: "Last 90 Days", from: () => { const d = new Date(); d.setDate(d.getDate() - 90); return isoDate(d); }, to: () => isoDate(new Date()) },
  { id: "this_week", label: "This Week", from: () => isoDate(startOfWeek(new Date())), to: () => isoDate(new Date()) },
  { id: "this_month", label: "This Month", from: () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); }, to: () => isoDate(new Date()) },
  { id: "this_quarter", label: "This Quarter", from: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3) * 3; return isoDate(new Date(d.getFullYear(), q, 1)); }, to: () => isoDate(new Date()) },
  { id: "this_year", label: "This Year", from: () => isoDate(new Date(new Date().getFullYear(), 0, 1)), to: () => isoDate(new Date()) },
];

const FILTER_TYPE_OPTIONS: { id: FilterType; label: string }[] = [
  { id: "date_range", label: "Date Range" },
  { id: "date_relative", label: "Presets" },
  { id: "value_list", label: "Value List" },
];

export default function DateFilterChip({ filter }: Props) {
  const { removeFilter, setFilterDateRange, updateFilterType } = useStore();
  const alias = useColumnAlias();
  const columnLabel = alias(filter.column);
  const { open, setOpen, chipRef, popoverRef, getPosition, portalTarget } = usePopover(340, 420);
  const [localFrom, setLocalFrom] = useState(filter.dateFrom ?? "");
  const [localTo, setLocalTo] = useState(filter.dateTo ?? "");

  useEffect(() => {
    if (open) {
      setLocalFrom(filter.dateFrom ?? "");
      setLocalTo(filter.dateTo ?? "");
    }
  }, [open, filter.dateFrom, filter.dateTo]);

  const handlePresetClick = (preset: PresetOption) => {
    const from = preset.from();
    const to = preset.to();
    setLocalFrom(from);
    setLocalTo(to);
    setFilterDateRange(filter.id, from, to, preset.id);
  };

  const handleApplyCustom = () => {
    if (localFrom && localTo) {
      setFilterDateRange(filter.id, localFrom, localTo, "custom");
    }
  };

  const handleClear = () => {
    setLocalFrom("");
    setLocalTo("");
    setFilterDateRange(filter.id, "", "", "custom");
  };

  const displayLabel = (() => {
    if (!filter.dateFrom && !filter.dateTo) return "All dates";
    if (filter.datePreset && filter.datePreset !== "custom") {
      return PRESETS.find((p) => p.id === filter.datePreset)?.label ?? "Custom";
    }
    if (filter.dateFrom && filter.dateTo) {
      return `${filter.dateFrom} → ${filter.dateTo}`;
    }
    return filter.dateFrom ? `From ${filter.dateFrom}` : `To ${filter.dateTo}`;
  })();

  const isDateRange = filter.filterType === "date_range";

  const hasRange = !!(filter.dateFrom && filter.dateTo);
  const secondaryLabel = hasRange && filter.datePreset && filter.datePreset !== "custom"
    ? `${filter.dateFrom} → ${filter.dateTo}`
    : undefined;

  return (
    <FilterChipShell
      ref={chipRef}
      icon={Calendar}
      name={columnLabel}
      label={displayLabel}
      open={open}
      variant="date"
      isActive={hasRange}
      secondaryLabel={secondaryLabel}
      onToggle={() => setOpen((v) => !v)}
      onRemove={() => removeFilter(filter.id)}
    >
      {open && createPortal(
        <div className="flt-popover-portal" style={getPosition()} ref={popoverRef}>
          <div className="flt-popover flt-popover--date">
            {/* Header with type switcher */}
            <div className="flt-popover-header">
              <span className="flt-popover-title">
                <Calendar size={14} /> {columnLabel}
              </span>
              <div className="flt-popover-mode">
                {FILTER_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`flt-popover-mode-btn${filter.filterType === opt.id ? " flt-popover-mode-btn--active" : ""}`}
                    onClick={() => updateFilterType(filter.id, opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {isDateRange && (
              <div className="date-flt-range">
                <div className="date-flt-field">
                  <label className="date-flt-label">From</label>
                  <input
                    type="date"
                    className="date-flt-input"
                    value={localFrom}
                    onChange={(e) => setLocalFrom(e.target.value)}
                  />
                </div>
                <div className="date-flt-field">
                  <label className="date-flt-label">To</label>
                  <input
                    type="date"
                    className="date-flt-input"
                    value={localTo}
                    max={isoDate(new Date())}
                    onChange={(e) => setLocalTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="date-flt-presets">
              <span className="date-flt-presets-label">Quick Presets</span>
              <div className="date-flt-presets-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`date-flt-preset${filter.datePreset === p.id ? " date-flt-preset--active" : ""}`}
                    onClick={() => handlePresetClick(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flt-popover-footer">
              <span className="flt-popover-count">
                {filter.dateFrom && filter.dateTo
                  ? <><strong>{filter.dateFrom}</strong> → <strong>{filter.dateTo}</strong></>
                  : "No date range set"
                }
              </span>
              <div className="flt-popover-actions">
                <button className="flt-popover-btn" onClick={handleClear}>Clear</button>
                {isDateRange && (
                  <button
                    className="flt-popover-btn flt-popover-btn--done"
                    disabled={!localFrom || !localTo}
                    onClick={handleApplyCustom}
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </FilterChipShell>
  );
}
