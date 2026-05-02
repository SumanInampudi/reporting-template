import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Database, BarChart3, Brain, Play, Pencil, Copy, Trash2, Pin, PinOff, Loader2, Check, X } from "lucide-react";
import type { Workspace, Capability } from "@/types/dashboard";

const CAP_META: Record<Capability, { label: string; icon: typeof Database; color: string }> = {
  self_service: { label: "Explorer", icon: Database, color: "#3b82f6" },
  dashboarding: { label: "Dashboard", icon: BarChart3, color: "#10b981" },
  ai_insights: { label: "AI", icon: Brain, color: "#a855f7" },
};

const FEATURE_LABELS: Record<string, string> = {
  download_data: "Download",
  export_excel: "Excel Export",
  custom_columns: "Calculated Fields",
  subscriptions: "Subscriptions",
  presets: "Presets",
  upload_data: "Upload Data",
  kpi_metrics: "KPIs",
  charts: "Charts",
  pivot_table: "Pivot Table",
  llm_connection: "LLM Chat",
  zenie_space: "Genie AI",
  root_cause_analysis: "Root Cause",
};

function getFeaturesForCap(ws: Workspace, cap: Capability): string[] {
  switch (cap) {
    case "self_service":
      return (ws.features ?? []).map((f) => FEATURE_LABELS[f] ?? f).filter(Boolean);
    case "dashboarding":
      return (ws.dashboard_features ?? []).map((f) => FEATURE_LABELS[f] ?? f).filter(Boolean);
    case "ai_insights":
      return (ws.ai_settings?.options ?? []).map((f) => FEATURE_LABELS[f] ?? f).filter(Boolean);
    default:
      return [];
  }
}

const TILE_COLORS = [
  "linear-gradient(135deg, #FA5400 0%, #ff7a33 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
  "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
  "linear-gradient(135deg, #a855f7 0%, #c084fc 100%)",
  "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)",
  "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
  "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
];

function lightenHex(hex: string, amount = 0.3): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, parseInt(h.substring(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(h.substring(2, 4), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(h.substring(4, 6), 16) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToGradient(hex: string): string {
  return `linear-gradient(135deg, ${hex} 0%, ${lightenHex(hex)} 100%)`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface Props {
  ws: Workspace;
  onLaunch: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  disabled?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  index?: number;
}

export default function WorkspaceCard({
  ws, onLaunch, onEdit, onClone, onDelete, isAdmin, disabled, pinned, onTogglePin, index = 0,
}: Props) {
  const caps = (ws.capabilities ?? []) as Capability[];
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
  const [arrowLeft, setArrowLeft] = useState<string>("50%");
  const popRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);

  const tileGradient = useMemo(() => {
    const custom = ws.settings?.accent_color;
    if (custom) return hexToGradient(custom);
    return TILE_COLORS[hashStr(ws.id || ws.name) % TILE_COLORS.length];
  }, [ws.id, ws.name, ws.settings?.accent_color]);
  const initials = useMemo(() => getInitials(ws.name), [ws.name]);
  const description = ws.description || "No description";

  const POPOVER_W = 310;
  const EDGE_PAD = 16;

  useEffect(() => {
    if (!open || !tileRef.current) return;
    const rect = tileRef.current.getBoundingClientRect();
    const tileCenterX = rect.left + rect.width / 2;
    const tileBottom = rect.bottom;

    let popLeft = tileCenterX - POPOVER_W / 2;
    if (popLeft < EDGE_PAD) popLeft = EDGE_PAD;
    if (popLeft + POPOVER_W > window.innerWidth - EDGE_PAD) popLeft = window.innerWidth - EDGE_PAD - POPOVER_W;

    setPopStyle({ position: "fixed", top: tileBottom + 12, left: popLeft });
    setArrowLeft(`${tileCenterX - popLeft}px`);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        tileRef.current && !tileRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const action = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <>
    <div className="lp-tile-wrap">
      {/* ── Tile ── */}
      <div
        ref={tileRef}
        className={`lp-tile${pinned ? " lp-tile--pinned" : ""}${open ? " lp-tile--active" : ""}`}
        style={{ animationDelay: `${index * 50}ms` }}
        onClick={() => setOpen(!open)}
      >
        <div className="lp-tile-icon" style={{ background: tileGradient }}>
          <span className="lp-tile-initials">{initials}</span>

          {caps.length > 0 && (
            <div className="lp-tile-dots">
              {caps.map((c) => (
                <span key={c} className="lp-tile-dot" style={{ background: CAP_META[c]?.color }} />
              ))}
            </div>
          )}

          {pinned && <span className="lp-tile-pin-badge" />}
        </div>

        <span className="lp-tile-label">{ws.name}</span>
      </div>

    </div>

      {/* ── Popover detail card (portalled to body) ── */}
      {open && createPortal(
        <div ref={popRef} className="lp-popover" style={popStyle}>
          <div className="lp-popover-arrow" style={{ left: arrowLeft }} />

          {/* Banner */}
          <div className="lp-popover-banner" style={{ background: tileGradient }}>
            <h3 className="lp-popover-name">{ws.name}</h3>
            <div className="lp-popover-banner-actions">
              {onTogglePin && (
                <button className="lp-popover-icon-btn" onClick={action(onTogglePin)} title={pinned ? "Unpin" : "Pin to Top"}>
                  {pinned ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
              )}
              <button className="lp-popover-icon-btn" onClick={() => setOpen(false)}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="lp-popover-body">
            {ws.datasource?.default_table && (
              <span className="lp-popover-table">
                <Database size={10} /> {ws.datasource.default_table}
              </span>
            )}
            <p className="lp-popover-desc">{description}</p>

            {caps.length > 0 && (
              <div className="lp-popover-caps">
                {caps.map((c, i) => {
                  const meta = CAP_META[c];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const features = getFeaturesForCap(ws, c);
                  return (
                    <div key={c} className="lp-popover-cap">
                      {i > 0 && <div className="lp-popover-cap-divider" />}
                      <div className="lp-popover-cap-header">
                        <Icon size={13} style={{ color: meta.color }} />
                        <span className="lp-popover-cap-label">{meta.label}</span>
                      </div>
                      {features.length > 0 && (
                        <ul className="lp-popover-cap-feats">
                          {features.map((f) => (
                            <li key={f}>
                              <Check size={9} className="lp-popover-check" style={{ color: meta.color }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="lp-popover-actions">
            <button className="lp-popover-btn lp-popover-btn--launch" onClick={action(onLaunch)} disabled={disabled}>
              {disabled ? <Loader2 size={12} className="spin" /> : <Play size={12} />} Launch
            </button>
            {isAdmin && (
              <>
                <button className="lp-popover-btn" onClick={action(onEdit)} disabled={disabled}>
                  <Pencil size={12} /> Edit
                </button>
                <button className="lp-popover-btn" onClick={action(onClone)} disabled={disabled}>
                  <Copy size={12} /> Clone
                </button>
                <button className="lp-popover-btn lp-popover-btn--danger" onClick={action(onDelete)} disabled={disabled}>
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
