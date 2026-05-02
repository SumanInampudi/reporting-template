import { useEffect, useRef, useState } from "react";
import { Bell, Loader2, Plus, Pencil, Trash2, UserPlus, Users, X, Send, Save } from "lucide-react";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import type { Subscription, SubscriptionFormat, SubscriptionFrequency, SubscriptionSchedule } from "@/types/dashboard";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type DraftSub = Omit<Subscription, "workspace_id" | "preset_id" | "created_at" | "updated_at"> & {
  _isNew?: boolean;
};

interface Props {
  presetName: string;
  subscribers: Subscription[];
  currentUserEmail: string;
  saving: boolean;
  onSave: (drafts: DraftSub[]) => void;
  onCancel: () => void;
}

let _nextTempId = 1;
function tempId() { return `__new_${_nextTempId++}`; }

function schedText(sub: DraftSub): string {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let label = sub.schedule.frequency.charAt(0).toUpperCase() + sub.schedule.frequency.slice(1);
  if (sub.schedule.frequency === "weekly") label += ` · ${days[sub.schedule.day_of_week ?? 0]}`;
  if (sub.schedule.frequency === "monthly") {
    label += sub.schedule.day_of_month === -1 ? " · Last" : ` · ${sub.schedule.day_of_month ?? 1}`;
  }
  return label;
}

export type { DraftSub };

