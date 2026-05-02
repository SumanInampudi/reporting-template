import { forwardRef } from "react";
import type React from "react";
import { X, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FilterVariant = "text" | "date" | "numeric" | "boolean";

interface Props {
  icon: LucideIcon;
  name: string;
  label: string;
  open: boolean;
  variant?: FilterVariant;
  isActive?: boolean;
  secondaryLabel?: string;
  onToggle: () => void;
  onRemove: () => void;
  children?: React.ReactNode;
}

const FilterChipShell = forwardRef<HTMLDivElement, Props>(function FilterChipShell(
  { icon: Icon, name, label, open, variant = "text", isActive, secondaryLabel, onToggle, onRemove, children },
  ref,
) {
  const activeClass = isActive ? " fc-card--active" : "";

  return (
    <div className={`fc-card fc-card--${variant}${activeClass}`} ref={ref}>
      <div className="fc-card-accent" />
      <div className="fc-card-body" onClick={onToggle}>
        <div className="fc-card-top">
          <Icon size={14} className="fc-card-icon" />
          <span className="fc-card-name">{name}</span>
          <button className="fc-card-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove filter">
            <X size={11} />
          </button>
        </div>
        <div className="fc-card-value-row">
          <span className="fc-card-value">{label}</span>
          <ChevronDown size={12} className={open ? "fc-card-chevron rotated" : "fc-card-chevron"} />
        </div>
        {secondaryLabel && (
          <span className="fc-card-secondary">{secondaryLabel}</span>
        )}
      </div>
      {children}
    </div>
  );
});

export default FilterChipShell;
