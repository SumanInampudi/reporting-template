import { useState, useRef, useEffect } from "react";
import {
  BarChart3, LineChart, AreaChart, PieChart,
  ScatterChart, Grid3X3, Table2, ChevronDown,
  Radar, ArrowDownNarrowWide, TreePine, Gauge,
} from "lucide-react";
import type { ChartType } from "@/types/dashboard";
import { CHART_OPTIONS } from "@/lib/constants";

const ICONS: Record<ChartType, React.ReactNode> = {
  bar: <BarChart3 size={12} />,
  line: <LineChart size={12} />,
  area: <AreaChart size={12} />,
  pie: <PieChart size={12} />,
  scatter: <ScatterChart size={12} />,
  heatmap: <Grid3X3 size={12} />,
  radar: <Radar size={12} />,
  funnel: <ArrowDownNarrowWide size={12} />,
  treemap: <TreePine size={12} />,
  gauge: <Gauge size={12} />,
  table: <Table2 size={12} />,
};

interface Props {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export default function ChartTypeSwitcher({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="cts-wrap" ref={ref}>
      <button
        className="cts-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Change chart type"
      >
        {ICONS[value]}
        <ChevronDown size={10} className={open ? "cts-chevron rotated" : "cts-chevron"} />
      </button>

      {open && (
        <div className="cts-dropdown">
          {CHART_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              className={`cts-option${opt.type === value ? " cts-option--active" : ""}`}
              onClick={() => { onChange(opt.type); setOpen(false); }}
            >
              {ICONS[opt.type]}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
