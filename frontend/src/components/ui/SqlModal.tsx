import { useEffect, useMemo, useRef, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { formatAndHighlight } from "@/lib/sqlHighlight";
import { useDraggableModal } from "@/hooks/useDraggableModal";

interface Props {
  sql: string;
  onClose: () => void;
}

export default function SqlModal({ sql, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const highlighted = useMemo(() => formatAndHighlight(sql), [sql]);
  const { offset, handleMouseDown } = useDraggableModal();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = sql;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="sql-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="sql-modal" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="sql-modal-header drag-handle" onMouseDown={handleMouseDown}>
          <span className="sql-modal-title">Generated SQL</span>
          <div className="sql-modal-actions">
            <button className="sql-modal-btn" onClick={handleCopy}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
            <button className="sql-modal-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <pre className="sql-modal-code" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  );
}
