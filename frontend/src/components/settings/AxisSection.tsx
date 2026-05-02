import type { ChartSettings, ChartType } from "@/types/dashboard";
import { NUMBER_FORMAT_OPTIONS } from "@/lib/constants";
import SettingRow from "@/components/ui/SettingRow";
import SettingSelect from "@/components/ui/SettingSelect";
import SettingToggle from "@/components/ui/SettingToggle";

interface Props {
  settings: ChartSettings;
  chartType: ChartType;
  onChange: (patch: Partial<ChartSettings>) => void;
}

const ROTATION_OPTIONS = [
  { value: "0", label: "0°" },
  { value: "30", label: "30°" },
  { value: "45", label: "45°" },
  { value: "60", label: "60°" },
  { value: "90", label: "90°" },
] as const;

export default function AxisSection({ settings, chartType, onChange }: Props) {
  if (chartType === "pie") return null;

  return (
    <div className="stg-section">
      <h4 className="stg-section-title">Axes &amp; Labels</h4>

      <SettingRow label="Show X Axis" inline>
        <SettingToggle
          checked={settings.showXAxis}
          onChange={(showXAxis) => onChange({ showXAxis })}
        />
      </SettingRow>

      {settings.showXAxis && (
        <SettingRow label="X Label Rotation">
          <SettingSelect
            value={String(settings.xLabelRotation) as typeof ROTATION_OPTIONS[number]["value"]}
            options={ROTATION_OPTIONS}
            onChange={(v) => onChange({ xLabelRotation: Number(v) })}
          />
        </SettingRow>
      )}

      <SettingRow label="Show Y Axis" inline>
        <SettingToggle
          checked={settings.showYAxis}
          onChange={(showYAxis) => onChange({ showYAxis })}
        />
      </SettingRow>

      <SettingRow label="Number Format">
        <SettingSelect
          value={settings.numberFormat}
          options={NUMBER_FORMAT_OPTIONS}
          onChange={(numberFormat) => onChange({ numberFormat })}
        />
      </SettingRow>

      <SettingRow label="Y Min">
        <input
          type="number"
          className="stg-input"
          placeholder="Auto"
          value={settings.yAxisMin ?? ""}
          onChange={(e) =>
            onChange({ yAxisMin: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </SettingRow>

      <SettingRow label="Y Max">
        <input
          type="number"
          className="stg-input"
          placeholder="Auto"
          value={settings.yAxisMax ?? ""}
          onChange={(e) =>
            onChange({ yAxisMax: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </SettingRow>
    </div>
  );
}
