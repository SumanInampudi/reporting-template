import { Check } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { AGG_OPTIONS, FMT_OPTIONS, isNumericType } from "@/lib/kpiUtils";
import type { Aggregation, KpiCard, ColumnMeta } from "@/types/dashboard";

interface Props {
  card: KpiCard;
  columns: ColumnMeta[];
  title: string;
  setTitle: (t: string) => void;
  onRefresh: () => void;
  onColumnReset: () => void;
}

export default function KpiCardEditor({ card, columns, title, setTitle, onRefresh, onColumnReset }: Props) {
  const { updateKpiCard } = useStore();

  return (
    <div className="kpi-ed-body">
      <label className="kpi-ed-label">Title</label>
      <input
        className="kpi-ed-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => updateKpiCard(card.id, { title })}
      />

      <label className="kpi-ed-label">Column</label>
      <select
        className="kpi-ed-select"
        value={card.column}
        onChange={(e) => {
          const col = e.target.value;
          const meta = columns.find((c) => c.col_name === col);
          const isNum = meta && isNumericType(meta.data_type);
          const newAgg: Aggregation = isNum ? "SUM" : "COUNT_DISTINCT";
          updateKpiCard(card.id, { column: col, aggregation: newAgg });
          onColumnReset();
        }}
      >
        {columns.map((c) => (
          <option key={c.col_name} value={c.col_name}>{c.col_name}</option>
        ))}
      </select>

      <label className="kpi-ed-label">Aggregation</label>
      <div className="kpi-ed-pills">
        {AGG_OPTIONS.map((a) => (
          <button
            key={a.id}
            className={`kpi-ed-pill${card.aggregation === a.id ? " kpi-ed-pill--active" : ""}`}
            onClick={() => {
              updateKpiCard(card.id, { aggregation: a.id });
              onColumnReset();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <label className="kpi-ed-label">Format</label>
      <div className="kpi-ed-pills">
        {FMT_OPTIONS.map((f) => (
          <button
            key={f.id}
            className={`kpi-ed-pill${card.format === f.id ? " kpi-ed-pill--active" : ""}`}
            onClick={() => updateKpiCard(card.id, { format: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="kpi-ed-row">
        <div>
          <label className="kpi-ed-label">Prefix</label>
          <input
            className="kpi-ed-input kpi-ed-input--sm"
            value={card.prefix ?? ""}
            placeholder="$"
            onChange={(e) => updateKpiCard(card.id, { prefix: e.target.value })}
          />
        </div>
        <div>
          <label className="kpi-ed-label">Suffix</label>
          <input
            className="kpi-ed-input kpi-ed-input--sm"
            value={card.suffix ?? ""}
            placeholder="%"
            onChange={(e) => updateKpiCard(card.id, { suffix: e.target.value })}
          />
        </div>
      </div>

      <button className="kpi-ed-refresh" onClick={onRefresh}>
        <Check size={12} /> Apply & Refresh
      </button>
    </div>
  );
}
