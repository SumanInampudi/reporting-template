import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useDraggableModal } from "@/hooks/useDraggableModal";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  variant = "default", loading = false, onConfirm, onCancel,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, loading]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !loading) onCancel();
  };

  return (
    <div className="confirm-overlay" ref={overlayRef} onClick={handleOverlay}>
      <div className="confirm-dialog" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="confirm-header drag-handle" onMouseDown={handleMouseDown}>
          {variant === "danger" && <AlertTriangle size={18} className="confirm-icon--danger" />}
          <span className="confirm-title">{title}</span>
        </div>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn--cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`confirm-btn ${variant === "danger" ? "confirm-btn--danger" : "confirm-btn--primary"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <><Loader2 size={14} className="spin" /> Deleting...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
