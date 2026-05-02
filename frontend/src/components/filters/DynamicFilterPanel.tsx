import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import DynamicFilterChip from "./DynamicFilterChip";
import DynamicFilterModal from "./DynamicFilterModal";
import type { DynamicFilter } from "@/types/dashboard";

export default function DynamicFilterPanel() {
  const { dynamicFilters, addDynamicFilter, updateDynamicFilter, removeDynamicFilter, toggleDynamicFilter } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DynamicFilter | null>(null);

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (f: DynamicFilter) => {
    setEditing(f);
    setModalOpen(true);
  };

  const handleSave = (data: Omit<DynamicFilter, "id">) => {
    if (editing) {
      updateDynamicFilter(editing.id, data);
    } else {
      addDynamicFilter(data);
    }
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="df-panel">
      {dynamicFilters.length > 0 && (
        <div className="df-panel-list">
          {dynamicFilters.map((f) => (
            <DynamicFilterChip
              key={f.id}
              filter={f}
              onEdit={() => handleEdit(f)}
              onToggle={() => toggleDynamicFilter(f.id)}
              onRemove={() => removeDynamicFilter(f.id)}
            />
          ))}
        </div>
      )}

      <button className="df-add-rule-btn" onClick={handleAdd}>
        <Plus size={12} /> Add Your Own Filter
      </button>

      {modalOpen && (
        <DynamicFilterModal
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
