import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  closestCenter, rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, BarChart3, Brain, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import DataTab from "@/components/data/DataTab";
import Canvas from "@/components/Canvas";
import AiInsightsPanel from "@/components/ai/AiInsightsPanel";
// PresetBar is now rendered inside Sidebar
import StatusBar from "@/components/ui/StatusBar";
import UnsavedChangesDialog from "@/components/ui/UnsavedChangesDialog";
import { useStore } from "@/hooks/useStore";
import { updatePreset, fetchPresets } from "@/lib/api";
import { buildPresetSql } from "@/lib/presetSqlHelper";
import { isNumericType } from "@/lib/kpiUtils";
import type { AppTab, Capability, ChartType } from "@/types/dashboard";

const TAB_REGISTRY: Record<Capability, { tabKey: AppTab; label: string; icon: typeof Database; component: React.FC }> = {
  self_service: { tabKey: "data", label: "Data & Filters", icon: Database, component: DataTab },
  dashboarding: { tabKey: "dashboard", label: "Dashboard", icon: BarChart3, component: Canvas },
  ai_insights: { tabKey: "ai_insights", label: "AI Insights", icon: Brain, component: AiInsightsPanel },
};

const TAB_ORDER: Capability[] = ["self_service", "dashboarding", "ai_insights"];

const CUSTOM_PROPS = [
  "--bg-app", "--bg-sidebar", "--bg-card", "--bg-input",
  "--border", "--text-primary", "--text-secondary", "--text-muted", "--accent",
] as const;

export default function WorkspaceApp() {
  const {
    addWidget, updateWidget, addFilter, addKpiCard, reorderWidgets, reorderKpiCards, widgets,
    activeTab, setActiveTab,
    activeWorkspace, closeWorkspace, themeConfig,
    isDirty, activePresetId, captureSnapshot, setLastSavedSnapshot, setPresets,
    focusMode, toggleFocusMode,
  } = useStore();
  const [activeDrag, setActiveDrag] = useState<{ type: string; payload: string } | null>(null);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

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
    const el = mainRef.current;
    if (!el) return;
    el.setAttribute("data-theme", themeConfig.colorScheme);
    if (themeConfig.colorScheme === "custom" && themeConfig.customColors) {
      const cc = themeConfig.customColors;
      CUSTOM_PROPS.forEach((p) => {
        const key = p.replace("--", "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        el.style.setProperty(p, (cc as unknown as Record<string, string>)[key] ?? "");
      });
    } else {
      CUSTOM_PROPS.forEach((p) => el.style.removeProperty(p));
    }
  }, [themeConfig]);

  const enabledTabs = useMemo(() => {
    const caps = new Set((activeWorkspace?.capabilities ?? ["self_service", "dashboarding"]) as Capability[]);
    return TAB_ORDER
      .filter((c) => caps.has(c) && TAB_REGISTRY[c])
      .map((c) => ({ key: c, ...TAB_REGISTRY[c] }));
  }, [activeWorkspace]);

  const activeEntry = enabledTabs.find((t) => t.tabKey === activeTab) ?? enabledTabs[0];
  const ActiveComponent = activeEntry?.component ?? DataTab;
  const showSidebar = activeTab !== "ai_insights";

  // Presets feature check moved to Sidebar component

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
      addKpiCard(
        dragData.payload as string,
        (dragData.table as string) ?? "",
        isNumericType(dataType) ? "SUM" : "COUNT_DISTINCT",
      );
      return;
    }

    if (dragData.type === "column" && isFilterBar) {
      addFilter(
        dragData.payload as string,
        (dragData.table as string) ?? "",
        (dragData.dataType as string) ?? "",
      );
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
        if (!binding.xColumn) {
          binding.xColumn = column;
        } else if (column !== binding.xColumn) {
          binding.groupBy = column;
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
      <div className={`app-root${focusMode ? " focus-mode" : ""}`}>
        {!focusMode && (
          <AppHeader>
            <button className="ws-back-btn" onClick={handleCloseWorkspace}>
              <ArrowLeft size={14} /> Home
            </button>
            {activeWorkspace && (
              <span className="ws-active-name">{activeWorkspace.name}</span>
            )}
          </AppHeader>
        )}
        <div className="app-layout">
          {showSidebar && !focusMode && <Sidebar />}
          <div className="app-main" ref={mainRef}>
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

            <ActiveComponent />
          </div>
        </div>
        {!focusMode && <StatusBar />}

        {focusMode && (
          <button className="focus-exit-btn" onClick={toggleFocusMode} title="Exit focus mode (Esc)">
            <Minimize2 size={16} /> Exit Focus
          </button>
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