export default function SubscribeDialog({
  presetName, subscribers, currentUserEmail, saving,
  onSave, onCancel,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const { offset, handleMouseDown } = useDraggableModal();

  const [drafts, setDrafts] = useState<DraftSub[]>(() =>
    subscribers.map((s) => ({ ...s })),
  );

  const [frequency, setFrequency] = useState<SubscriptionFrequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [format, setFormat] = useState<SubscriptionFormat>("csv");
  const [newEmail, setNewEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const isDirty = (() => {
    if (drafts.length !== subscribers.length) return true;
    const origMap = new Map(subscribers.map((s) => [s.id, s]));
    return drafts.some((d) => {
      if (d._isNew) return true;
      const orig = origMap.get(d.id);
      if (!orig) return true;
      return (
        d.format !== orig.format ||
        d.enabled !== orig.enabled ||
        d.schedule.frequency !== orig.schedule.frequency ||
        d.schedule.day_of_week !== orig.schedule.day_of_week ||
        d.schedule.day_of_month !== orig.schedule.day_of_month
      );
    });
  })();

  const startEditing = (id: string) => {
    const sub = drafts.find((d) => d.id === id);
    if (!sub) return;
    setEditingId(id);
    setFrequency(sub.schedule.frequency);
    setDayOfWeek(sub.schedule.day_of_week ?? 0);
    setDayOfMonth(sub.schedule.day_of_month ?? 1);
    setFormat(sub.format);
    requestAnimationFrame(() => {
      scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, saving]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !saving) onCancel();
  };

  const buildSchedule = (): SubscriptionSchedule => {
    const sched: SubscriptionSchedule = { frequency };
    if (frequency === "weekly") sched.day_of_week = dayOfWeek;
    if (frequency === "monthly") sched.day_of_month = dayOfMonth;
    return sched;
  };

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (drafts.some((d) => d.email.toLowerCase() === email)) return;
    setDrafts((prev) => [
      ...prev,
      {
        id: tempId(),
        email,
        schedule: buildSchedule(),
        format,
        enabled: true,
        added_by: currentUserEmail || "local_user",
        _isNew: true,
      },
    ]);
    setNewEmail("");
  };

  const handleAddMyself = () => {
    if (!currentUserEmail) return;
    const email = currentUserEmail.toLowerCase();
    if (drafts.some((d) => d.email.toLowerCase() === email)) return;
    setDrafts((prev) => [
      ...prev,
      {
        id: tempId(),
        email,
        schedule: buildSchedule(),
        format,
        enabled: true,
        added_by: currentUserEmail,
        _isNew: true,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleUpdateDraft = () => {
    if (!editingId) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === editingId ? { ...d, schedule: buildSchedule(), format } : d,
      ),
    );
    setEditingId(null);
  };

  const meSubscribed = drafts.some((d) => d.email.toLowerCase() === currentUserEmail.toLowerCase());
  const formatLabel = format === "csv" ? "CSV" : "Excel";

  return (
    <div className="confirm-overlay" ref={overlayRef} onClick={handleOverlay}>
      <div className="sub-dialog" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        {/* Header */}
        <div className="sub-dialog-header drag-handle" onMouseDown={handleMouseDown}>
          <Users size={18} />
          <span className="sub-dialog-title">Manage Subscribers</span>
          <button className="preset-save-close" onClick={onCancel} disabled={saving}><X size={16} /></button>
        </div>

        {/* Preset context */}
        <div className="sub-dialog-preset">
          <Bell size={14} />
          Preset: <strong>{presetName}</strong>
        </div>

        {/* Info text */}
        <div className="sub-dialog-info">
          <Send size={14} />
          Recipients receive this preset's data as a <strong>{formatLabel}</strong> on the configured delivery schedule.
        </div>

        <div className="sub-dialog-body">
          {/* ADD RECIPIENT section */}
          <div className="sub-dialog-section">
            <label className="sub-dialog-label">Add Recipient</label>
            <div className="sub-dialog-add-row">
              <input
                className="sub-dialog-input"
                type="email"
                placeholder="name@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={saving}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              />
              <button className="sub-dialog-add-btn" onClick={handleAdd} disabled={saving || !newEmail.trim()}>
                <Plus size={14} /> Add
              </button>
            </div>
            {!meSubscribed && currentUserEmail && (
              <button className="sub-dialog-add-me" onClick={handleAddMyself} disabled={saving}>
                <UserPlus size={14} /> Add myself
              </button>
            )}
          </div>

          {/* SCHEDULE section */}
          <div
            ref={scheduleRef}
            className={`sub-dialog-section${editingId ? " sub-dialog-section--editing" : ""}`}
          >
            <label className="sub-dialog-label">
              {editingId
                ? `Editing schedule for ${drafts.find((d) => d.id === editingId)?.email ?? ""}`
                : "Schedule (for new recipients)"}
            </label>

            <div className="sub-dialog-freq-row">
              <span className="sub-dialog-freq-label">Schedule:</span>
              {(["daily", "weekly", "monthly"] as SubscriptionFrequency[]).map((f) => (
                <button
                  key={f}
                  className={`sub-dialog-pill${frequency === f ? " sub-dialog-pill--active" : ""}`}
                  onClick={() => setFrequency(f)}
                  disabled={saving}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {frequency === "weekly" && (
              <div className="sub-dialog-day-section">
                <span className="sub-dialog-freq-label">Day:</span>
                <div className="sub-dialog-weekdays">
                  {WEEKDAYS.map((name, i) => (
                    <button
                      key={i}
                      className={`sub-dialog-weekday${dayOfWeek === i ? " sub-dialog-weekday--active" : ""}`}
                      onClick={() => setDayOfWeek(i)}
                      disabled={saving}
                      title={WEEKDAYS_FULL[i]}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {frequency === "monthly" && (
              <div className="sub-dialog-day-section">
                <span className="sub-dialog-freq-label">Day of Month:</span>
                <div className="sub-dialog-day-grid">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      className={`sub-dialog-day-cell${dayOfMonth === d ? " sub-dialog-day-cell--active" : ""}`}
                      onClick={() => setDayOfMonth(d)}
                      disabled={saving}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    className={`sub-dialog-day-last${dayOfMonth === -1 ? " sub-dialog-day-last--active" : ""}`}
                    onClick={() => setDayOfMonth(-1)}
                    disabled={saving}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}

            <div className="sub-dialog-freq-row">
              <span className="sub-dialog-freq-label">Format:</span>
              {([
                { id: "csv" as const, label: "CSV" },
                { id: "xlsx" as const, label: "Excel" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  className={`sub-dialog-pill${format === opt.id ? " sub-dialog-pill--active" : ""}`}
                  onClick={() => setFormat(opt.id)}
                  disabled={saving}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {editingId && (
              <div className="sub-dialog-edit-actions">
                <button className="sub-dialog-edit-save" onClick={handleUpdateDraft} disabled={saving}>
                  Apply Change
                </button>
                <button className="sub-dialog-edit-cancel" onClick={() => setEditingId(null)} disabled={saving}>
                  Cancel Edit
                </button>
              </div>
            )}
          </div>

          {/* CURRENT SUBSCRIBERS */}
          <div className="sub-dialog-section">
            <div className="sub-dialog-subs-header">
              <label className="sub-dialog-label">Current Subscribers</label>
              <span className="sub-dialog-subs-count">{drafts.length} subscriber{drafts.length !== 1 ? "s" : ""}</span>
            </div>

            {drafts.length === 0 ? (
              <div className="sub-dialog-empty">
                <Users size={28} strokeWidth={1} />
                <span>No subscribers yet</span>
                <span className="sub-dialog-empty-hint">Add email addresses above to start deliveries.</span>
              </div>
            ) : (
              <div className="sub-dialog-subs-table">
                <div className="sub-dialog-subs-row sub-dialog-subs-row--header">
                  <span className="sub-dialog-subs-col-email">Email</span>
                  <span className="sub-dialog-subs-col-sched">Schedule</span>
                  <span className="sub-dialog-subs-col-fmt">Format</span>
                  <span className="sub-dialog-subs-col-actions">Actions</span>
                </div>
                {drafts.map((sub) => {
                  const isMe = sub.email.toLowerCase() === currentUserEmail.toLowerCase();
                  const isEditing = sub.id === editingId;
                  return (
                    <div
                      key={sub.id}
                      className={`sub-dialog-subs-row${isMe ? " sub-dialog-subs-row--me" : ""}${sub._isNew ? " sub-dialog-subs-row--new" : ""}${isEditing ? " sub-dialog-subs-row--editing" : ""}`}
                    >
                      <span className="sub-dialog-subs-col-email">
                        {sub.email}
                        {isMe && <span className="sub-dialog-you-badge">you</span>}
                        {sub._isNew && <span className="sub-dialog-new-badge">new</span>}
                        {isEditing && <span className="sub-dialog-editing-badge">editing</span>}
                      </span>
                      <span className="sub-dialog-subs-col-sched">{schedText(sub)}</span>
                      <span className="sub-dialog-subs-col-fmt">{sub.format.toUpperCase()}</span>
                      <span className="sub-dialog-subs-col-actions">
                        <button
                          className={`sub-dialog-subs-action${isEditing ? " sub-dialog-subs-action--active" : ""}`}
                          onClick={() => startEditing(sub.id)}
                          disabled={saving}
                          title="Edit schedule"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="sub-dialog-subs-action sub-dialog-subs-action--danger"
                          onClick={() => handleRemove(sub.id)}
                          disabled={saving}
                          title={isMe ? "Remove myself" : "Remove subscriber"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sub-dialog-footer">
          <button className="confirm-btn confirm-btn--cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="confirm-btn confirm-btn--primary"
            onClick={() => onSave(drafts)}
            disabled={saving || !isDirty}
          >
            {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : <><Save size={14} /> Save All Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
