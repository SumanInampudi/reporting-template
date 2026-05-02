import { forwardRef, useEffect, useRef, useState } from "react";
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
  const [pop, setPop] = useState(false);
  const prevLabel = useRef(label);

  useEffect(() => {
    if (label !== prevLabel.current && isActive) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 280);
      prevLabel.current = label;
      return () => clearTimeout(t);
    }
    prevLabel.current = label;
  }, [label, isActive]);

  return (
    <div className={`fc-card fc-card--${variant}${activeClass}${pop ? " fc-card--just-applied" : ""}`} ref={ref}>
      <div className="fc-card-accent" />
      <div className="fc-card-body" onClick={onToggle}>
        <div className="fc-card-top">
          <Icon size={14} className="fc-card-icon" />
          <span className="fc-card-name">{name}</span>
          {secondaryLabel && (
            <span className="fc-card-secondary">{secondaryLabel}</span>
          )}
          <button className="fc-card-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove filter">
            <X size={11} />
          </button>
        </div>
        <div className="fc-card-value-row">
          <span className="fc-card-value">{label}</span>
          <ChevronDown size={12} className={open ? "fc-card-chevron rotated" : "fc-card-chevron"} />
        </div>
      </div>
      {children}
    </div>
  );
});

export default FilterChipShell;
