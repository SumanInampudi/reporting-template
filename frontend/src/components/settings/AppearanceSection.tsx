import type { ChartSettings } from "@/types/dashboard";
import { LEGEND_POSITION_OPTIONS } from "@/lib/constants";
import SettingRow from "@/components/ui/SettingRow";
import SettingSelect from "@/components/ui/SettingSelect";
import SettingToggle from "@/components/ui/SettingToggle";
import PalettePicker from "@/components/ui/PalettePicker";

interface Props {
  settings: ChartSettings;
  onChange: (patch: Partial<ChartSettings>) => void;
}

export default function AppearanceSection({ settings, onChange }: Props) {
  return (
    <div className="stg-section">
      <h4 className="stg-section-title">Appearance</h4>

      <SettingRow label="Color Palette">
        <PalettePicker
          value={settings.palette}
          onChange={(palette) => onChange({ palette })}
        />
      </SettingRow>

      <SettingRow label="Show Legend" inline>
        <SettingToggle
          checked={settings.showLegend}
          onChange={(showLegend) => onChange({ showLegend })}
        />
      </SettingRow>

      {settings.showLegend && (
        <SettingRow label="Legend Position">
          <SettingSelect
            value={settings.legendPosition}
            options={LEGEND_POSITION_OPTIONS}
            onChange={(legendPosition) => onChange({ legendPosition })}
          />
        </SettingRow>
      )}

      <SettingRow label="Data Labels" inline>
        <SettingToggle
          checked={settings.showDataLabels}
          onChange={(showDataLabels) => onChange({ showDataLabels })}
        />
      </SettingRow>
    </div>
  );
}
