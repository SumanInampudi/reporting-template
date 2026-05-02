import type { Aggregation, ChartSettings, ColorScheme, DashboardWidget, FilterItem, NumberFormat, SortOrder } from "@/types/dashboard";
import { COLOR_PALETTES, GRADIENT_FILLS } from "./constants";

interface ChartThemeColors {
  textColor: string;
  borderColor: string;
  bgColor: string;
  tooltipText: string;
}

const THEME_COLORS: Record<string, ChartThemeColors> = {
  dark:       { textColor: "#a1a1aa", borderColor: "#27272a", bgColor: "#18181b", tooltipText: "#fafafa" },
  light:      { textColor: "#52525b", borderColor: "#e4e4e7", bgColor: "#ffffff", tooltipText: "#18181b" },
  nike:       { textColor: "#a3a3a3", borderColor: "#303030", bgColor: "#1c1c1c", tooltipText: "#fafafa" },
  midnight:   { textColor: "#94a3b8", borderColor: "#232e52", bgColor: "#161d35", tooltipText: "#e2e8f0" },
  slate:      { textColor: "#475569", borderColor: "#cbd5e1", bgColor: "#ffffff", tooltipText: "#0f172a" },
  minimal:    { textColor: "#525252", borderColor: "#e5e5e5", bgColor: "#ffffff", tooltipText: "#171717" },
  nord:       { textColor: "#d8dee9", borderColor: "#4c566a", bgColor: "#434c5e", tooltipText: "#eceff4" },
  corporate:  { textColor: "#a3a3a3", borderColor: "#333333", bgColor: "#212121", tooltipText: "#f5f5f5" },
  custom:     { textColor: "#a1a1aa", borderColor: "#27272a", bgColor: "#18181b", tooltipText: "#fafafa" },
};

export function getChartThemeColors(scheme: ColorScheme): ChartThemeColors {
  return THEME_COLORS[scheme] ?? THEME_COLORS.dark;
}

function numberFormatter(fmt: NumberFormat): ((v: number) => string) | undefined {
  if (fmt === "compact") {
    return (v: number) => {
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
      return String(v);
    };
  }
  if (fmt === "comma") return (v: number) => v.toLocaleString();
  if (fmt === "percent") return (v: number) => `${v.toFixed(1)}%`;
  return undefined;
}

/* ── GroupBy pivot helper ──────────────────────────── */

interface PivotResult {
  xValues: string[];
  seriesNames: string[];
  seriesData: Map<string, number[]>;
}

function pivotGroupBy(widget: DashboardWidget): PivotResult | null {
  const { data, binding } = widget;
  if (!data || !binding.xColumn || !binding.groupBy || binding.yColumns.length === 0) return null;

  const xIdx = data.columns.indexOf(binding.xColumn);
  const gIdx = data.columns.indexOf(binding.groupBy);
  const yIdx = data.columns.indexOf(binding.yColumns[0]);
  if (xIdx === -1 || gIdx === -1 || yIdx === -1) return null;

  const xSet = new Set<string>();
  const gSet = new Set<string>();
  const map = new Map<string, number>();

  for (const row of data.rows) {
    const x = String(row[xIdx] ?? "");
    const g = String(row[gIdx] ?? "");
    const v = Number(row[yIdx]) || 0;
    xSet.add(x);
    gSet.add(g);
    const key = `${x}\0${g}`;
    map.set(key, (map.get(key) ?? 0) + v);
  }

  const xValues = [...xSet];
  const seriesNames = [...gSet].slice(0, 20);
  const seriesData = new Map<string, number[]>();

  for (const g of seriesNames) {
    seriesData.set(g, xValues.map((x) => map.get(`${x}\0${g}`) ?? 0));
  }

  return { xValues, seriesNames, seriesData };
}

/* ── Main builder ──────────────────────────────────── */

