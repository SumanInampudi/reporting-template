import { useEffect, useRef, useState } from "react";
import { Settings, Loader2, X, Shield, Clock } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { fetchAppSettings, saveAppSettings } from "@/lib/api";
import { toast } from "@/components/ui/Toast";

interface Props {
  onClose: () => void;
}

export default function PlatformSettingsModal({ onClose }: Props) {
  const { teamName, setTeamName, platformTagline, setPlatformTagline } = useStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(teamName);
  const [tagline, setTagline] = useState(platformTagline);
  const [adminSuffixes, setAdminSuffixes] = useState("");
  const [queryTimeout, setQueryTimeout] = useState(300);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [origName, setOrigName] = useState(teamName);
  const [origTagline, setOrigTagline] = useState(platformTagline);
  const [origSuffixes, setOrigSuffixes] = useState("");
  const [origTimeout, setOrigTimeout] = useState(300);

  useEffect(() => {
    fetchAppSettings()
      .then((s) => {
        if (s.team_name) { setName(s.team_name); setOrigName(s.team_name); }
        if (s.platform_tagline != null) { setTagline(s.platform_tagline); setOrigTagline(s.platform_tagline); }
        if (s.admin_role_suffixes != null) { setAdminSuffixes(s.admin_role_suffixes); setOrigSuffixes(s.admin_role_suffixes); }
        if (s.query_timeout_seconds != null) {
          const v = Number(s.query_timeout_seconds);
          if (!isNaN(v)) { setQueryTimeout(v); setOrigTimeout(v); }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !saving) onClose();
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setSaving(true);
    try {
      const trimmedTagline = tagline.trim();
      await saveAppSettings({
        team_name: trimmed,
        platform_tagline: trimmedTagline,
        admin_role_suffixes: adminSuffixes.trim(),
        query_timeout_seconds: String(queryTimeout),
      });
      setTeamName(trimmed);
      setPlatformTagline(trimmedTagline || "Analytics Platform");
      document.title = trimmed;
      toast.success("Platform settings saved");
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    name.trim() !== origName ||
    tagline.trim() !== origTagline ||
    adminSuffixes.trim() !== origSuffixes ||
    queryTimeout !== origTimeout;

  return (
    <div className="confirm-overlay" ref={overlayRef} onClick={handleOverlay}>
      <div className="ps-modal">
        <div className="ps-header">
          <Settings size={16} />
          <span className="ps-title">Platform Settings</span>
          <button className="ps-close" onClick={onClose} disabled={saving}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="ps-body" style={{ textAlign: "center", padding: "2rem" }}>
            <Loader2 size={20} className="spin" />
          </div>
        ) : (
          <div className="ps-body">
            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-team-name">
                Team / Platform Name
              </label>
              <input
                id="ps-team-name"
                className="ps-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "ZOOM 360"'
                maxLength={60}
                autoFocus
              />
              <span className="ps-hint">
                Shown in navigation, browser tab, and across the platform.
              </span>
            </div>

            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-tagline">
                Platform Tagline
              </label>
              <input
                id="ps-tagline"
                className="ps-input"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder='e.g. "Analytics Platform"'
                maxLength={80}
              />
              <span className="ps-hint">
                Shown below the team name in the navigation bar. Leave empty to use "Analytics Platform".
              </span>
            </div>

            <div className="ps-divider" />

            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-admin-suffixes">
                <Shield size={13} /> Admin Role Suffixes
              </label>
              <input
                id="ps-admin-suffixes"
                className="ps-input"
                type="text"
                value={adminSuffixes}
                onChange={(e) => setAdminSuffixes(e.target.value)}
                placeholder='e.g. "DataAdmin,ClusterAdmin"'
              />
              <span className="ps-hint">
                Comma-separated AD group suffixes that grant admin role. Leave empty to make everyone admin.
              </span>
            </div>

            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-query-timeout">
                <Clock size={13} /> Query Timeout (seconds)
              </label>
              <input
                id="ps-query-timeout"
                className="ps-input"
                type="number"
                min={10}
                max={3600}
                value={queryTimeout}
                onChange={(e) => setQueryTimeout(Number(e.target.value) || 300)}
              />
              <span className="ps-hint">
                Maximum time a SQL query can run before timing out (10-3600s).
              </span>
            </div>
          </div>
        )}

        <div className="ps-footer">
          <button className="ps-btn ps-btn--cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="ps-btn ps-btn--save"
            onClick={handleSave}
            disabled={saving || !dirty || name.trim().length < 2}
          >
            {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
