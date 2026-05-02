import { useState } from "react";
import { Wifi, WifiOff, Loader2, RefreshCw } from "lucide-react";
import ThemePicker from "@/components/ui/ThemePicker";
import UserAvatar from "@/components/ui/UserAvatar";
import { useStore } from "@/hooks/useStore";
import { useConnectionHealth } from "@/hooks/useConnectionHealth";

function HealthBadge() {
  const { status, message, latencyMs, recheck } = useConnectionHealth();
  const [showTooltip, setShowTooltip] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const handleRecheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRechecking(true);
    await recheck();
    setRechecking(false);
  };

  const color =
    status === "connected" ? "var(--health-green, #22c55e)" :
    status === "disconnected" ? "var(--health-red, #ef4444)" :
    "var(--health-yellow, #eab308)";

  const label =
    status === "connected" ? "Connected" :
    status === "disconnected" ? "Disconnected" :
    "Checking…";

  return (
    <div
      className="health-badge"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="health-dot-wrap">
        {status === "checking" ? (
          <Loader2 size={14} className="health-spinner" style={{ color }} />
        ) : status === "connected" ? (
          <Wifi size={14} style={{ color }} />
        ) : (
          <WifiOff size={14} style={{ color }} />
        )}
        <span
          className="health-dot"
          style={{ background: color }}
        />
      </div>

      {showTooltip && (
        <div className="health-tooltip">
          <div className="health-tooltip-row">
            <span className="health-tooltip-label">Status</span>
            <span style={{ color, fontWeight: 600 }}>{label}</span>
          </div>
          {latencyMs != null && (
            <div className="health-tooltip-row">
              <span className="health-tooltip-label">Latency</span>
              <span>{latencyMs}ms</span>
            </div>
          )}
          {message && (
            <div className="health-tooltip-row">
              <span className="health-tooltip-label">Detail</span>
              <span className="health-tooltip-detail">{message}</span>
            </div>
          )}
          <button className="health-recheck" onClick={handleRecheck} disabled={rechecking}>
            <RefreshCw size={11} className={rechecking ? "health-spinner" : ""} />
            {rechecking ? "Checking…" : "Re-check"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppHeader({ children }: { children?: React.ReactNode }) {
  const { currentUser, teamName } = useStore();

  return (
    <header className="app-header">
      <div className="app-header-left">
        <img src="/brand-logo.png" alt="Brand" className="app-header-logo" />
        <div className="app-header-title">
          <span className="app-header-brand">{teamName}</span>
        </div>
        {children}
      </div>
      <div className="app-header-right">
        <HealthBadge />
        <ThemePicker />
        {currentUser && <UserAvatar user={currentUser} showName size="sm" />}
      </div>
    </header>
  );
}
