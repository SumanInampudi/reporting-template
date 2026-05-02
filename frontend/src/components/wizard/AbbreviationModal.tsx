import { useState } from "react";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import {
  getDefaultAbbreviations,
  type AbbreviationEntry,
} from "@/lib/aliasUtils";

interface AbbreviationModalProps {
  onClose: () => void;
  onApply: (entries: AbbreviationEntry[]) => void;
  initialEntries: AbbreviationEntry[];
}

export default function AbbreviationModal({
  onClose,
  onApply,
  initialEntries,
}: AbbreviationModalProps) {
  const [entries, setEntries] = useState<AbbreviationEntry[]>(() => [...initialEntries]);
  const [newWord, setNewWord] = useState("");
  const [newAbbr, setNewAbbr] = useState("");
  const { offset, handleMouseDown } = useDraggableModal();

  const updateEntry = (idx: number, field: "word" | "abbr", value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEntry = () => {
    const w = newWord.trim().toLowerCase();
    const a = newAbbr.trim();
    if (!w || !a) return;
    if (entries.some((e) => e.word.toLowerCase() === w)) return;
    setEntries((prev) => [...prev, { word: w, abbr: a }]);
    setNewWord("");
    setNewAbbr("");
  };

  const handleApply = () => {
    onApply(entries);
  };

  const handleReset = () => {
    setEntries(getDefaultAbbreviations());
  };

  return (
    <div className="alias-modal-backdrop" onClick={onClose}>
      <div className="alias-modal" onClick={(e) => e.stopPropagation()} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="alias-modal-header drag-handle" onMouseDown={handleMouseDown}>
          <h3 className="alias-modal-title"><BookOpen size={16} /> Abbreviation Dictionary</h3>
          <button className="alias-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="alias-modal-desc">
          Define word &rarr; abbreviation rules. When &quot;Smart Abbreviate&quot; is used, matching words are replaced.
        </p>

        <div className="abbr-table-wrap">
          <table className="abbr-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Abbreviation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i}>
                  <td>
                    <input className="abbr-input" value={entry.word} onChange={(e) => updateEntry(i, "word", e.target.value)} />
                  </td>
                  <td>
                    <input className="abbr-input" value={entry.abbr} onChange={(e) => updateEntry(i, "abbr", e.target.value)} />
                  </td>
                  <td>
                    <button className="abbr-remove" onClick={() => removeEntry(i)} title="Remove"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              <tr className="abbr-add-row">
                <td>
                  <input className="abbr-input" placeholder="word" value={newWord} onChange={(e) => setNewWord(e.target.value)} />
                </td>
                <td>
                  <input className="abbr-input" placeholder="abbr" value={newAbbr} onChange={(e) => setNewAbbr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEntry()} />
                </td>
                <td>
                  <button className="abbr-add-btn" onClick={addEntry} title="Add"><Plus size={12} /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="alias-modal-footer">
          <button className="alias-modal-reset" onClick={handleReset}>Reset to Defaults</button>
          <div className="alias-modal-actions">
            <button className="alias-modal-cancel" onClick={onClose}>Cancel</button>
            <button className="alias-modal-apply" onClick={handleApply}>Apply &amp; Regenerate</button>
          </div>
        </div>
      </div>
    </div>
  );
}