export function buildEChartsOption(widget: DashboardWidget, colorScheme: ColorScheme) {
  const { chartType, binding, data, settings } = widget;
  if (!data || !binding.xColumn || binding.yColumns.length === 0) {
    if (chartType === "gauge" && data && binding.yColumns.length > 0) {
      return buildGaugeOption(widget, colorScheme);
    }
    return null;
  }

  if (chartType === "gauge") return buildGaugeOption(widget, colorScheme);
  if (chartType === "radar") return buildRadarOption(widget, colorScheme);
  if (chartType === "funnel") return buildFunnelOption(widget, colorScheme);
  if (chartType === "treemap") return buildTreemapOption(widget, colorScheme);

  const colors = COLOR_PALETTES[settings.palette] ?? COLOR_PALETTES.default;
  const { textColor, borderColor, bgColor, tooltipText } = getChartThemeColors(colorScheme);
  const yFmt = numberFormatter(settings.numberFormat);

  const pivot = binding.groupBy ? pivotGroupBy(widget) : null;

  const xIdx = data.columns.indexOf(binding.xColumn);
  const xData = pivot ? pivot.xValues : data.rows.map((r) => r[xIdx]);

  const buildSeriesForCol = (col: string, yData: number[], i: number, seriesName?: string) => {
    const color = colors[i % colors.length];
    const typeMap: Record<string, string> = {
      bar: "bar", line: "line", area: "line",
      scatter: "scatter", pie: "pie", heatmap: "heatmap",
    };

    const base: Record<string, unknown> = {
      name: seriesName ?? col,
      type: typeMap[chartType] ?? "bar",
      data: chartType === "pie"
        ? xData.map((x, j) => ({ name: String(x), value: yData[j] }))
        : yData,
      smooth: settings.smooth,
      itemStyle: { color },
      emphasis: { focus: "series" },
    };

    if (settings.stacked && chartType !== "pie" && chartType !== "scatter") {
      base.stack = "total";
    }

    if (settings.showDataLabels) {
      base.label = {
        show: true, fontSize: 10, color: textColor,
        formatter: yFmt ? (({ value }: { value: number }) => yFmt(value)) : undefined,
      };
    }

    if (chartType === "bar") {
      base.barMaxWidth = 40;
      base.itemStyle = { color, borderRadius: [settings.barBorderRadius, settings.barBorderRadius, 0, 0] };
    }

    if (chartType === "area" || chartType === "line") {
      base.lineStyle = { width: 2.5 };
      base.symbol = "circle";
      base.symbolSize = 6;
      base.showSymbol = settings.showSymbols;
    }

    if (chartType === "area") {
      const grad = GRADIENT_FILLS[i % GRADIENT_FILLS.length];
      base.areaStyle = { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: grad } };
    }

    if (chartType === "pie") {
      base.radius = [`${settings.pieInnerRadius}%`, "70%"];
      base.itemStyle = { borderRadius: 6, borderColor: bgColor, borderWidth: 2 };
      base.label = { show: settings.showDataLabels, color: textColor, fontSize: 11 };
    }

    if (chartType === "heatmap") {
      const heatData: [number, number, number][] = [];
      let min = Infinity, max = -Infinity;
      for (let j = 0; j < xData.length; j++) {
        heatData.push([j, i, yData[j]]);
        if (yData[j] < min) min = yData[j];
        if (yData[j] > max) max = yData[j];
      }
      base.data = heatData;
      base.itemStyle = { borderWidth: 1, borderColor };
      base.label = settings.showDataLabels
        ? { show: true, color: textColor, fontSize: 10, formatter: yFmt ? (({ value }: { value: number[] }) => yFmt(value[2])) : undefined }
        : { show: false };
      (base as Record<string, unknown>).__heatRange = { min, max };
    }

    return base;
  };

  let series: Record<string, unknown>[];

  if (pivot) {
    series = pivot.seriesNames.map((g, i) => {
      const yData = pivot.seriesData.get(g)!;
      return buildSeriesForCol(binding.yColumns[0], yData, i, g);
    });
  } else {
    series = binding.yColumns.map((col, i) => {
      const yIdx = data.columns.indexOf(col);
      const yData = data.rows.map((r) => Number(r[yIdx]) || 0);
      return buildSeriesForCol(col, yData, i);
    });
  }

  const option: Record<string, unknown> = {
    color: colors,
    tooltip: {
      trigger: chartType === "pie" ? "item" : "axis",
      backgroundColor: bgColor, borderColor,
      textStyle: { color: tooltipText, fontSize: 12 },
      borderWidth: 1,
    },
    grid: { top: 16, right: 16, bottom: settings.enableDataZoom ? 64 : 40, left: 16, containLabel: true },
    animationDuration: 600,
    animationEasing: "cubicOut",
    series,
  };

  if (settings.showLegend && settings.legendPosition !== "hidden") {
    const legendBase: Record<string, unknown> = {
      type: "scroll",
      textStyle: { color: textColor, fontSize: 11 },
      pageTextStyle: { color: textColor },
      pageIconColor: textColor,
    };
    if (settings.legendPosition === "top") legendBase.top = 4;
    else if (settings.legendPosition === "bottom") legendBase.bottom = 4;
    else if (settings.legendPosition === "left") { legendBase.left = 4; legendBase.orient = "vertical"; }
    else if (settings.legendPosition === "right") { legendBase.right = 4; legendBase.orient = "vertical"; }
    option.legend = legendBase;
  }

  if (chartType === "heatmap") {
    option.xAxis = {
      type: "category", data: xData,
      axisLabel: { rotate: settings.xLabelRotation, color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { show: false }, splitArea: { show: true },
    };
    option.yAxis = {
      type: "category", data: pivot ? pivot.seriesNames : binding.yColumns,
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { show: false }, splitArea: { show: true },
    };
    let hMin = 0, hMax = 1;
    for (const s of series) {
      const range = (s as Record<string, unknown>).__heatRange as { min: number; max: number } | undefined;
      if (range) { hMin = Math.min(hMin, range.min); hMax = Math.max(hMax, range.max); }
      delete (s as Record<string, unknown>).__heatRange;
    }
    option.visualMap = {
      min: hMin, max: hMax, calculable: true, orient: "horizontal",
      left: "center", bottom: 4,
      inRange: { color: ["#313695", "#4575b4", "#74add1", "#abd9e9", "#fee090", "#fdae61", "#f46d43", "#d73027"] },
      textStyle: { color: textColor },
    };
    option.grid = { top: 16, right: 16, bottom: 60, left: 16, containLabel: true };
  } else if (chartType !== "pie") {
    if (settings.showXAxis) {
      option.xAxis = {
        type: "category", data: xData,
        axisLabel: { rotate: settings.xLabelRotation, color: textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: borderColor } },
        axisTick: { show: false },
      };
    } else {
      option.xAxis = { type: "category", data: xData, show: false };
    }

    if (settings.showYAxis) {
      option.yAxis = {
        type: "value",
        min: settings.yAxisMin ?? undefined,
        max: settings.yAxisMax ?? undefined,
        axisLabel: { color: textColor, fontSize: 11, formatter: yFmt },
        splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
        axisLine: { show: false }, axisTick: { show: false },
      };
    } else {
      option.yAxis = { type: "value", show: false };
    }

    if (settings.enableDataZoom) {
      option.dataZoom = [
        { type: "slider", bottom: 8, height: 20, borderColor, textStyle: { color: textColor } },
        { type: "inside" },
      ];
    }
  }

  return option;
}

