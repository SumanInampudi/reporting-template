import { useEffect, useMemo, useRef } from "react";
import { Database, Palette, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import DataSourceTab from "./sidebar/DataSourceTab";
import DesignTab from "./sidebar/DesignTab";
import PresetBar from "./presets/PresetBar";
import { useStore } from "@/hooks/useStore";
import type { SelfServiceFeature } from "@/types/dashboard";

export default function Sidebar() {
  const { activeTab, sidebarTab, setSidebarTab, sidebarCollapsed, toggleSidebar, activeWorkspace } = useStore();
  const prevActiveTab = useRef(activeTab);

  useEffect(() => {
    if (prevActiveTab.current !== activeTab) {
      prevActiveTab.current = activeTab;
      setSidebarTab(activeTab === "dashboard" ? "design" : "datasource");
    }
  }, [activeTab, setSidebarTab]);

  const showPresets = useMemo(() => {
    const raw = activeWorkspace?.features ?? [];
    return new Set(raw as SelfServiceFeature[]).has("presets");
  }, [activeWorkspace]);

  return (
    <aside className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}>
      {sidebarCollapsed ? (
        <div className="sidebar-collapsed-rail">
          <button className="sidebar-rail-btn" onClick={toggleSidebar} title="Expand sidebar">
            <PanelLeftOpen size={16} />
          </button>
          <button
            className={`sidebar-rail-btn ${sidebarTab === "datasource" ? "sidebar-rail-btn--active" : ""}`}
            onClick={() => { setSidebarTab("datasource"); if (sidebarCollapsed) toggleSidebar(); }}
            title="Data Source"
          >
            <Database size={16} />
          </button>
          <button
            className={`sidebar-rail-btn ${sidebarTab === "design" ? "sidebar-rail-btn--active" : ""}`}
            onClick={() => { setSidebarTab("design"); if (sidebarCollapsed) toggleSidebar(); }}
            title="Design"
          >
            <Palette size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === "datasource" ? "active" : ""}`}
              onClick={() => setSidebarTab("datasource")}
            >
              <Database size={14} /> Data Source
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "design" ? "active" : ""}`}
              onClick={() => setSidebarTab("design")}
            >
              <Palette size={14} /> Design
            </button>
            <button className="sidebar-collapse-btn" onClick={toggleSidebar} title="Collapse sidebar">
              <PanelLeftClose size={14} />
            </button>
          </div>

          {sidebarTab === "datasource" ? (
            <DataSourceTab showPresets={showPresets} />
          ) : (
            <DesignTab />
          )}
        </>
      )}
    </aside>
  );
}
