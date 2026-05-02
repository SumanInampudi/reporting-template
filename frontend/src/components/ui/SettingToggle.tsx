interface SettingToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export default function SettingToggle({ checked, onChange }: SettingToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`stg-toggle${checked ? " stg-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="stg-toggle-thumb" />
    </button>
  );
}
