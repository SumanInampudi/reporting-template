import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useDroppable } from "@dnd-kit/core";
import { Loader2, Maximize2 } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { runQuery } from "@/lib/api";
import { buildEChartsOption, buildAutoSql, getChartThemeColors } from "@/lib/chartBuilder";
import { downloadCsv } from "@/lib/csvExport";
import SettingsPanel from "@/components/settings/SettingsPanel";
import AxisSortControls from "@/components/ui/AxisSortControls";
import DataTable from "@/components/ui/DataTable";
import SqlPreview from "@/components/ui/SqlPreview";
import WidgetHeader from "@/components/dashboard/WidgetHeader";
import type { ChartType, DashboardWidget, FilterItem, SortOrder } from "@/types/dashboard";

function mergeAllFilters(applied: FilterItem[], dashboard: FilterItem[]): FilterItem[] {
  const active = dashboard.filter((f) => {
    if (f.filterType === "numeric_range") return f.numericValue !== undefined;
    if (f.filterType === "date_range" || f.filterType === "date_relative") return !!(f.dateFrom && f.dateTo);
    return f.selectedValues.length > 0;
  });
  return [...applied, ...active];
}

export default function ChartWidget({ widget, dragListeners }: { widget: DashboardWidget; dragListeners?: Record<string, Function> }) {
  const {
    removeWidget, updateWidget, updateWidgetSettings, setWidgetData,
    setWidgetSize, themeConfig, appliedFilters, filtersVersion,
    dashboardFilters,
  } = useStore();
  const colAlias = useColumnAlias();
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [sqlEdit, setSqlEdit] = useState(widget.sql ?? "");
  const [showSettings, setShowSettings] = useState(false);

  const chartRef = useRef<ReactECharts>(null);
  const colorScheme = themeConfig.colorScheme;

  const { isOver, setNodeRef } = useDroppable({
    id: `widget-drop-${widget.id}`,
    data: { widgetId: widget.id },
  });

  const allFilters = useMemo(
    () => mergeAllFilters(appliedFilters, dashboardFilters),
    [appliedFilters, dashboardFilters],
  );

  const echartsOption = useMemo(
    () => buildEChartsOption(widget, colorScheme),
    [widget, colorScheme],
  );

  const autoGenSql = useMemo(
    () => buildAutoSql(widget.tableName, widget.binding.xColumn, widget.binding.yColumns, widget.settings, allFilters, widget.binding.groupBy),
    [widget.tableName, widget.binding, widget.settings, allFilters],
  );

  const executeQuery = useCallback(async (sql: string) => {
    if (!sql.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    try {
      const data = await runQuery(sql);
      setWidgetData(widget.id, data);
      updateWidget(widget.id, { sql });
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setQueryLoading(false);
    }
  }, [widget.id, setWidgetData, updateWidget]);

  const lastAutoSqlRef = useRef("");
  useEffect(() => {
    if (!autoGenSql || autoGenSql === lastAutoSqlRef.current) return;
    lastAutoSqlRef.current = autoGenSql;
    setSqlEdit(autoGenSql);
    executeQuery(autoGenSql);
  }, [autoGenSql, executeQuery]);

  const lastFiltersVersion = useRef(0);
  const lastDashFiltersKey = useRef("");
  useEffect(() => {
    const dashKey = JSON.stringify(dashboardFilters.map((f) => ({
      col: f.column, sv: f.selectedValues, nv: f.numericValue, df: f.dateFrom, dt: f.dateTo,
    })));
    const changed = filtersVersion !== lastFiltersVersion.current || dashKey !== lastDashFiltersKey.current;
    if (!changed) return;
    lastFiltersVersion.current = filtersVersion;
    lastDashFiltersKey.current = dashKey;
    const sql = buildAutoSql(widget.tableName, widget.binding.xColumn, widget.binding.yColumns, widget.settings, allFilters, widget.binding.groupBy);
    if (sql && sql !== lastAutoSqlRef.current) {
      lastAutoSqlRef.current = sql;
      setSqlEdit(sql);
      executeQuery(sql);
    }
  }, [filtersVersion, dashboardFilters, allFilters, widget.tableName, widget.binding, widget.settings, executeQuery]);

  const handleExportPng = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const { bgColor } = getChartThemeColors(colorScheme);
    const url = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bgColor });
    const link = document.createElement("a");
    link.href = url;
    link.download = `${widget.title || "chart"}.png`;
    link.click();
  };

  const handleRequery = useCallback(() => {
    const sql = buildAutoSql(widget.tableName, widget.binding.xColumn, widget.binding.yColumns, widget.settings, allFilters, widget.binding.groupBy);
    if (sql) { setSqlEdit(sql); executeQuery(sql); }
  }, [widget.tableName, widget.binding, widget.settings, allFilters, executeQuery]);

  const displaySql = sqlEdit || autoGenSql;
  const noAxisCharts = new Set(["pie", "table", "radar", "funnel", "treemap", "gauge"]);
  const showAxisSort = !noAxisCharts.has(widget.chartType) && echartsOption;

  return (
    <div ref={setNodeRef} className={`chart-widget ${isOver ? "drop-hover" : ""}`}>
      <WidgetHeader
        widget={widget}
        queryLoading={queryLoading}
        usingCache={false}
        hasChart={!!echartsOption}
        showSettings={showSettings}
        dragListeners={dragListeners}
        onTitleChange={(title) => updateWidget(widget.id, { title })}
        onChartTypeChange={(type: ChartType) => updateWidget(widget.id, { chartType: type })}
        onToggleSettings={() => setShowSettings((v) => !v)}
        onSizeChange={(size) => setWidgetSize(widget.id, size)}
        onExportCsv={() => widget.data && downloadCsv(widget.data, widget.title || "data")}
        onExportPng={handleExportPng}
        onRemove={() => removeWidget(widget.id)}
        onClearGroupBy={widget.binding.groupBy ? () => updateWidget(widget.id, { binding: { ...widget.binding, groupBy: null } }) : undefined}
      />

      {showSettings && (
        <SettingsPanel
          settings={widget.settings}
          chartType={widget.chartType}
          onChange={(patch) => updateWidgetSettings(widget.id, patch)}
          onRequery={handleRequery}
        />
      )}

      <div className="widget-body">
        {queryLoading && !widget.data ? (
          <div className="widget-placeholder">
            <Loader2 size={32} strokeWidth={1.5} className="spin" />
            <p>Fetching data...</p>
          </div>
        ) : queryError ? (
          <div className="widget-placeholder">
            <p style={{ color: "var(--danger)", fontSize: 12 }}>{queryError}</p>
          </div>
        ) : widget.chartType === "table" && widget.data ? (
          <DataTable data={widget.data} />
        ) : echartsOption ? (
          <div className="chart-area">
            <ReactECharts
              ref={chartRef}
              option={echartsOption}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "canvas" }}
              notMerge
            />
            {showAxisSort && (
              <AxisSortControls
                value={widget.settings.sortOrder}
                onChange={(order: SortOrder) => updateWidgetSettings(widget.id, { sortOrder: order })}
                xLabel={widget.binding.xColumn ?? undefined}
                yLabel={widget.binding.yColumns[0] ?? undefined}
              />
            )}
          </div>
        ) : (
          <div className="widget-placeholder">
            <Maximize2 size={32} strokeWidth={1} />
            <p>Drop columns here to build chart</p>
            {widget.binding.xColumn && (
              <p className="binding-preview">
                X: {colAlias(widget.binding.xColumn)}
                {widget.binding.yColumns.length > 0 && ` | Y: ${widget.binding.yColumns.map(colAlias).join(", ")}`}
                {widget.binding.groupBy && ` | Color: ${colAlias(widget.binding.groupBy)}`}
              </p>
            )}
            {widget.binding.xColumn && widget.binding.yColumns.length === 0 && (
              <p className="binding-hint">Now drop a numeric column for Y axis</p>
            )}
            {!widget.binding.xColumn && widget.binding.yColumns.length > 0 && (
              <p className="binding-hint">Now drop a text/date column for X axis</p>
            )}
          </div>
        )}
      </div>

      {displaySql && (
        <SqlPreview
          sql={autoGenSql}
          sqlEdit={sqlEdit}
          onSqlChange={setSqlEdit}
          onRun={() => executeQuery(sqlEdit || autoGenSql)}
          loading={queryLoading}
        />
      )}
    </div>
  );
}
