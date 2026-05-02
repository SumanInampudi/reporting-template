import { createPortal } from "react-dom";
import { AlertTriangle, Save, Trash2, X } from "lucide-react";

interface Props {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function UnsavedChangesDialog({ onSave, onDiscard, onCancel, saving }: Props) {
  return createPortal(
    <div className="ucd-backdrop" onClick={onCancel}>
      <div className="ucd-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ucd-header">
          <AlertTriangle size={20} className="ucd-icon" />
          <h3 className="ucd-title">Unsaved Changes</h3>
          <button className="ucd-close" onClick={onCancel}><X size={16} /></button>
        </div>
        <p className="ucd-body">
          You have unsaved changes to your preset. Would you like to save them before leaving?
        </p>
        <div className="ucd-actions">
          <button className="ucd-btn ucd-btn--discard" onClick={onDiscard} disabled={saving}>
            <Trash2 size={14} /> Discard
          </button>
          <button className="ucd-btn ucd-btn--cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="ucd-btn ucd-btn--save" onClick={onSave} disabled={saving}>
            <Save size={14} /> {saving ? "Saving..." : "Save & Leave"}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("themed-portal") ?? document.body,
  );
}