/* ── Radar chart ─────────────────────────────────── */

function buildRadarOption(widget: DashboardWidget, colorScheme: ColorScheme) {
  const { data, binding, settings } = widget;
  if (!data || !binding.xColumn || binding.yColumns.length === 0) return null;

  const colors = COLOR_PALETTES[settings.palette] ?? COLOR_PALETTES.default;
  const { textColor, bgColor, borderColor, tooltipText } = getChartThemeColors(colorScheme);

  const xIdx = data.columns.indexOf(binding.xColumn);
  const xLabels = data.rows.map((r) => String(r[xIdx] ?? ""));

  const indicators = xLabels.map((name) => ({ name }));

  const pivot = binding.groupBy ? pivotGroupBy(widget) : null;

  let seriesData: { name: string; value: number[] }[];
  if (pivot) {
    seriesData = pivot.seriesNames.map((g) => ({
      name: g,
      value: pivot.seriesData.get(g)!,
    }));
  } else {
    seriesData = binding.yColumns.map((col) => {
      const yIdx = data.columns.indexOf(col);
      return { name: col, value: data.rows.map((r) => Number(r[yIdx]) || 0) };
    });
  }

  return {
    color: colors,
    tooltip: { backgroundColor: bgColor, borderColor, textStyle: { color: tooltipText, fontSize: 12 }, borderWidth: 1 },
    legend: settings.showLegend ? { textStyle: { color: textColor, fontSize: 11 }, bottom: 4, type: "scroll" } : undefined,
    radar: {
      indicator: indicators,
      axisName: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: borderColor } },
      splitArea: { areaStyle: { color: ["transparent", "rgba(128,128,128,0.05)"] } },
      axisLine: { lineStyle: { color: borderColor } },
    },
    series: [{
      type: "radar",
      data: seriesData.map((d, i) => ({
        ...d,
        lineStyle: { color: colors[i % colors.length] },
        itemStyle: { color: colors[i % colors.length] },
        areaStyle: { color: colors[i % colors.length], opacity: 0.15 },
      })),
    }],
    animationDuration: 600,
  };
}

