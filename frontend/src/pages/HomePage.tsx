import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Database, Search, SortAsc, Pin, X } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { toast } from "@/components/ui/Toast";
import { fetchWorkspaces, deleteWorkspace, createWorkspace } from "@/lib/api";
import HomeNav, { useNikeLight } from "@/components/ui/HomeNav";
import WorkspaceCard from "@/components/WorkspaceCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PlatformSettingsModal from "@/components/ui/PlatformSettingsModal";
import { startHomeTour, resetTour } from "@/lib/tours";
import type { Workspace, Capability } from "@/types/dashboard";

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "recent", label: "Recently Opened" },
] as const;
type SortKey = typeof SORT_OPTIONS[number]["value"];

const CAP_FILTERS: { cap: Capability; label: string }[] = [
  { cap: "self_service", label: "Explorer" },
  { cap: "dashboarding", label: "Dashboard" },
  { cap: "ai_insights", label: "AI" },
];

function getPinnedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("pinned-workspaces") || "[]"));
  } catch { return new Set(); }
}
function savePinnedIds(ids: Set<string>) {
  localStorage.setItem("pinned-workspaces", JSON.stringify([...ids]));
}
function getRecentOrder(): string[] {
  try {
    return JSON.parse(localStorage.getItem("recent-workspaces") || "[]");
  } catch { return []; }
}
function trackRecent(id: string) {
  const list = getRecentOrder().filter((x) => x !== id);
  list.unshift(id);
  localStorage.setItem("recent-workspaces", JSON.stringify(list.slice(0, 50)));
}

