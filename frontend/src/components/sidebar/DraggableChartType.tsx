import { useDraggable } from "@dnd-kit/core";
import {
  BarChart3, LineChart, PieChart, ScatterChart, AreaChart,
  Grid3X3, TableIcon, Radar, ArrowDownNarrowWide, TreePine, Gauge,
} from "lucide-react";
import type { ChartType } from "@/types/dashboard";

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  bar: <BarChart3 size={18} />,
  line: <LineChart size={18} />,
  area: <AreaChart size={18} />,
  pie: <PieChart size={18} />,
  scatter: <ScatterChart size={18} />,
  heatmap: <Grid3X3 size={18} />,
  radar: <Radar size={18} />,
  funnel: <ArrowDownNarrowWide size={18} />,
  treemap: <TreePine size={18} />,
  gauge: <Gauge size={18} />,
  table: <TableIcon size={18} />,
};

interface Props {
  type: ChartType;
  label: string;
}

export default function DraggableChartType({ type, label }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chart-type-${type}`,
    data: { type: "chart-type", payload: type },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`sidebar-chip ${isDragging ? "dragging" : ""}`}
    >
      {CHART_ICONS[type]}
      <span>{label}</span>
    </button>
  );
}
