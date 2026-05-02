import { useEffect, useRef } from "react";
import {
  X, Database, BarChart3, Filter, Bookmark, Columns3,
  MousePointerClick, GripVertical, Keyboard, Save, Play, Lightbulb,
} from "lucide-react";
import type { AppTab } from "@/types/dashboard";

interface Props {
  activeTab: AppTab;
  onClose: () => void;
  onTour?: () => void;
}

interface HelpSection {
  icon: React.ElementType;
  title: string;
  items: string[];
}

const DATA_SECTIONS: HelpSection[] = [
  {
    icon: Database,
    title: "Column Browser (Sidebar)",
    items: [
      "The sidebar lists every column in your data source, grouped by table.",
      "Use the search bar at the top to quickly find a column by name.",
      "Drag a column onto the Filter Bar to create a filter on it.",
      "Drag a column onto the Output Columns area to include it in your query results.",
      "Double-click a column to toggle it in the output.",
    ],
  },
  {
    icon: Filter,
    title: "Filters",
    items: [
      "Drag columns from the sidebar onto the filter bar to add them.",
      "Click a filter chip to expand it and select values, date ranges, or numeric conditions.",
      "Multiple filters combine with AND logic — all conditions must match.",
      "After changing filters, click the green Apply button (or press Enter) to run the query.",
      "Filters persist across tab switches — they apply to both Data Explorer and Dashboard.",
    ],
  },
  {
    icon: Columns3,
    title: "Output Columns",
    items: [
      "These are the columns that appear in your query results table.",
      "Drag columns from the sidebar to add them, or use the column selector modal.",
      "Reorder columns by dragging the grip handle on each column chip.",
      "Click the × on a chip to remove that column from the output.",
      "Aggregations (SUM, AVG, etc.) are auto-applied based on admin configuration.",
    ],
  },
  {
    icon: Bookmark,
    title: "Presets",
    items: [
      "Presets save your entire view: filters, output columns, sort order, and chart layout.",
      "Click a preset tab to load it — your filters and columns will update automatically.",
      "Use Save As to create a new preset from your current state.",
      "Press Ctrl+S to quick-save changes to the active preset.",
      "Admins can set a workspace default preset (shield icon) that loads for everyone.",
      "You can set a personal default from the preset list — it overrides the workspace default.",
    ],
  },
  {
    icon: MousePointerClick,
    title: "Data Table",
    items: [
      "Click any column header to sort by that column (click again to reverse).",
      "The table shows a live preview — scroll down to see more rows.",
      "Use the download button in the toolbar to export results as CSV.",
      "Row count and query time are shown in the status bar at the bottom.",
    ],
  },
];

const DASHBOARD_SECTIONS: HelpSection[] = [
  {
    icon: BarChart3,
    title: "Adding Charts",
    items: [
      "Switch to the Design tab in the sidebar to see available chart types.",
      "Drag a chart type (bar, line, pie, etc.) onto the canvas to create a new widget.",
      "Each chart widget has drop zones — drag columns onto them to bind data.",
      "Click a chart to select it, then use the settings panel to customize it.",
    ],
  },
  {
    icon: GripVertical,
    title: "KPI Strip",
    items: [
      "The KPI strip sits at the top of the dashboard for at-a-glance metrics.",
      "Drag a numeric column from the sidebar onto the KPI strip to create a card.",
      "Each KPI card shows a single aggregated number (SUM, AVG, COUNT, etc.).",
      "Reorder KPI cards by dragging their handles.",
    ],
  },
  {
    icon: Columns3,
    title: "Chart Settings",
    items: [
      "Click a chart widget, then click the gear icon to open settings.",
      "Data Binding: assign X-axis, Y-axis, and group-by columns.",
      "Appearance: set title, colors, legend position, and gradient fills.",
      "Axes & Labels: customize axis labels, tick formatting, and grid lines.",
      "Series Style: control line thickness, bar widths, and point sizes.",
    ],
  },
  {
    icon: Filter,
    title: "Dashboard Filters",
    items: [
      "Filters from the Data Explorer tab carry over to the Dashboard.",
      "When you apply filters, all charts re-query with the new conditions.",
      "Charts can also have their own data overrides in the chart settings.",
    ],
  },
];

const SHORTCUT_LIST = [
  { keys: "Ctrl + S", action: "Save active preset" },
  { keys: "F11", action: "Toggle focus mode" },
  { keys: "Escape", action: "Exit focus mode / close panels" },
  { keys: "Enter", action: "Apply filters" },
];

export default function HelpDrawer({ activeTab, onClose, onTour }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const sections = activeTab === "dashboard" ? DASHBOARD_SECTIONS : DATA_SECTIONS;
  const title = activeTab === "dashboard" ? "Dashboard Guide" : "Data Explorer Guide";

  return (
    <div className="help-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="help-drawer" ref={ref}>
        <div className="help-drawer-header">
          <Lightbulb size={16} className="help-drawer-icon" />
          <span className="help-drawer-title">{title}</span>
          <button className="help-drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="help-drawer-body">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="help-drawer-section">
                <div className="help-drawer-section-header">
                  <Icon size={14} />
                  <span>{section.title}</span>
                </div>
                <ul className="help-drawer-list">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="help-drawer-section">
            <div className="help-drawer-section-header">
              <Keyboard size={14} />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="help-drawer-shortcuts">
              {SHORTCUT_LIST.map((s) => (
                <div key={s.keys} className="help-drawer-shortcut">
                  <kbd>{s.keys}</kbd>
                  <span>{s.action}</span>
                </div>
              ))}
            </div>
          </div>

          {onTour && (
            <button
              className="help-drawer-tour-btn"
              onClick={() => { onClose(); setTimeout(() => onTour(), 200); }}
            >
              <Play size={13} />
              Take the interactive guided tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
