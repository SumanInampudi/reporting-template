import { useState } from "react";
import { Rocket, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { saveAppSettings } from "@/lib/api";
import { useStore } from "@/hooks/useStore";
import { toast } from "@/components/ui/Toast";

interface Props {
  onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: Props) {
  const { setTeamName } = useStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await saveAppSettings({ team_name: name.trim() });
      setTeamName(name.trim());
      document.title = name.trim();
      toast.success("Welcome aboard!");
      onComplete();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="onboard-page">
      <div className="onboard-card">
        <div className="onboard-glow" />

        <div className="onboard-header">
          <div className="onboard-icon-wrap">
            <Rocket size={28} />
          </div>
          <h1 className="onboard-title">Welcome to BI Excellence</h1>
          <p className="onboard-subtitle">
            Let's set up your analytics platform. You can change these settings anytime.
          </p>
        </div>

        <form className="onboard-form" onSubmit={handleSubmit}>
          <div className="onboard-field">
            <label className="onboard-label" htmlFor="ob-team">
              <Sparkles size={13} />
              Team / Platform Name
            </label>
            <input
              id="ob-team"
              className="onboard-input"
              type="text"
              placeholder='e.g. "ZOOM 360", "EMEA Analytics"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={60}
            />
            <span className="onboard-hint">
              This appears in the navigation bar, browser tab, and across the platform.
            </span>
          </div>

          <button className="onboard-submit" type="submit" disabled={!canSubmit || saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
            {saving ? "Saving..." : "Get Started"}
          </button>
        </form>

        <p className="onboard-footer">
          You'll be able to create workspaces and configure capabilities next.
        </p>
      </div>
    </div>
  );
}
