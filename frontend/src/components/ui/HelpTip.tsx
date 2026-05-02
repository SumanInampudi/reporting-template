import { useState, useRef, useEffect } from "react";
import { HelpCircle, Lightbulb, Play } from "lucide-react";

interface Props {
  title: string;
  description: string;
  tip?: string;
  onTour?: () => void;
}

export default function HelpTip({ title, description, tip, onTour }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="help-tip-wrap" ref={ref}>
      <button
        className="help-tip-btn"
        onClick={() => setOpen(!open)}
        title="Help"
        type="button"
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <div className="help-tip-popover">
          <div className="help-tip-header">
            <Lightbulb size={13} />
            <span className="help-tip-title">{title}</span>
          </div>
          <p className="help-tip-desc">{description}</p>
          {tip && <p className="help-tip-pro"><strong>Tip:</strong> {tip}</p>}
          {onTour && (
            <button
              className="help-tip-tour-btn"
              onClick={() => { setOpen(false); setTimeout(onTour, 150); }}
              type="button"
            >
              <Play size={11} /> Take a guided tour
            </button>
          )}
        </div>
      )}
    </div>
  );
}
