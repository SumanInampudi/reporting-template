import { useEffect, useRef } from "react";
import { Database, Palette, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import DataSourceTab from "./sidebar/DataSourceTab";
import DesignTab from "./sidebar/DesignTab";
import { useStore } from "@/hooks/useStore";

export default function Sidebar() {
  const { activeTab, setActiveTab, sidebarTab, setSidebarTab, sidebarCollapsed, toggleSidebar } = useStore();
  const prevActiveTab = useRef(activeTab);

  useEffect(() => {
    if (prevActiveTab.current !== activeTab) {
      prevActiveTab.current = activeTab;
      setSidebarTab(activeTab === "dashboard" ? "design" : "datasource");
    }
  }, [activeTab, setSidebarTab]);

  const goToDataSource = () => {
    setSidebarTab("datasource");
    setActiveTab("data");
  };

  const goToDesign = () => {
    setSidebarTab("design");
    setActiveTab("dashboard");
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}>
      {sidebarCollapsed ? (
        <div className="sidebar-collapsed-rail">
          <button className="sidebar-rail-btn" onClick={toggleSidebar} title="Expand sidebar">
            <PanelLeftOpen size={16} />
          </button>
          <button
            className={`sidebar-rail-btn ${sidebarTab === "datasource" ? "sidebar-rail-btn--active" : ""}`}
            onClick={() => { goToDataSource(); if (sidebarCollapsed) toggleSidebar(); }}
            title="Data Source"
          >
            <Database size={16} />
          </button>
          <button
            className={`sidebar-rail-btn ${sidebarTab === "design" ? "sidebar-rail-btn--active" : ""}`}
            onClick={() => { goToDesign(); if (sidebarCollapsed) toggleSidebar(); }}
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
              onClick={goToDataSource}
            >
              <Database size={14} /> Data Source
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "design" ? "active" : ""}`}
              onClick={goToDesign}
            >
              <Palette size={14} /> Design
            </button>
            <button className="sidebar-collapse-btn" onClick={toggleSidebar} title="Collapse sidebar">
              <PanelLeftClose size={14} />
            </button>
          </div>

          {sidebarTab === "datasource" ? (
            <DataSourceTab />
          ) : (
            <DesignTab />
          )}
        </>
      )}
    </aside>
  );
}
