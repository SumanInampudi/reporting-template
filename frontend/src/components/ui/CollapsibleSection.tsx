import { useState, useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  /** Increment to force-collapse. Each new value triggers a collapse. */
  collapseKey?: number;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  icon,
  badge,
  actions,
  defaultOpen = true,
  collapseKey = 0,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const prevKey = useRef(collapseKey);

  useEffect(() => {
    if (collapseKey !== prevKey.current) {
      prevKey.current = collapseKey;
      setOpen(false);
    }
  }, [collapseKey]);

  return (
    <div className={`csec${open ? " csec--open" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="csec-header"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown size={13} className="csec-chevron" />
        {icon && <span className="csec-icon">{icon}</span>}
        <span className="csec-title">{title}</span>
        {badge}
        {actions && (
          <span className="csec-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </span>
        )}
      </button>
      {open && <div className="csec-body">{children}</div>}
    </div>
  );
}
