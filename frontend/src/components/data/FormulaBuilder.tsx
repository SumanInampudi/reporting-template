import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sigma, Trash2, Pencil, Check, Globe, Lock, Loader2, X } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import {
  fetchSharedFormulas, createSharedFormula, updateSharedFormula, deleteSharedFormula,
} from "@/lib/api";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormulaModal from "./FormulaModal";
import type { FormulaColumn, SharedFormulaColumn } from "@/types/dashboard";

export default function FormulaBuilder() {
  const {
    formulaColumns, addFormulaColumn, updateFormulaColumn, removeFormulaColumn,
    selectedOutputColumns, toggleOutputColumn, setOutputColumns,
    sharedFormulas, setSharedFormulas, activeWorkspace, currentUser,
  } = useStore();

  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFc, setEditingFc] = useState<FormulaColumn | null>(null);
  const [editingSf, setEditingSf] = useState<SharedFormulaColumn | null>(null);
  const [sharing, setSharing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "local"; fc: FormulaColumn } | { type: "shared"; sf: SharedFormulaColumn } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();
  const wsId = activeWorkspace?.id;
  const myEmail = (currentUser?.email || currentUser?.username || "").toLowerCase();
  const totalCount = formulaColumns.length + sharedFormulas.length;

  const loadShared = useCallback(async () => {
    if (!wsId) return;
    try {
      const list = await fetchSharedFormulas(wsId);
      setSharedFormulas(list);
    } catch { /* ignore */ }
  }, [wsId, setSharedFormulas]);

  useEffect(() => { loadShared(); }, [loadShared]);

  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPanelOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen]);

  const handleAdd = () => {
    setEditingFc(null);
    setEditingSf(null);
    setModalOpen(true);
  };

  const handleEdit = (fc: FormulaColumn) => {
    setEditingFc(fc);
    setEditingSf(null);
    setModalOpen(true);
  };

  const handleEditShared = (sf: SharedFormulaColumn) => {
    setEditingSf(sf);
    setEditingFc(null);
    setModalOpen(true);
  };

  const handleSave = async (data: { alias: string; expression: string; dataType: FormulaColumn["dataType"] }) => {
    if (editingSf) {
      if (!wsId) return;
      const oldColName = `__sf__${editingSf.id}__${editingSf.alias}`;
      const updated = await updateSharedFormula(wsId, editingSf.id, {
        alias: data.alias, expression: data.expression, data_type: data.dataType,
      });
      const newColName = `__sf__${updated.id}__${updated.alias}`;
      if (selectedOutputColumns.includes(oldColName) && oldColName !== newColName) {
        setOutputColumns(selectedOutputColumns.map((c) => c === oldColName ? newColName : c));
      }
      await loadShared();
    } else if (editingFc) {
      const oldColName = `__fc__${editingFc.id}__${editingFc.alias}`;
      const newColName = `__fc__${editingFc.id}__${data.alias}`;
      updateFormulaColumn(editingFc.id, data);
      if (selectedOutputColumns.includes(oldColName) && oldColName !== newColName) {
        setOutputColumns(selectedOutputColumns.map((c) => c === oldColName ? newColName : c));
      }
    } else {
      addFormulaColumn(data);
      const state = useStore.getState();
      const newest = state.formulaColumns[state.formulaColumns.length - 1];
      if (newest) {
        const colName = `__fc__${newest.id}__${newest.alias}`;
        if (!state.selectedOutputColumns.includes(colName)) {
          toggleOutputColumn(colName);
        }
      }
    }
    setModalOpen(false);
    setEditingFc(null);
    setEditingSf(null);
  };

  const handleShare = async (fc: FormulaColumn) => {
    if (!wsId || sharing) return;
    setSharing(true);
    try {
      await createSharedFormula(wsId, {
        alias: fc.alias, expression: fc.expression, data_type: fc.dataType,
      });
      await loadShared();
    } catch { /* ignore */ }
    setSharing(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "local") {
        removeFormulaColumn(deleteTarget.fc.id);
      } else if (wsId) {
        await deleteSharedFormula(wsId, deleteTarget.sf.id);
        setSharedFormulas(sharedFormulas.filter((f) => f.id !== deleteTarget.sf.id));
      }
    } catch { /* ignore */ }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const isIncluded = (colName: string) => selectedOutputColumns.includes(colName);

  return (
    <>
      {/* ─── Compact trigger button ─── */}
      <button className="fc-trigger" onClick={() => setPanelOpen(true)}>
        <Sigma size={14} />
        <span>Calculated Columns</span>
        {totalCount > 0 && <span className="fc-trigger-count">{totalCount}</span>}
      </button>

      {/* ─── Management panel (modal overlay) ─── */}
      {panelOpen && (
        <div className="fc-overlay" ref={overlayRef} onClick={(e) => e.target === overlayRef.current && setPanelOpen(false)}>
          <div className="fc-panel" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
            <div className="fc-panel-header drag-handle" onMouseDown={handleMouseDown}>
              <span className="fc-panel-title"><Sigma size={16} /> Calculated Columns</span>
              <button className="fc-panel-close" onClick={() => setPanelOpen(false)}><X size={16} /></button>
            </div>

            <div className="fc-panel-body">
              {/* ─── My (Private) Columns ─── */}
              <div className="fc-section">
                <div className="fc-section-hdr">
                  <Lock size={12} />
                  <span>My Columns</span>
                  <span className="fc-section-count">{formulaColumns.length}</span>
                </div>

                {formulaColumns.length === 0 ? (
                  <p className="fc-empty">No private columns yet. Click "Add Column" to create one.</p>
                ) : (
                  <div className="fc-list">
                    {formulaColumns.map((fc) => {
                      const colName = `__fc__${fc.id}__${fc.alias}`;
                      const on = isIncluded(colName);
                      return (
                        <div key={fc.id} className="fc-item">
                          <div className="fc-item-top">
                            <button
                              className={`fc-item-check ${on ? "fc-item-check--on" : ""}`}
                              onClick={() => toggleOutputColumn(colName)}
                              title={on ? "Remove from output" : "Include in output"}
                            ><Check size={10} /></button>
                            <span className="fc-item-name">{fc.alias}</span>
                            <span className="fc-item-type">{fc.dataType}</span>
                            <div className="fc-item-actions">
                              <button className="fc-item-btn" onClick={() => handleEdit(fc)} title="Edit"><Pencil size={11} /></button>
                              {wsId && (
                                <button className="fc-item-btn fc-item-btn--share" onClick={() => handleShare(fc)} disabled={sharing} title="Share with workspace">
                                  {sharing ? <Loader2 size={11} className="spin" /> : <Globe size={11} />}
                                </button>
                              )}
                              <button className="fc-item-btn fc-item-btn--danger" onClick={() => setDeleteTarget({ type: "local", fc })} title="Delete">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <code className="fc-item-expr">{fc.expression}</code>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button className="fc-add-btn" onClick={handleAdd}>
                  <Plus size={12} /> Add Column
                </button>
              </div>

              {/* ─── Shared (Public) Columns ─── */}
              <div className="fc-section">
                <div className="fc-section-hdr">
                  <Globe size={12} />
                  <span>Shared Columns</span>
                  <span className="fc-section-count">{sharedFormulas.length}</span>
                </div>

                {sharedFormulas.length === 0 ? (
                  <p className="fc-empty">No shared columns yet. Share a private column using the globe icon.</p>
                ) : (
                  <div className="fc-list">
                    {sharedFormulas.map((sf) => {
                      const colName = `__sf__${sf.id}__${sf.alias}`;
                      const on = isIncluded(colName);
                      const isOwner = sf.owner === myEmail || sf.owner === "local_user";
                      return (
                        <div key={sf.id} className="fc-item fc-item--shared">
                          <div className="fc-item-top">
                            <button
                              className={`fc-item-check ${on ? "fc-item-check--on" : ""}`}
                              onClick={() => toggleOutputColumn(colName)}
                              title={on ? "Remove from output" : "Include in output"}
                            ><Check size={10} /></button>
                            <span className="fc-item-name">{sf.alias}</span>
                            <span className="fc-item-type">{sf.data_type}</span>
                            <span className="fc-item-owner">by {sf.owner}</span>
                            {isOwner && (
                              <div className="fc-item-actions">
                                <button className="fc-item-btn" onClick={() => handleEditShared(sf)} title="Edit"><Pencil size={11} /></button>
                                <button className="fc-item-btn fc-item-btn--danger" onClick={() => setDeleteTarget({ type: "shared", sf })} title="Delete">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                          <code className="fc-item-expr">{sf.expression}</code>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Formula create/edit modal ─── */}
      {modalOpen && (
        <FormulaModal
          initial={
            editingSf
              ? { id: editingSf.id, alias: editingSf.alias, expression: editingSf.expression, dataType: editingSf.data_type }
              : editingFc ?? undefined
          }
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingFc(null); setEditingSf(null); }}
        />
      )}

      {/* ─── Delete confirmation ─── */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Column"
          message={`Are you sure you want to delete "${deleteTarget.type === "local" ? deleteTarget.fc.alias : deleteTarget.sf.alias}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