/* ── Funnel chart ────────────────────────────────── */

function buildFunnelOption(widget: DashboardWidget, colorScheme: ColorScheme) {
  const { data, binding, settings } = widget;
  if (!data || !binding.xColumn || binding.yColumns.length === 0) return null;

  const colors = COLOR_PALETTES[settings.palette] ?? COLOR_PALETTES.default;
  const { textColor, bgColor, borderColor, tooltipText } = getChartThemeColors(colorScheme);
  const yFmt = numberFormatter(settings.numberFormat);

  const xIdx = data.columns.indexOf(binding.xColumn);
  const yIdx = data.columns.indexOf(binding.yColumns[0]);

  const funnelData = data.rows.map((r) => ({
    name: String(r[xIdx] ?? ""),
    value: Number(r[yIdx]) || 0,
  }));

  return {
    color: colors,
    tooltip: {
      trigger: "item", backgroundColor: bgColor, borderColor,
      textStyle: { color: tooltipText, fontSize: 12 }, borderWidth: 1,
    },
    legend: settings.showLegend ? { textStyle: { color: textColor, fontSize: 11 }, bottom: 4, type: "scroll" } : undefined,
    series: [{
      type: "funnel",
      left: "10%", top: 16, bottom: 40, width: "80%",
      sort: "descending",
      gap: 2,
      label: {
        show: settings.showDataLabels, position: "inside", color: "#fff", fontSize: 11,
        formatter: yFmt ? (({ name, value }: { name: string; value: number }) => `${name}: ${yFmt(value)}`) : undefined,
      },
      itemStyle: { borderColor: bgColor, borderWidth: 1 },
      data: funnelData,
    }],
    animationDuration: 600,
  };
}

/* ── Treemap chart ───────────────────────────────── */

function buildTreemapOption(widget: DashboardWidget, colorScheme: ColorScheme) {
  const { data, binding, settings } = widget;
  if (!data || !binding.xColumn || binding.yColumns.length === 0) return null;

  const colors = COLOR_PALETTES[settings.palette] ?? COLOR_PALETTES.default;
  const { textColor, bgColor, borderColor, tooltipText } = getChartThemeColors(colorScheme);
  const yFmt = numberFormatter(settings.numberFormat);

  const xIdx = data.columns.indexOf(binding.xColumn);
  const yIdx = data.columns.indexOf(binding.yColumns[0]);
  const gIdx = binding.groupBy ? data.columns.indexOf(binding.groupBy) : -1;

  if (gIdx >= 0) {
    const groups = new Map<string, { name: string; value: number }[]>();
    for (const row of data.rows) {
      const g = String(row[gIdx] ?? "");
      const name = String(row[xIdx] ?? "");
      const value = Number(row[yIdx]) || 0;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push({ name, value });
    }
    const treeData = [...groups.entries()].map(([g, children]) => ({
      name: g,
      children,
    }));
    return buildTreemapEcharts(treeData, settings, colors, textColor, bgColor, borderColor, tooltipText, yFmt);
  }

  const treeData = data.rows.map((r) => ({
    name: String(r[xIdx] ?? ""),
    value: Number(r[yIdx]) || 0,
  }));

  return buildTreemapEcharts(treeData, settings, colors, textColor, bgColor, borderColor, tooltipText, yFmt);
}

