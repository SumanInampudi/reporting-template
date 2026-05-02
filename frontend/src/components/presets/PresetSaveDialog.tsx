import { useEffect, useRef, useState } from "react";
import { Save, X, Globe, Lock, Loader2 } from "lucide-react";
import { useDraggableModal } from "@/hooks/useDraggableModal";

interface Props {
  initialName?: string;
  initialDescription?: string;
  initialPublic?: boolean;
  title?: string;
  confirmLabel?: string;
  saving?: boolean;
  onSave: (name: string, description: string, isPublic: boolean) => void;
  onCancel: () => void;
}

export default function PresetSaveDialog({
  initialName = "", initialDescription = "", initialPublic = false,
  title = "Save Preset", confirmLabel = "Save", saving = false,
  onSave, onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, saving]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !saving) onCancel();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    onSave(name.trim(), description.trim(), isPublic);
  };

  return (
    <div className="confirm-overlay" ref={overlayRef} onClick={handleOverlay}>
      <form className="preset-save-dialog" onSubmit={handleSubmit} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="preset-save-header drag-handle" onMouseDown={handleMouseDown}>
          <Save size={16} />
          <span>{title}</span>
          <button type="button" className="preset-save-close" onClick={onCancel} disabled={saving}><X size={16} /></button>
        </div>

        <div className="preset-save-body">
          <label className="preset-save-label">
            Name <span className="preset-save-req">*</span>
          </label>
          <input
            ref={inputRef}
            className="preset-save-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q1 Sales Overview"
            maxLength={80}
            disabled={saving}
          />

          <label className="preset-save-label">Description</label>
          <textarea
            className="preset-save-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about this preset..."
            rows={2}
            maxLength={250}
            disabled={saving}
          />

          <div className="preset-save-visibility">
            <button
              type="button"
              className={`preset-vis-btn${!isPublic ? " preset-vis-btn--active" : ""}`}
              onClick={() => setIsPublic(false)}
              disabled={saving}
            >
              <Lock size={13} /> Private
            </button>
            <button
              type="button"
              className={`preset-vis-btn${isPublic ? " preset-vis-btn--active" : ""}`}
              onClick={() => setIsPublic(true)}
              disabled={saving}
            >
              <Globe size={13} /> Public
            </button>
          </div>
          {isPublic && (
            <p className="preset-save-hint">Public presets are visible to all workspace users.</p>
          )}
        </div>

        <div className="preset-save-footer">
          <button type="button" className="confirm-btn confirm-btn--cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="confirm-btn confirm-btn--primary" disabled={!name.trim() || saving}>
            {saving ? <><Loader2 size={13} className="spin" /> Saving...</> : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
