import { useEffect, useState } from "react";
import { Database, Plus, Loader2, ChevronRight } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { fetchWorkspaces, deleteWorkspace } from "@/lib/api";
import HomeNav, { useNikeLight } from "@/components/ui/HomeNav";
import WorkspaceCard from "@/components/WorkspaceCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function HomePage() {
  const { setCurrentPage, openWorkspace, editWorkspace, setWorkspaces, workspaces, currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const nikeLight = useNikeLight();
  const isAdmin = !currentUser || currentUser.role === "admin";

  useEffect(() => {
    fetchWorkspaces()
      .then((ws) => setWorkspaces(ws))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setWorkspaces]);

  const requestDelete = (id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    setConfirmDelete({ id, name: ws?.name ?? "this workspace" });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setDeletingId(id);
    try {
      await deleteWorkspace(id);
      setWorkspaces(workspaces.filter((w) => w.id !== id));
    } catch { /* ignore */ }
    finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="home-page" data-theme={nikeLight ? "nike-light" : "nike"}>
      <HomeNav
        links={[
          { label: "Workspaces", active: true },
          { label: "Documentation" },
          { label: "Settings" },
        ]}
      />

      {/* ── Hero banner ── */}
      <div className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-hero-title">BI Excellence Suite</h1>
          <p className="home-hero-sub">Self-Service Analytics & Dashboarding Platform</p>
        </div>
        <div className="home-hero-version">v1.0</div>
      </div>

      {/* ── Content ── */}
      <div className="home-content">
        <div className="home-section-header">
          <h2 className="home-section-title">Your Workspaces</h2>
          {isAdmin && (
            <button className="home-create-btn" onClick={() => setCurrentPage("setup")}>
              <Plus size={14} /> New Workspace <ChevronRight size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="home-loading">
            <Loader2 size={24} className="spin" />
            <p>Loading workspaces...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="home-empty">
            <Database size={40} strokeWidth={1} />
            <p>No workspaces yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="ws-grid">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                ws={ws}
                onLaunch={() => openWorkspace(ws)}
                onEdit={() => editWorkspace(ws)}
                onDelete={() => requestDelete(ws.id)}
                isAdmin={isAdmin}
                disabled={deletingId === ws.id}
              />
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Workspace"
          message={`Are you sure you want to delete "${confirmDelete.name}"? All associated presets will also be removed. This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          loading={!!deletingId}
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