function buildTreemapEcharts(
  treeData: unknown[],
  settings: ChartSettings,
  colors: string[],
  textColor: string,
  bgColor: string,
  borderColor: string,
  tooltipText: string,
  yFmt: ((v: number) => string) | undefined,
) {
  return {
    color: colors,
    tooltip: {
      backgroundColor: bgColor, borderColor,
      textStyle: { color: tooltipText, fontSize: 12 }, borderWidth: 1,
      formatter: yFmt
        ? (({ name, value }: { name: string; value: number }) => `${name}: ${yFmt(value)}`)
        : undefined,
    },
    series: [{
      type: "treemap",
      data: treeData,
      roam: false,
      breadcrumb: { show: true, itemStyle: { color: bgColor, borderColor, textStyle: { color: textColor } } },
      label: {
        show: settings.showDataLabels,
        color: "#fff",
        fontSize: 11,
        formatter: yFmt ? (({ name, value }: { name: string; value: number }) => `${name}\n${yFmt(value)}`) : undefined,
      },
      itemStyle: { borderColor, borderWidth: 1, gapWidth: 2 },
      levels: [
        { itemStyle: { borderWidth: 3, borderColor, gapWidth: 3 } },
        { itemStyle: { borderWidth: 1, gapWidth: 1 }, colorSaturation: [0.3, 0.7] },
      ],
    }],
    animationDuration: 600,
  };
}

/* ── Gauge chart ─────────────────────────────────── */

function buildGaugeOption(widget: DashboardWidget, colorScheme: ColorScheme) {
  const { data, binding, settings } = widget;
  if (!data || binding.yColumns.length === 0) return null;

  const colors = COLOR_PALETTES[settings.palette] ?? COLOR_PALETTES.default;
  const { textColor, bgColor, borderColor, tooltipText } = getChartThemeColors(colorScheme);
  const yFmt = numberFormatter(settings.numberFormat);

  const yIdx = data.columns.indexOf(binding.yColumns[0]);
  if (yIdx === -1) return null;
  const values = data.rows.map((r) => Number(r[yIdx]) || 0);
  const value = values.length > 0 ? values[0] : 0;
  const max = Math.max(...values, value * 1.5 || 100);

  return {
    tooltip: {
      backgroundColor: bgColor, borderColor,
      textStyle: { color: tooltipText, fontSize: 12 }, borderWidth: 1,
    },
    series: [{
      type: "gauge",
      min: 0,
      max: Math.ceil(max),
      progress: { show: true, width: 14, itemStyle: { color: colors[0] } },
      axisLine: { lineStyle: { width: 14, color: [[1, borderColor]] } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 2, color: textColor } },
      axisLabel: { distance: 20, color: textColor, fontSize: 10, formatter: yFmt },
      pointer: { itemStyle: { color: colors[0] } },
      title: { show: true, offsetCenter: [0, "70%"], color: textColor, fontSize: 12 },
      detail: {
        valueAnimation: true, offsetCenter: [0, "45%"],
        fontSize: 24, fontWeight: 700, color: colors[0],
        formatter: yFmt ?? "{value}",
      },
      data: [{ value, name: binding.yColumns[0] }],
    }],
    animationDuration: 600,
  };
}

/* ── SQL builder ─────────────────────────────────── */

const ROW_NUM_COL = "__row_number__";

