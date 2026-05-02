interface SettingSelectProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}

export default function SettingSelect<T extends string>({
  value,
  options,
  onChange,
}: SettingSelectProps<T>) {
  return (
    <select
      className="stg-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
