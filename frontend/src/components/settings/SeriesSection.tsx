import type { ChartSettings, ChartType } from "@/types/dashboard";
import SettingRow from "@/components/ui/SettingRow";
import SettingToggle from "@/components/ui/SettingToggle";

interface Props {
  settings: ChartSettings;
  chartType: ChartType;
  onChange: (patch: Partial<ChartSettings>) => void;
}

export default function SeriesSection({ settings, chartType, onChange }: Props) {
  return (
    <div className="stg-section">
      <h4 className="stg-section-title">Series Style</h4>

      {(chartType === "line" || chartType === "area") && (
        <>
          <SettingRow label="Smooth Curves" inline>
            <SettingToggle
              checked={settings.smooth}
              onChange={(smooth) => onChange({ smooth })}
            />
          </SettingRow>

          <SettingRow label="Show Points" inline>
            <SettingToggle
              checked={settings.showSymbols}
              onChange={(showSymbols) => onChange({ showSymbols })}
            />
          </SettingRow>
        </>
      )}

      {chartType === "bar" && (
        <SettingRow label="Corner Radius">
          <input
            type="range"
            className="stg-range"
            min={0}
            max={12}
            step={1}
            value={settings.barBorderRadius}
            onChange={(e) => onChange({ barBorderRadius: Number(e.target.value) })}
          />
          <span className="stg-range-value">{settings.barBorderRadius}px</span>
        </SettingRow>
      )}

      {chartType === "pie" && (
        <SettingRow label="Inner Radius (donut)">
          <input
            type="range"
            className="stg-range"
            min={0}
            max={70}
            step={5}
            value={settings.pieInnerRadius}
            onChange={(e) => onChange({ pieInnerRadius: Number(e.target.value) })}
          />
          <span className="stg-range-value">{settings.pieInnerRadius}%</span>
        </SettingRow>
      )}

      {chartType !== "pie" && chartType !== "scatter" && (
        <SettingRow label="Stacked" inline>
          <SettingToggle
            checked={settings.stacked}
            onChange={(stacked) => onChange({ stacked })}
          />
        </SettingRow>
      )}

      {chartType !== "pie" && (
        <SettingRow label="Data Zoom" inline>
          <SettingToggle
            checked={settings.enableDataZoom}
            onChange={(enableDataZoom) => onChange({ enableDataZoom })}
          />
        </SettingRow>
      )}
    </div>
  );
}
