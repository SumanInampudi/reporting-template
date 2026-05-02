import type { ChartSettings } from "@/types/dashboard";
import { AGGREGATION_OPTIONS, SORT_OPTIONS } from "@/lib/constants";
import SettingRow from "@/components/ui/SettingRow";
import SettingSelect from "@/components/ui/SettingSelect";

interface Props {
  settings: ChartSettings;
  onChange: (patch: Partial<ChartSettings>) => void;
  onRequery: () => void;
}

export default function DataSection({ settings, onChange, onRequery }: Props) {
  const handleChange = (patch: Partial<ChartSettings>) => {
    onChange(patch);
    setTimeout(onRequery, 50);
  };

  return (
    <div className="stg-section">
      <h4 className="stg-section-title">Data</h4>

      <SettingRow label="Aggregation">
        <SettingSelect
          value={settings.aggregation}
          options={AGGREGATION_OPTIONS}
          onChange={(aggregation) => handleChange({ aggregation })}
        />
      </SettingRow>

      <SettingRow label="Sort">
        <SettingSelect
          value={settings.sortOrder}
          options={SORT_OPTIONS}
          onChange={(sortOrder) => handleChange({ sortOrder })}
        />
      </SettingRow>
    </div>
  );
}