function sqlCol(col: string): string {
  if (col === ROW_NUM_COL) return "ROW_NUMBER() OVER() AS __row_number__";
  return col;
}

function sqlColRef(col: string): string {
  if (col === ROW_NUM_COL) return "__row_number__";
  return col;
}

function buildWhereClause(filters: FilterItem[], tableName: string): string {
  const clauses: string[] = [];
  for (const f of filters) {
    if (f.table !== tableName) continue;

    if ((f.filterType === "date_range" || f.filterType === "date_relative") && (f.dateFrom || f.dateTo)) {
      const col = `\`${f.column}\``;
      if (f.dateFrom && f.dateTo) {
        clauses.push(`${col} >= '${f.dateFrom}' AND ${col} <= '${f.dateTo}'`);
      } else if (f.dateFrom) {
        clauses.push(`${col} >= '${f.dateFrom}'`);
      } else if (f.dateTo) {
        clauses.push(`${col} <= '${f.dateTo}'`);
      }
      continue;
    }

    if (f.filterType === "numeric_range" && f.numericValue !== undefined) {
      const col = `\`${f.column}\``;
      const op = f.numericOp ?? ">";
      if (op === "between" && f.numericValue2 !== undefined) {
        clauses.push(`${col} >= ${f.numericValue} AND ${col} <= ${f.numericValue2}`);
      } else {
        clauses.push(`${col} ${op} ${f.numericValue}`);
      }
      continue;
    }

    if (f.selectedValues.length === 0) continue;
    const col = `\`${f.column}\``;
    const escaped = f.selectedValues.map((v) => `'${v.replace(/'/g, "''")}'`);
    if (f.mode === "single" || f.selectedValues.length === 1) {
      clauses.push(`${col} = ${escaped[0]}`);
    } else {
      clauses.push(`${col} IN (${escaped.join(", ")})`);
    }
  }
  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
}

export function buildAutoSql(
  tableName: string | null,
  xColumn: string | null,
  yColumns: string[],
  settings?: ChartSettings,
  filters?: FilterItem[],
  groupByColumn?: string | null,
): string {
  if (!tableName || !xColumn || yColumns.length === 0) return "";

  const CHART_ROW_CAP = 10_000;
  const agg: Aggregation = settings?.aggregation ?? "SUM";
  const sort: SortOrder = settings?.sortOrder ?? "none";

  const isRowNum = xColumn === ROW_NUM_COL;
  const xSelect = sqlCol(xColumn);
  const xRef = sqlColRef(xColumn);

  const groupByCols: string[] = [];
  if (!isRowNum) groupByCols.push(xRef);

  let selectCols = xSelect;
  if (groupByColumn) {
    selectCols += `, ${sqlCol(groupByColumn)}`;
    groupByCols.push(sqlColRef(groupByColumn));
  }

  const aggCols =
    agg === "NONE"
      ? yColumns.map((c) => sqlCol(c)).join(", ")
      : yColumns.map((c) => `${agg}(${c === ROW_NUM_COL ? "1" : c}) AS ${sqlColRef(c)}`).join(", ");

  const parts = [`SELECT ${selectCols}, ${aggCols}`, `FROM ${tableName}`];

  const where = filters ? buildWhereClause(filters, tableName) : "";
  if (where) parts.push(where);

  if (agg !== "NONE" && groupByCols.length > 0) {
    parts.push(`GROUP BY ${groupByCols.join(", ")}`);
  }

  if (sort === "x-asc") parts.push(`ORDER BY ${xRef} ASC`);
  else if (sort === "x-desc") parts.push(`ORDER BY ${xRef} DESC`);
  else if (sort === "y-asc" && yColumns.length > 0) parts.push(`ORDER BY ${sqlColRef(yColumns[0])} ASC`);
  else if (sort === "y-desc" && yColumns.length > 0) parts.push(`ORDER BY ${sqlColRef(yColumns[0])} DESC`);
  else if (!isRowNum) parts.push(`ORDER BY ${xRef}`);

  parts.push(`LIMIT ${CHART_ROW_CAP}`);
  return parts.join("\n");
}
