import { useMemo, useState } from "react";
import { Columns3, Hash, Type, Pencil, Sigma } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { NUMERIC_RE } from "@/lib/constants";
import ColumnSelectorModal from "./ColumnSelectorModal";

export default function ColumnPicker() {
  const {
    selectedCatalog, selectedSchema, selectedTable, columns,
    selectedOutputColumns,
  } = useStore();

  const alias = useColumnAlias();
  const [modalOpen, setModalOpen] = useState(false);

  const fqTable = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : selectedTable;

  const allCols = useMemo(
    () => (fqTable ? (columns[fqTable] ?? []) : []),
    [fqTable, columns],
  );

  const colMap = useMemo(() => {
    const m = new Map(allCols.map((c) => [c.col_name, c]));
    return m;
  }, [allCols]);

  if (!fqTable || allCols.length === 0) {
    return (
      <div className="colpick-empty">
        <Columns3 size={20} strokeWidth={1.5} />
        <p>Select a table to choose output columns</p>
      </div>
    );
  }

  const selected = selectedOutputColumns;
  const dimCount = selected.filter((n) => {
    const m = colMap.get(n);
    return m && !NUMERIC_RE.test(m.data_type);
  }).length;
  const measCount = selected.filter((n) => {
    const m = colMap.get(n);
    return m && NUMERIC_RE.test(m.data_type);
  }).length;
  const formulaCount = selected.filter((n) => n.startsWith("__fc__")).length;

  return (
    <div className="csm-card">
      <div className="csm-card-header">
        <Columns3 size={14} />
        <span className="csm-card-title">Output Columns</span>
        <span className="csm-card-count">{selected.length} / {allCols.length}</span>
      </div>

      {selected.length === 0 ? (
        <div className="csm-card-empty">
          <p>No columns selected yet</p>
          <button className="csm-card-btn" onClick={() => setModalOpen(true)}>
            <Pencil size={12} /> Choose Columns
          </button>
        </div>
      ) : (
        <div className="csm-card-body">
          <div className="csm-card-stats">
            {dimCount > 0 && (
              <span className="csm-card-stat">
                <Type size={10} className="colpick-icon--text" /> {dimCount} dimension{dimCount !== 1 ? "s" : ""}
              </span>
            )}
            {measCount > 0 && (
              <span className="csm-card-stat">
                <Hash size={10} className="colpick-icon--num" /> {measCount} measure{measCount !== 1 ? "s" : ""}
              </span>
            )}
            {formulaCount > 0 && (
              <span className="csm-card-stat">
                <Sigma size={10} className="colpick-icon--formula" /> {formulaCount} formula{formulaCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="csm-card-preview">
            {selected.slice(0, 8).map((n) => {
              const label = n.startsWith("__fc__") ? n.replace(/^__fc__.*?__/, "") : alias(n);
              return <span key={n} className="csm-card-tag">{label}</span>;
            })}
            {selected.length > 8 && (
              <span className="csm-card-tag csm-card-tag--more">+{selected.length - 8} more</span>
            )}
          </div>

          <button className="csm-card-btn" onClick={() => setModalOpen(true)}>
            <Pencil size={12} /> Edit Columns & Order
          </button>
        </div>
      )}

      {modalOpen && <ColumnSelectorModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