export default function HomePage() {
  const { setCurrentPage, openWorkspace, editWorkspace, setWorkspaces, workspaces, currentUser, teamName } = useStore();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const nikeLight = useNikeLight();
  const isAdmin = !currentUser || currentUser.role === "admin";

  const [search, setSearch] = useState("");
  const [capFilter, setCapFilter] = useState<Capability | null>(null);
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(getPinnedIds);
  const [showSettings, setShowSettings] = useState(false);

  const tourFired = useRef(false);

  useEffect(() => {
    fetchWorkspaces()
      .then((ws) => setWorkspaces(ws))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setWorkspaces]);

  useEffect(() => {
    if (!loading && workspaces.length > 0 && !tourFired.current) {
      tourFired.current = true;
      setTimeout(() => startHomeTour(), 600);
    }
  }, [loading, workspaces.length]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      savePinnedIds(next);
      return next;
    });
  }, []);

  const handleLaunch = useCallback((ws: Workspace) => {
    trackRecent(ws.id);
    openWorkspace(ws);
  }, [openWorkspace]);

  const filtered = useMemo(() => {
    let list = [...workspaces];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((w) =>
        w.name.toLowerCase().includes(q) ||
        (w.description ?? "").toLowerCase().includes(q) ||
        (w.datasource?.default_table ?? "").toLowerCase().includes(q)
      );
    }
    if (capFilter) {
      list = list.filter((w) => (w.capabilities ?? []).includes(capFilter));
    }
    const recentOrder = getRecentOrder();
    switch (sort) {
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "recent": {
        list.sort((a, b) => {
          const ai = recentOrder.indexOf(a.id);
          const bi = recentOrder.indexOf(b.id);
          if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        break;
      }
    }
    return list;
  }, [workspaces, search, capFilter, sort]);

  const pinned = useMemo(() => filtered.filter((w) => pinnedIds.has(w.id)), [filtered, pinnedIds]);
  const unpinned = useMemo(() => filtered.filter((w) => !pinnedIds.has(w.id)), [filtered, pinnedIds]);

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
    } catch { toast.error("Failed to delete workspace"); }
    finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleClone = async (ws: Workspace) => {
    setCloningId(ws.id);
    try {
      const cloned = await createWorkspace({
        name: `${ws.name} (Copy)`,
        description: ws.description || "",
        catalog: ws.datasource?.catalog ?? null,
        schema_name: ws.datasource?.schema ?? null,
        default_table: ws.datasource?.default_table ?? null,
        capabilities: ws.capabilities,
        features: ws.features,
        dashboard_features: ws.dashboard_features,
        ai_settings: ws.ai_settings as Record<string, unknown> | undefined,
        column_aliases: ws.column_aliases,
        column_type_overrides: ws.column_type_overrides,
        column_aggregations: ws.column_aggregations,
        excluded_columns: ws.excluded_columns,
        column_groups: ws.column_groups,
        dimension_sources: ws.dimension_sources,
        cascade_rules: ws.cascade_rules,
        abbreviations: ws.abbreviations,
        free_text_filter_columns: ws.free_text_filter_columns,
        theme: ws.settings?.theme ?? "nike",
        density: ws.settings?.density ?? "spacious",
        row_limit: ws.settings?.row_limit ?? 0,
      });
      setWorkspaces([...workspaces, cloned]);
      editWorkspace(cloned);
    } catch { toast.error("Failed to clone workspace"); }
    finally { setCloningId(null); }
  };

  const renderTile = (ws: Workspace, idx: number) => (
    <WorkspaceCard
      key={ws.id}
      ws={ws}
      index={idx}
      onLaunch={() => handleLaunch(ws)}
      onEdit={() => editWorkspace(ws)}
      onClone={() => handleClone(ws)}
      onDelete={() => requestDelete(ws.id)}
      isAdmin={isAdmin}
      disabled={deletingId === ws.id || cloningId === ws.id}
      pinned={pinnedIds.has(ws.id)}
      onTogglePin={() => togglePin(ws.id)}
    />
  );

  return (
    <div className="home-page" data-theme={nikeLight ? "nike-light" : "nike"}>
      <HomeNav
        links={[
          { label: "Workspaces", active: true },
          { label: "Documentation", onClick: () => setCurrentPage("docs") },
          ...(isAdmin ? [{ label: "Settings", onClick: () => setShowSettings(true) }] : []),
        ]}
        onNewWorkspace={() => setCurrentPage("setup")}
        onHelp={() => { resetTour("home"); startHomeTour(true); }}
        isAdmin={isAdmin}
      />

      <div className="home-content">
        {/* Toolbar: search + filters + sort */}
        {!loading && workspaces.length > 0 && (
          <div className="lp-toolbar">
            <div className="lp-search-wrap">
              <Search size={14} className="lp-search-icon" />
              <input
                className="lp-search"
                placeholder="Search workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="lp-search-clear" onClick={() => setSearch("")}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="lp-cap-filters">
              <button
                className={`lp-cap-chip${capFilter === null ? " lp-cap-chip--active" : ""}`}
                onClick={() => setCapFilter(null)}
              >
                All
              </button>
              {CAP_FILTERS.map(({ cap, label }) => (
                <button
                  key={cap}
                  className={`lp-cap-chip${capFilter === cap ? " lp-cap-chip--active" : ""}`}
                  onClick={() => setCapFilter(capFilter === cap ? null : cap)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="lp-sort-wrap">
              <SortAsc size={13} className="lp-sort-icon" />
              <select className="lp-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="lp-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="lp-tile-skeleton">
                <div className="skeleton lp-skel-icon" />
                <div className="skeleton lp-skel-label" />
              </div>
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="home-empty">
            <Database size={40} strokeWidth={1} />
            <p>No workspaces yet. Create one to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="home-empty">
            <Search size={32} strokeWidth={1} />
            <p>No workspaces match your search.</p>
          </div>
        ) : (
          <>
            {/* Pinned section */}
            {pinned.length > 0 && (
              <div className="lp-section">
                <div className="lp-section-label">
                  <Pin size={12} /> Pinned
                </div>
                <div className="lp-grid">
                  {pinned.map((ws, i) => renderTile(ws, i))}
                </div>
              </div>
            )}

            {/* All / remaining */}
            <div className="lp-section">
              {pinned.length > 0 && (
                <div className="lp-section-label">All Workspaces</div>
              )}
              <div className="lp-grid">
                {unpinned.map((ws, i) => renderTile(ws, pinned.length + i))}
              </div>
            </div>
          </>
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

      {showSettings && (
        <PlatformSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
