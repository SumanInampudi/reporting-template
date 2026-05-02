interface SettingRowProps {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
}

export default function SettingRow({ label, children, inline = false }: SettingRowProps) {
  return (
    <div className={`stg-row${inline ? " stg-row--inline" : ""}`}>
      <label className="stg-label">{label}</label>
      <div className="stg-control">{children}</div>
    </div>
  );
}
