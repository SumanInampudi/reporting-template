import { useState, useEffect } from "react";
import { X, Palette, BarChart3, LineChart, Database, Layers, GripHorizontal } from "lucide-react";
import type { ChartBinding, ChartSettings, ChartType } from "@/types/dashboard";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import AppearanceSection from "./AppearanceSection";
import AxisSection from "./AxisSection";
import SeriesSection from "./SeriesSection";
import DataSection from "./DataSection";
import BindingSection from "./BindingSection";

type SettingsTab = "binding" | "appearance" | "axes" | "series" | "data";

const TABS: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "binding", label: "Data Binding", icon: Layers },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "axes", label: "Axes & Labels", icon: BarChart3 },
  { id: "series", label: "Series Style", icon: LineChart },
  { id: "data", label: "Data", icon: Database },
];

interface Props {
  settings: ChartSettings;
  chartType: ChartType;
  binding: ChartBinding;
  availableColumns: { name: string; dataType: string }[];
  onChange: (patch: Partial<ChartSettings>) => void;
  onBindingChange: (binding: ChartBinding) => void;
  onRequery: () => void;
  onClose: () => void;
}

export default function SettingsPanel({
  settings, chartType, binding, availableColumns,
  onChange, onBindingChange, onRequery, onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("binding");
  const { offset, handleMouseDown } = useDraggableModal();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="stg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="stg-modal"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div className="stg-modal-header" onMouseDown={handleMouseDown}>
          <GripHorizontal size={14} className="stg-drag-hint" />
          <span className="stg-modal-title">Chart Settings</span>
          <button className="stg-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="stg-modal-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`stg-modal-tab${activeTab === id ? " stg-modal-tab--active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <div className="stg-modal-body">
          {activeTab === "binding" && (
            <BindingSection
              binding={binding}
              availableColumns={availableColumns}
              onChange={onBindingChange}
            />
          )}
          {activeTab === "appearance" && <AppearanceSection settings={settings} onChange={onChange} />}
          {activeTab === "axes" && <AxisSection settings={settings} chartType={chartType} onChange={onChange} />}
          {activeTab === "series" && <SeriesSection settings={settings} chartType={chartType} onChange={onChange} />}
          {activeTab === "data" && <DataSection settings={settings} onChange={onChange} onRequery={onRequery} />}
        </div>

        <div className="stg-modal-footer">
          <button className="stg-modal-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
