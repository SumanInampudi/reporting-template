import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  closestCenter, rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startWorkspaceTour, startDataTabTour, startDashboardTour } from "@/lib/tours";
import { Database, BarChart3, Brain, ArrowLeft, Maximize2, Minimize2, PanelLeftOpen, PanelLeftClose, HelpCircle } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import DataTab from "@/components/data/DataTab";
import Canvas from "@/components/Canvas";
import AiInsightsPanel from "@/components/ai/AiInsightsPanel";
import ChatBubble from "@/components/ai/ChatBubble";
import HelpDrawer from "@/components/ui/HelpDrawer";
import PresetBar from "@/components/presets/PresetBar";
import StatusBar from "@/components/ui/StatusBar";
import UnsavedChangesDialog from "@/components/ui/UnsavedChangesDialog";
import { useStore } from "@/hooks/useStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";
import { updatePreset, fetchPresets } from "@/lib/api";
import { buildPresetSql } from "@/lib/presetSqlHelper";
import { isNumericType } from "@/lib/kpiUtils";
import type { AppTab, Capability, ChartType } from "@/types/dashboard";

const TAB_REGISTRY: Record<Capability, { tabKey: AppTab; label: string; icon: typeof Database; component: React.FC }> = {
  self_service: { tabKey: "data", label: "Data Explorer", icon: Database, component: DataTab },
  dashboarding: { tabKey: "dashboard", label: "Dashboard", icon: BarChart3, component: Canvas },
  ai_insights: { tabKey: "ai_insights", label: "AI Assistant", icon: Brain, component: AiInsightsPanel },
};

// To re-enable the AI Assistant tab, add "ai_insights" back to this array:
const TAB_ORDER: Capability[] = ["self_service", "dashboarding"];

const ALL_THEME_PROPS = [
  "--bg-app", "--bg-sidebar", "--bg-card", "--bg-card-hover", "--bg-input",
  "--border", "--border-focus",
  "--text-primary", "--text-secondary", "--text-muted",
  "--accent", "--accent-hover", "--accent-subtle",
  "--danger", "--success", "--warning",
  "--radius", "--shadow",
] as const;

