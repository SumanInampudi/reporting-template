import type { ChartSettings, ChartType, PaletteKey } from "@/types/dashboard";

export const CHART_OPTIONS: { type: ChartType; label: string }[] = [
  { type: "bar", label: "Bar" },
  { type: "line", label: "Line" },
  { type: "area", label: "Area" },
  { type: "pie", label: "Pie" },
  { type: "scatter", label: "Scatter" },
  { type: "heatmap", label: "Heatmap" },
  { type: "radar", label: "Radar" },
  { type: "funnel", label: "Funnel" },
  { type: "treemap", label: "Treemap" },
  { type: "gauge", label: "Gauge" },
  { type: "table", label: "Table" },
];

export const COLOR_PALETTES: Record<PaletteKey, string[]> = {
  default:     ["#4f7df9", "#34d399", "#fbbf24", "#f94f6d", "#a78bfa", "#fb923c", "#38bdf8", "#f472b6", "#22d3ee", "#84cc16"],
  pastel:      ["#93b5ff", "#86efcb", "#fde68a", "#fda4af", "#c4b5fd", "#fdba74", "#7dd3fc", "#f9a8d4", "#67e8f9", "#bef264"],
  bold:        ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#ea580c", "#0284c7", "#db2777", "#0891b2", "#65a30d"],
  earth:       ["#92400e", "#4d7c0f", "#b45309", "#78716c", "#a16207", "#166534", "#854d0e", "#365314", "#713f12", "#3f6212"],
  monochrome:  ["#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0", "#f1f5f9", "#3b82f6", "#60a5fa"],
  ocean:       ["#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#22d3ee", "#2dd4bf", "#34d399", "#38bdf8", "#67e8f9", "#5eead4"],
};

export const CHART_COLORS = COLOR_PALETTES.default;

export const GRADIENT_FILLS = [
  [{ offset: 0, color: "rgba(79,125,249,0.5)" }, { offset: 1, color: "rgba(79,125,249,0.02)" }],
  [{ offset: 0, color: "rgba(52,211,153,0.5)" }, { offset: 1, color: "rgba(52,211,153,0.02)" }],
  [{ offset: 0, color: "rgba(251,191,36,0.5)" }, { offset: 1, color: "rgba(251,191,36,0.02)" }],
  [{ offset: 0, color: "rgba(249,79,109,0.5)" }, { offset: 1, color: "rgba(249,79,109,0.02)" }],
];

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  default: "Default", pastel: "Pastel", bold: "Bold",
  earth: "Earth", monochrome: "Mono", ocean: "Ocean",
};

export const AGGREGATION_OPTIONS = [
  { value: "SUM", label: "Sum" },
  { value: "AVG", label: "Average" },
  { value: "COUNT", label: "Count" },
  { value: "MIN", label: "Min" },
  { value: "MAX", label: "Max" },
  { value: "NONE", label: "None (raw)" },
] as const;

export const SORT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "x-asc", label: "X ascending" },
  { value: "x-desc", label: "X descending" },
  { value: "y-asc", label: "Y ascending" },
  { value: "y-desc", label: "Y descending" },
] as const;

export const NUMBER_FORMAT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "compact", label: "Compact (1K, 1M)" },
  { value: "comma", label: "Comma (1,000)" },
  { value: "percent", label: "Percent (%)" },
] as const;

export const LEGEND_POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "hidden", label: "Hidden" },
] as const;

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  palette: "default",
  showLegend: true,
  legendPosition: "bottom",
  showDataLabels: false,
  xLabelRotation: 0,
  showXAxis: true,
  showYAxis: true,
  numberFormat: "default",
  stacked: false,
  smooth: true,
  showSymbols: true,
  barBorderRadius: 4,
  pieInnerRadius: 40,
  aggregation: "SUM",
  sortOrder: "none",
  rowLimit: 10000,
  enableDataZoom: false,
};

export const NUMERIC_RE = /int|float|double|decimal|number|bigint|long|short/i;
export const DATE_RE = /date|time|timestamp/i;
