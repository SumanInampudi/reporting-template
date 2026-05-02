import { Database, BarChart3, Brain, Trash2, Play, Pencil, Loader2 } from "lucide-react";
import type { Workspace, Capability } from "@/types/dashboard";

const CAP_META: Record<Capability, { label: string; icon: typeof Database }> = {
  self_service: { label: "Data & Filters", icon: Database },
  dashboarding: { label: "Dashboard", icon: BarChart3 },
  ai_insights: { label: "AI Insights", icon: Brain },
};

function buildConnTooltip(ws: Workspace): string {
  const parts: string[] = [];
  if (ws.datasource?.catalog) parts.push(`Catalog: ${ws.datasource.catalog}`);
  if (ws.datasource?.schema) parts.push(`Schema: ${ws.datasource.schema}`);
  if (ws.datasource?.default_table) parts.push(`Table: ${ws.datasource.default_table}`);
  return parts.length > 0 ? parts.join("\n") : "No connection configured";
}

interface Props {
  ws: Workspace;
  onLaunch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  disabled?: boolean;
}

export default function WorkspaceCard({ ws, onLaunch, onEdit, onDelete, isAdmin, disabled }: Props) {
  const caps = (ws.capabilities ?? []) as Capability[];
  const description = ws.description || "No description";
  const tooltip = buildConnTooltip(ws);

  return (
    <div className="ws-card" title={tooltip}>
      <div className="ws-card-top">
        <div className="ws-card-icon"><BarChart3 size={22} /></div>
        {isAdmin && (
          <button
            className="ws-card-delete"
            title="Delete workspace"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={disabled}
          >
            {disabled ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
          </button>
        )}
      </div>

      <div className="ws-card-body">
        <h3 className="ws-card-name">{ws.name}</h3>
        {ws.datasource?.default_table && (
          <p className="ws-card-table">
            <Database size={10} /> {ws.datasource.default_table}
          </p>
        )}
        <p className="ws-card-desc">{description}</p>
        <div className="ws-card-caps">
          {caps.map((c) => {
            const meta = CAP_META[c];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <span key={c} className="ws-card-cap">
                <Icon size={10} /> {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="ws-card-actions">
        <button className="ws-card-action-btn ws-card-action-btn--launch" onClick={onLaunch} disabled={disabled}>
          <Play size={12} /> Launch
        </button>
        {isAdmin && (
          <button className="ws-card-action-btn ws-card-action-btn--edit" onClick={onEdit} disabled={disabled}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
    </div>
  );
}
