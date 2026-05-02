import { useEffect, useRef, useState } from "react";
import { X, BookOpen, Loader2 } from "lucide-react";
import PresetCard from "./PresetCard";
import PresetSaveDialog from "./PresetSaveDialog";
import SubscribeDialog from "./SubscribeDialog";
import type { DraftSub } from "./SubscribeDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useStore } from "@/hooks/useStore";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import {
  fetchPresets, deletePreset as apiDeletePreset, duplicatePreset as apiDuplicate,
  updatePreset as apiUpdate,
  fetchSubscriptions, batchSaveSubscriptions,
} from "@/lib/api";
import type { Preset, Subscription } from "@/types/dashboard";

interface Props {
  onClose: () => void;
  onLoad: (preset: Preset) => void;
}

export default function PresetListPanel({ onClose, onLoad }: Props) {
  const { activeWorkspace, presets, setPresets, activePresetId, currentUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [renameTarget, setRenameTarget] = useState<Preset | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<Preset | null>(null);
  const [allSubs, setAllSubs] = useState<Record<string, Subscription[]>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const wsId = activeWorkspace?.id;
  const myEmail = (currentUser?.email || currentUser?.username || "").toLowerCase();
  const subsEnabled = (activeWorkspace?.features ?? []).includes("subscriptions");

  const defaultKey = wsId ? `default-preset-${wsId}` : null;
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(() =>
    defaultKey ? localStorage.getItem(defaultKey) : null,
  );
  const handleToggleDefault = (preset: Preset) => {
    if (!defaultKey) return;
    if (defaultPresetId === preset.id) {
      localStorage.removeItem(defaultKey);
      setDefaultPresetId(null);
    } else {
      localStorage.setItem(defaultKey, preset.id);
      setDefaultPresetId(preset.id);
    }
  };

  const flash = (msg: string, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  };

  const loadSubscriptionsForPresets = (list: Preset[]) => {
    if (!wsId || !subsEnabled) return;
    list.forEach((p) => {
      fetchSubscriptions(wsId, p.id)
        .then((subs) => setAllSubs((prev) => ({ ...prev, [p.id]: subs })))
        .catch(() => {});
    });
  };

  useEffect(() => {
    if (!wsId) return;
    setLoading(true);
    fetchPresets(wsId)
      .then((list) => {
        setPresets(list);
        if (subsEnabled) loadSubscriptionsForPresets(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [wsId, setPresets]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteTarget && !renameTarget && !subscribeTarget && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, deleteTarget, renameTarget, subscribeTarget, busy]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !busy) onClose();
  };

  const reload = async () => {
    if (!wsId) return;
    const list = await fetchPresets(wsId);
    setPresets(list);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !wsId) return;
    setBusy(true);
    try {
      await apiDeletePreset(wsId, deleteTarget.id);
      setAllSubs((prev) => { const next = { ...prev }; delete next[deleteTarget.id]; return next; });
      setDeleteTarget(null);
      await reload();
      flash("Preset deleted");
    } catch {
      flash("Failed to delete preset");
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (p: Preset) => {
    if (!wsId || busy) return;
    setBusy(true);
    try {
      await apiDuplicate(wsId, p.id);
      await reload();
      flash("Preset duplicated");
    } catch {
      flash("Failed to duplicate preset");
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublic = async (p: Preset) => {
    if (!wsId || busy) return;
    setBusy(true);
    try {
      await apiUpdate(wsId, p.id, { is_public: !p.is_public });
      await reload();
      flash(p.is_public ? "Preset set to private" : "Preset set to public");
    } catch {
      flash("Failed to update preset");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (name: string, description: string, isPublic: boolean) => {
    if (!renameTarget || !wsId) return;
    setBusy(true);
    try {
      await apiUpdate(wsId, renameTarget.id, { name, description, is_public: isPublic });
      setRenameTarget(null);
      await reload();
      flash("Preset updated");
    } catch {
      flash("Failed to update preset");
    } finally {
      setBusy(false);
    }
  };

  /* ── Subscription batch save ── */

  const handleBatchSave = async (drafts: DraftSub[]) => {
    if (!subscribeTarget || !wsId) return;
    setBusy(true);
    try {
      const payload = drafts.map((d) => ({
        id: d._isNew ? undefined : d.id,
        email: d.email,
        schedule: d.schedule,
        format: d.format,
        enabled: d.enabled,
        added_by: d.added_by || myEmail || "local_user",
      }));
      const saved = await batchSaveSubscriptions(wsId, subscribeTarget.id, payload);
      setAllSubs((prev) => ({ ...prev, [subscribeTarget.id]: saved }));
      setSubscribeTarget(null);
      flash("Subscriptions saved");
    } catch {
      flash("Failed to save subscriptions");
    } finally {
      setBusy(false);
    }
  };

  const myPresets = presets.filter((p) => !p.is_public);
  const publicPresets = presets.filter((p) => p.is_public);

  const getMySubscription = (presetId: string): Subscription | null => {
    const subs = allSubs[presetId] ?? [];
    return subs.find((s) => s.email.toLowerCase() === myEmail) ?? null;
  };

  return (
    <div className="confirm-overlay" ref={overlayRef} onClick={handleOverlay}>
      <div className="preset-list-panel-v2" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="preset-list-header-v2 drag-handle" onMouseDown={handleMouseDown}>
          <BookOpen size={20} />
          <span>Manage Presets</span>
          <span className="preset-list-count">{presets.length} preset{presets.length !== 1 ? "s" : ""}</span>
          <button className="preset-save-close" onClick={onClose} disabled={busy}><X size={16} /></button>
        </div>

        <div className="preset-list-body-v2">
          {loading && (
            <div className="preset-list-empty"><Loader2 size={20} className="spin" /> Loading presets...</div>
          )}
          {error && <div className="preset-list-error">{error}</div>}

          {!loading && !error && presets.length === 0 && (
            <div className="preset-list-empty">
              No presets yet. Save your current configuration to create the first one.
            </div>
          )}

          {myPresets.length > 0 && (
            <div className="preset-list-section-v2">
              <h4 className="preset-list-section-title-v2">My Presets</h4>
              <div className="preset-list-grid">
                {myPresets.map((p) => (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    isActive={p.id === activePresetId}
                    isDefault={p.id === defaultPresetId}
                    disabled={busy}
                    showSubscribe={subsEnabled}
                    subscriberCount={(allSubs[p.id] ?? []).length}
                    mySubscription={getMySubscription(p.id)}
                    onLoad={onLoad}
                    onDuplicate={handleDuplicate}
                    onDelete={setDeleteTarget}
                    onTogglePublic={handleTogglePublic}
                    onRename={setRenameTarget}
                    onSubscribe={setSubscribeTarget}
                    onToggleDefault={handleToggleDefault}
                  />
                ))}
              </div>
            </div>
          )}

          {publicPresets.length > 0 && (
            <div className="preset-list-section-v2">
              <h4 className="preset-list-section-title-v2">Shared Presets</h4>
              <div className="preset-list-grid">
                {publicPresets.map((p) => (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    isActive={p.id === activePresetId}
                    isDefault={p.id === defaultPresetId}
                    disabled={busy}
                    showSubscribe={subsEnabled}
                    subscriberCount={(allSubs[p.id] ?? []).length}
                    mySubscription={getMySubscription(p.id)}
                    onLoad={onLoad}
                    onDuplicate={handleDuplicate}
                    onDelete={setDeleteTarget}
                    onTogglePublic={handleTogglePublic}
                    onRename={setRenameTarget}
                    onSubscribe={setSubscribeTarget}
                    onToggleDefault={handleToggleDefault}
                  />
                ))}
              </div>
            </div>
          )}

          {toast && <div className="preset-toast preset-toast--inline">{toast}</div>}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Preset"
          message={`Are you sure you want to delete "${deleteTarget.name}"? Any subscriptions will also be removed. This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          loading={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {renameTarget && (
        <PresetSaveDialog
          title="Edit Preset"
          confirmLabel="Update"
          initialName={renameTarget.name}
          initialDescription={renameTarget.description}
          initialPublic={renameTarget.is_public}
          saving={busy}
          onSave={handleRename}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {subscribeTarget && (
        <SubscribeDialog
          presetName={subscribeTarget.name}
          subscribers={allSubs[subscribeTarget.id] ?? []}
          currentUserEmail={myEmail}
          saving={busy}
          onSave={handleBatchSave}
          onCancel={() => setSubscribeTarget(null)}
        />
      )}
    </div>
  );
}
