import type { ChartSettings, ChartType } from "@/types/dashboard";
import AppearanceSection from "./AppearanceSection";
import AxisSection from "./AxisSection";
import SeriesSection from "./SeriesSection";
import DataSection from "./DataSection";

interface Props {
  settings: ChartSettings;
  chartType: ChartType;
  onChange: (patch: Partial<ChartSettings>) => void;
  onRequery: () => void;
}

export default function SettingsPanel({ settings, chartType, onChange, onRequery }: Props) {
  return (
    <div className="settings-panel">
      <AppearanceSection settings={settings} onChange={onChange} />
      <AxisSection settings={settings} chartType={chartType} onChange={onChange} />
      <SeriesSection settings={settings} chartType={chartType} onChange={onChange} />
      <DataSection settings={settings} onChange={onChange} onRequery={onRequery} />
    </div>
  );
}
