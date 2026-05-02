import { Play, Copy, Trash2, Globe, Lock, Pencil, Bell, BellRing, Loader2, Users, Star, Shield } from "lucide-react";
import type { Preset, Subscription } from "@/types/dashboard";

interface Props {
  preset: Preset;
  isActive: boolean;
  isDefault?: boolean;
  isAdminDefault?: boolean;
  isMyDefault?: boolean;
  isAdmin?: boolean;
  disabled?: boolean;
  showSubscribe?: boolean;
  subscriberCount: number;
  mySubscription?: Subscription | null;
  onLoad: (preset: Preset) => void;
  onDuplicate: (preset: Preset) => void;
  onDelete: (preset: Preset) => void;
  onTogglePublic: (preset: Preset) => void;
  onRename: (preset: Preset) => void;
  onSubscribe: (preset: Preset) => void;
  onToggleDefault?: (preset: Preset) => void;
  onToggleAdminDefault?: (preset: Preset) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scheduleLabel(sub: Subscription): string {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (sub.schedule.frequency === "daily") return "Daily";
  if (sub.schedule.frequency === "weekly") return `Weekly · ${days[sub.schedule.day_of_week ?? 0]}`;
  if (sub.schedule.frequency === "monthly") {
    if (sub.schedule.day_of_month === -1) return "Monthly · Last";
    return `Monthly · ${sub.schedule.day_of_month ?? 1}`;
  }
  return sub.schedule.frequency;
}

export default function PresetCard({
  preset, isActive, isDefault, isAdminDefault, isMyDefault, isAdmin,
  disabled, showSubscribe = false, subscriberCount, mySubscription,
  onLoad, onDuplicate, onDelete, onTogglePublic, onRename, onSubscribe,
  onToggleDefault, onToggleAdminDefault,
}: Props) {
  const isMeSubscribed = showSubscribe && !!mySubscription;

  return (
    <div className={`pc3${isActive ? " pc3--active" : ""}`}>
      {/* Left: info */}
      <div className="pc3-info">
        <span className="pc3-name">
          {isAdminDefault && <span title="Workspace default"><Shield size={12} className="pc3-admin-default-icon" /></span>}
          {isMyDefault && <span title="My default"><Star size={12} className="pc3-default-star" /></span>}
          {!isAdminDefault && !isMyDefault && isDefault && <Star size={12} className="pc3-default-star" />}
          {preset.name}
        </span>
        <div className="pc3-meta">
          {preset.is_public ? (
            <span className="pc3-badge pc3-badge--public"><Globe size={11} /> Public</span>
          ) : (
            <span className="pc3-badge pc3-badge--private"><Lock size={11} /> Private</span>
          )}
          {isMeSubscribed && (
            <span className="pc3-badge pc3-badge--subscribed">
              <BellRing size={11} /> {scheduleLabel(mySubscription!)}
            </span>
          )}
          {showSubscribe && subscriberCount > 0 && (
            <span className="pc3-badge pc3-badge--subs"><Users size={10} /> {subscriberCount}</span>
          )}
          <span className="pc3-time">{timeAgo(preset.updated_at)}</span>
          {preset.owner && <span className="pc3-owner">{preset.owner}</span>}
        </div>
      </div>

      {/* Middle: all action buttons inline */}
      <div className="pc3-actions">
        <button className="pc3-btn" onClick={() => onRename(preset)} disabled={disabled} title="Edit">
          <Pencil size={14} /> <span className="pc3-btn-label">Edit</span>
        </button>
        <button className="pc3-btn" onClick={() => onDuplicate(preset)} disabled={disabled} title="Duplicate">
          <Copy size={14} /> <span className="pc3-btn-label">Duplicate</span>
        </button>
        {showSubscribe && (
          <button
            className={`pc3-btn${isMeSubscribed ? " pc3-btn--subscribed" : ""}`}
            onClick={() => onSubscribe(preset)}
            disabled={disabled}
            title={isMeSubscribed ? "Manage subscription" : "Subscribe"}
          >
            {isMeSubscribed ? <BellRing size={14} /> : <Bell size={14} />}
            <span className="pc3-btn-label">{isMeSubscribed ? "Subscribed" : "Subscribe"}</span>
          </button>
        )}
        <button className="pc3-btn" onClick={() => onTogglePublic(preset)} disabled={disabled} title={preset.is_public ? "Make Private" : "Make Public"}>
          {preset.is_public ? <Lock size={14} /> : <Globe size={14} />}
          <span className="pc3-btn-label">{preset.is_public ? "Private" : "Public"}</span>
        </button>
        {onToggleDefault && (
          <button
            className={`pc3-btn${isMyDefault ? " pc3-btn--default" : ""}`}
            onClick={() => onToggleDefault(preset)}
            disabled={disabled}
            title={isMyDefault ? "Remove as my default" : "Set as my default"}
          >
            <Star size={14} /> <span className="pc3-btn-label">{isMyDefault ? "My Default" : "My Default"}</span>
          </button>
        )}
        {isAdmin && onToggleAdminDefault && (
          <button
            className={`pc3-btn${isAdminDefault ? " pc3-btn--admin-default" : ""}`}
            onClick={() => onToggleAdminDefault(preset)}
            disabled={disabled}
            title={isAdminDefault ? "Remove workspace default" : "Set as workspace default for all users"}
          >
            <Shield size={14} /> <span className="pc3-btn-label">{isAdminDefault ? "WS Default" : "WS Default"}</span>
          </button>
        )}
        <button className="pc3-btn pc3-btn--danger" onClick={() => onDelete(preset)} disabled={disabled} title="Delete">
          <Trash2 size={14} /> <span className="pc3-btn-label">Delete</span>
        </button>
      </div>

      {/* Right: Load button */}
      <button
        className="pc3-load"
        onClick={() => onLoad(preset)}
        disabled={disabled}
        title="Load this preset"
      >
        {disabled ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
        Load
      </button>
    </div>
  );
}