function FocusSidebar() {
  const [expanded, setExpanded] = useState(false);
  return (
    <aside className={`focus-sidebar${expanded ? " focus-sidebar--open" : ""}`}>
      <button
        className="focus-sidebar-toggle"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Collapse panel" : "Expand panel"}
      >
        {expanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>
      {expanded && (
        <div className="focus-sidebar-content">
          <Sidebar />
        </div>
      )}
    </aside>
  );
}

export default function WorkspaceApp() {
  const {
    addWidget, updateWidget, addFilter, addKpiCard, reorderWidgets, reorderKpiCards, widgets,
    activeTab, setActiveTab,
    activeWorkspace, closeWorkspace, themeConfig,
    isDirty, activePresetId, captureSnapshot, setLastSavedSnapshot, setPresets,
    focusMode, toggleFocusMode,
    activateOptionalDim,
    sidebarCollapsed,
  } = useStore();
  useKeyboardShortcuts();

  const [activeDrag, setActiveDrag] = useState<{ type: string; payload: string } | null>(null);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Browser tab close guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F11" || (e.ctrlKey && e.shiftKey && e.key === "F")) {
        e.preventDefault();
        toggleFocusMode();
      }
      if (e.key === "Escape" && focusMode) {
        toggleFocusMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusMode, toggleFocusMode]);

  useEffect(() => {
    const timer = setTimeout(() => startWorkspaceTour(), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "data") startDataTabTour();
      else if (activeTab === "dashboard") startDashboardTour();
    }, 500);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleCloseWorkspace = useCallback(() => {
    if (isDirty()) {
      setShowUnsaved(true);
    } else {
      closeWorkspace();
    }
  }, [isDirty, closeWorkspace]);

  const handleUnsavedSave = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    const presetId = activePresetId;
    if (!wsId || !presetId) {
      closeWorkspace();
      return;
    }
    setUnsavedSaving(true);
    try {
      const snapshot = captureSnapshot();
      const dataSql = buildPresetSql();
      await updatePreset(wsId, presetId, { snapshot, data_sql: dataSql });
      const list = await fetchPresets(wsId);
      setPresets(list);
      setLastSavedSnapshot(snapshot);
    } catch { /* continue to close even if save fails */ }
    setUnsavedSaving(false);
    setShowUnsaved(false);
    closeWorkspace();
  }, [activeWorkspace, activePresetId, captureSnapshot, setPresets, setLastSavedSnapshot, closeWorkspace]);

  const handleUnsavedDiscard = useCallback(() => {
    setShowUnsaved(false);
    closeWorkspace();
  }, [closeWorkspace]);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeType = args.active.data.current?.type;
    if (activeType === "widget-sort" || activeType === "kpi-sort") {
      const sortableCollisions = closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.data.current?.type === activeType,
        ),
      });
      if (sortableCollisions.length > 0) return sortableCollisions;
    }
    return rectIntersection(args);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.setAttribute("data-theme", themeConfig.colorScheme);
    if (themeConfig.colorScheme === "custom" && themeConfig.customColors) {
      const cc = themeConfig.customColors;
      ALL_THEME_PROPS.forEach((p) => {
        const key = p.replace("--", "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        const val = (cc as unknown as Record<string, string>)[key];
        if (val) el.style.setProperty(p, val);
        else el.style.removeProperty(p);
      });
    } else {
      ALL_THEME_PROPS.forEach((p) => el.style.removeProperty(p));
    }
  }, [themeConfig]);

  const enabledTabs = useMemo(() => {
    const caps = new Set((activeWorkspace?.capabilities ?? ["self_service", "dashboarding"]) as Capability[]);
    return TAB_ORDER
      .filter((c) => caps.has(c) && TAB_REGISTRY[c])
      .map((c) => ({ key: c, ...TAB_REGISTRY[c] }));
  }, [activeWorkspace]);

  const showSidebar = activeTab !== "ai_insights";
  const { width: sidebarWidth, onMouseDown: onResizeStart } = useResizableSidebar();

  const showPresets = useMemo(() => {
    const raw = activeWorkspace?.features ?? [];
    return new Set(raw as string[]).has("presets");
  }, [activeWorkspace]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data) setActiveDrag({ type: data.type, payload: data.payload });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || !active.data.current) return;

    const dragData = active.data.current;
    const dropData = over.data.current;

    const isGridSlot = dropData?.type === "grid-slot";
    const isCanvasDrop = over.id === "canvas-drop";
    const isFilterBar = over.id === "filter-bar-drop";
    const isKpiStrip = over.id === "kpi-strip-drop";

    if (dragData.type === "column" && isKpiStrip) {
      const dataType = (dragData.dataType as string) ?? "";
      const effectiveTbl = useStore.getState().effectiveTableRef() ?? (dragData.table as string) ?? "";
      addKpiCard(
        dragData.payload as string,
        effectiveTbl,
        isNumericType(dataType) ? "SUM" : "COUNT_DISTINCT",
      );
      return;
    }

    if (dragData.type === "column" && isFilterBar) {
      const effectiveTbl = useStore.getState().effectiveTableRef() ?? (dragData.table as string) ?? "";
      addFilter(
        dragData.payload as string,
        effectiveTbl,
        (dragData.dataType as string) ?? "",
      );
      return;
    }

    if (dragData.type === "dimension-source" && isFilterBar) {
      activateOptionalDim(dragData.dimSourceId as string);
      return;
    }

    if (dragData.type === "widget-sort" && over.id !== active.id) {
      reorderWidgets(active.id as string, over.id as string);
      return;
    }

    if (dragData.type === "kpi-sort" && over.id !== active.id) {
      reorderKpiCards(active.id as string, over.id as string);
      return;
    }

    if (dragData.type === "chart-type" && (isGridSlot || isCanvasDrop)) {
      addWidget(dragData.payload as ChartType);
    }

    if (dragData.type === "column" && dropData?.widgetId) {
      const widgetId = dropData.widgetId as string;
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;

      const column = dragData.payload as string;
      const dataType = (dragData.dataType as string) ?? "";
      const binding = { ...widget.binding };

      if (!isNumericType(dataType)) {
        if (binding.xColumns.length === 0) {
          binding.xColumns = [column];
        } else if (!binding.xColumns.includes(column) && !binding.groupBy.includes(column)) {
          binding.groupBy = [...binding.groupBy, column];
        }
      } else if (!binding.yColumns.includes(column)) {
        binding.yColumns = [...binding.yColumns, column];
      }

      updateWidget(widgetId, {
        binding,
        tableName: (dragData.table as string) ?? widget.tableName,
      });
    }
  };

  return (
    <DndContext collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`app-root${focusMode ? " focus-mode" : ""}`} ref={rootRef}>
        {!focusMode && (
          <AppHeader>
            <button className="ws-back-btn" onClick={handleCloseWorkspace}>
              <ArrowLeft size={14} /> Home
            </button>
            {activeWorkspace && (
              <span className="ws-active-name">{activeWorkspace.name}</span>
            )}
            <button
              className="ws-help-btn"
              onClick={() => setShowHelp(true)}
              title="How to use this workspace"
            >
              <HelpCircle size={15} />
            </button>
          </AppHeader>
        )}
        <div className="app-layout">
          {showSidebar && !focusMode && (
            <div className="sidebar-resizable" style={sidebarCollapsed ? undefined : { width: sidebarWidth }}>
              <Sidebar />
              {!sidebarCollapsed && <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />}
            </div>
          )}
          {showSidebar && focusMode && <FocusSidebar />}
          <div className="app-main">
            {!focusMode && (
              <div className="main-tabs">
                {enabledTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      className={`main-tab ${activeTab === tab.tabKey ? "main-tab--active" : ""}`}
                      onClick={() => setActiveTab(tab.tabKey)}
                    >
                      <Icon size={14} /> {tab.label}
                    </button>
                  );
                })}
                <button
                  className="main-tab main-tab--focus"
                  onClick={toggleFocusMode}
                  title="Focus mode (F11)"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            )}

            {showPresets && !focusMode && <PresetBar />}

            {enabledTabs.map((tab) => {
              const Comp = tab.component;
              const isActive = activeTab === tab.tabKey;
              return (
                <div
                  key={tab.key}
                  className="app-tab-pane"
                  style={isActive ? undefined : { display: "none" }}
                >
                  <Comp />
                </div>
              );
            })}
          </div>
        </div>
        {!focusMode && <StatusBar />}

        {focusMode && (
          <button className="focus-exit-btn" onClick={toggleFocusMode} title="Exit focus mode (Esc)">
            <Minimize2 size={16} /> Exit Focus
          </button>
        )}

        <ChatBubble />

        {showHelp && (
          <HelpDrawer
            activeTab={activeTab}
            onClose={() => setShowHelp(false)}
            onTour={() => {
              if (activeTab === "data") startDataTabTour(true);
              else if (activeTab === "dashboard") startDashboardTour(true);
              else startWorkspaceTour(true);
            }}
          />
        )}
      </div>

      <DragOverlay>
        {activeDrag && (
          <div className="drag-overlay-chip">
            {activeDrag.type === "chart-type"
              ? `New ${activeDrag.payload} chart`
              : activeDrag.payload}
          </div>
        )}
      </DragOverlay>

      {showUnsaved && (
        <UnsavedChangesDialog
          onSave={handleUnsavedSave}
          onDiscard={handleUnsavedDiscard}
          onCancel={() => setShowUnsaved(false)}
          saving={unsavedSaving}
        />
      )}
    </DndContext>
  );
}
