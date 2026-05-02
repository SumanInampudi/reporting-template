import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useDroppable } from "@dnd-kit/core";
import { Loader2, Maximize2, ArrowDownRight, ArrowUpLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { runQuery } from "@/lib/api";
import { buildEChartsOption, buildAutoSql, getChartThemeColors, DYNAMIC_DIM_COL } from "@/lib/chartBuilder";
import { downloadCsv } from "@/lib/csvExport";
import { canDrillDown, canDrillUp, findHierarchyByColumn, getChildLevel, getParentLevel, getAncestorColumns } from "@/lib/hierarchyUtils";
import { categorizeColumns } from "@/lib/columnUtils";
import SettingsPanel from "@/components/settings/SettingsPanel";
import AxisSortControls from "@/components/ui/AxisSortControls";
import DataTable from "@/components/ui/DataTable";
import SqlPreview from "@/components/ui/SqlPreview";
import WidgetHeader from "@/components/dashboard/WidgetHeader";
import type { ChartBinding, ChartType, DashboardWidget, DrillFilter, FilterItem, SortOrder } from "@/types/dashboard";

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
    dashboardFilters, columns: columnsMap, selectedCatalog, selectedSchema,
    selectedTable, hierarchies,
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

  const allFilters = useMemo(() => {
    const base = mergeAllFilters(appliedFilters, dashboardFilters);
    const drills = widget.drillFilters ?? [];
    if (drills.length === 0) return base;
    const tbl = useStore.getState().effectiveTableRef() ?? widget.tableName ?? "";
    const drillFilterItems: FilterItem[] = drills.map((df, i) => ({
      id: `drill-${widget.id}-${i}`,
      column: df.column,
      table: tbl,
      dataType: "STRING",
      filterType: "value_list" as const,
      mode: "single" as const,
      values: [df.value],
      selectedValues: [df.value],
    }));
    return [...base, ...drillFilterItems];
  }, [appliedFilters, dashboardFilters, widget.drillFilters, widget.id, widget.tableName]);

  const effectiveTableRef = useStore((s) => s.effectiveTableRef);
  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const resolvedTableName = effectiveTableRef() ?? widget.tableName;

  const availableColumns = useMemo(() => {
    const colKey = isCustomQuery
      ? "__custom_source__"
      : (widget.tableName ?? (selectedCatalog && selectedSchema && selectedTable
        ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : selectedTable));
    const metas = colKey ? columnsMap[colKey] : undefined;
    if (!metas) return [];
    return metas.map((m) => ({ name: m.col_name, dataType: m.data_type }));
  }, [isCustomQuery, widget.tableName, columnsMap, selectedCatalog, selectedSchema, selectedTable]);

  const usesDynamicDim = useMemo(() => {
    const all = [...widget.binding.xColumns, ...widget.binding.yColumns, ...widget.binding.groupBy];
    return all.includes(DYNAMIC_DIM_COL);
  }, [widget.binding]);

  const dimensionOptions = useMemo(() => {
    const colKey = isCustomQuery
      ? "__custom_source__"
      : (widget.tableName ?? (selectedCatalog && selectedSchema && selectedTable
        ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : selectedTable));
    const metas = colKey ? columnsMap[colKey] : undefined;
    if (!metas) return [];
    const { dimensions } = categorizeColumns(
      useStore.getState().selectedOutputColumns.length > 0
        ? metas.filter((m) => useStore.getState().selectedOutputColumns.includes(m.col_name))
        : metas,
    );
    return dimensions.map((d) => d.col_name);
  }, [widget.tableName, columnsMap, selectedCatalog, selectedSchema, selectedTable]);

  const dynamicDimValue = widget.dynamicDimensionValue || dimensionOptions[0] || "";

  const handleBindingChange = useCallback((b: ChartBinding) => {
    updateWidget(widget.id, { binding: b });
  }, [widget.id, updateWidget]);

  const echartsOption = useMemo(
    () => buildEChartsOption(widget, colorScheme),
    [widget, colorScheme],
  );

  const autoGenSql = useMemo(
    () => {
      const bf = useStore.getState().activeWorkspace?.datasource?.base_filters;
      return buildAutoSql(resolvedTableName, widget.binding.xColumns, widget.binding.yColumns, widget.settings, allFilters, widget.binding.groupBy, bf, usesDynamicDim ? dynamicDimValue : undefined);
    },
    [resolvedTableName, widget.binding, widget.settings, allFilters, usesDynamicDim, dynamicDimValue],
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
    const bf = useStore.getState().activeWorkspace?.datasource?.base_filters;
    const sql = buildAutoSql(resolvedTableName, widget.binding.xColumns, widget.binding.yColumns, widget.settings, allFilters, widget.binding.groupBy, bf, usesDynamicDim ? dynamicDimValue : undefined);
    if (sql && sql !== lastAutoSqlRef.current) {
      lastAutoSqlRef.current = sql;
      setSqlEdit(sql);
      executeQuery(sql);
    }
  }, [filtersVersion, dashboardFilters, allFilters, resolvedTableName, widget.binding, widget.settings, executeQuery, usesDynamicDim, dynamicDimValue]);

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
    const bf3 = useStore.getState().activeWorkspace?.datasource?.base_filters;
    const sql = buildAutoSql(resolvedTableName, widget.binding.xColumns, widget.binding.yColumns, widget.settings, allFilters, widget.binding.groupBy, bf3, usesDynamicDim ? dynamicDimValue : undefined);
    if (sql) { setSqlEdit(sql); executeQuery(sql); }
  }, [resolvedTableName, widget.binding, widget.settings, allFilters, executeQuery, usesDynamicDim, dynamicDimValue]);

  const chartClickDrill = useCallback((params: { name?: string; seriesName?: string }) => {
    const clickedValue = params.name;
    if (!clickedValue) return;
    const xCol = widget.binding.xColumns[0];
    if (!xCol) return;
    const h = findHierarchyByColumn(hierarchies, xCol);
    if (!h) return;
    const child = getChildLevel(h, xCol);
    if (!child) return;

    const newBinding: ChartBinding = {
      ...widget.binding,
      xColumns: widget.binding.xColumns.map((c) => (c === xCol ? child.column : c)),
    };
    updateWidget(widget.id, {
      binding: newBinding,
      drillFilters: [
        ...(widget.drillFilters ?? []),
        { column: xCol, value: clickedValue },
      ],
    });
  }, [hierarchies, widget.binding, widget.id, widget.drillFilters, updateWidget]);

  const chartDrillDown = useCallback((col: string) => {
    const h = findHierarchyByColumn(hierarchies, col);
    if (!h) return;
    const child = getChildLevel(h, col);
    if (!child) return;
    const newBinding: ChartBinding = {
      ...widget.binding,
      xColumns: widget.binding.xColumns.map((c) => (c === col ? child.column : c)),
    };
    updateWidget(widget.id, { binding: newBinding });
  }, [hierarchies, widget.binding, widget.id, updateWidget]);

  const chartDrillUp = useCallback((col: string) => {
    const h = findHierarchyByColumn(hierarchies, col);
    if (!h) return;
    const parent = getParentLevel(h, col);
    if (!parent) return;
    const newBinding: ChartBinding = {
      ...widget.binding,
      xColumns: widget.binding.xColumns.map((c) => (c === col ? parent.column : c)),
    };
    updateWidget(widget.id, { binding: newBinding });
  }, [hierarchies, widget.binding, widget.id, updateWidget]);

  const xDrillable = useMemo(() => {
    return widget.binding.xColumns.filter(
      (c) => canDrillDown(hierarchies, c) || canDrillUp(hierarchies, c),
    );
  }, [widget.binding.xColumns, hierarchies]);

  const chartDrillToLevel = useCallback((targetCol: string) => {
    for (const col of widget.binding.xColumns) {
      const h = findHierarchyByColumn(hierarchies, col);
      if (!h) continue;
      const ancestors = getAncestorColumns(h, col);
      if (ancestors.includes(targetCol) || getAncestorColumns(h, targetCol).length > 0) {
        const newBinding: ChartBinding = {
          ...widget.binding,
          xColumns: widget.binding.xColumns.map((c) => (c === col ? targetCol : c)),
        };
        updateWidget(widget.id, { binding: newBinding });
        break;
      }
    }
  }, [hierarchies, widget.binding, widget.id, updateWidget]);

  const chartBreadcrumbs = useMemo(() => {
    const crumbs: { hierarchyName: string; levels: { column: string; label: string; isCurrent: boolean }[] }[] = [];
    const seen = new Set<string>();
    for (const col of widget.binding.xColumns) {
      const h = findHierarchyByColumn(hierarchies, col);
      if (!h || seen.has(h.id)) continue;
      seen.add(h.id);
      const ancestors = getAncestorColumns(h, col);
      if (ancestors.length <= 0) continue;
      crumbs.push({
        hierarchyName: h.name,
        levels: ancestors.map((c) => ({ column: c, label: colAlias(c), isCurrent: c === col })),
      });
    }
    return crumbs;
  }, [widget.binding.xColumns, hierarchies, colAlias]);

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
        onClearGroupBy={widget.binding.groupBy.length > 0 ? () => updateWidget(widget.id, { binding: { ...widget.binding, groupBy: [] } }) : undefined}
      />

      {usesDynamicDim && dimensionOptions.length > 0 && (
        <div className="dynamic-dim-bar">
          <label className="dynamic-dim-label">Dimension:</label>
          <select
            className="dynamic-dim-select"
            value={dynamicDimValue}
            onChange={(e) => updateWidget(widget.id, { dynamicDimensionValue: e.target.value })}
          >
            {dimensionOptions.map((d) => (
              <option key={d} value={d}>{colAlias(d)}</option>
            ))}
          </select>
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          settings={widget.settings}
          chartType={widget.chartType}
          binding={widget.binding}
          availableColumns={availableColumns}
          onChange={(patch) => updateWidgetSettings(widget.id, patch)}
          onBindingChange={handleBindingChange}
          onRequery={handleRequery}
          onClose={() => setShowSettings(false)}
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
              onEvents={xDrillable.length > 0 ? { click: chartClickDrill } : undefined}
            />
            {showAxisSort && (
              <AxisSortControls
                value={widget.settings.sortOrder}
                onChange={(order: SortOrder) => updateWidgetSettings(widget.id, { sortOrder: order })}
                xLabel={widget.binding.xColumns[0] ?? undefined}
                yLabel={widget.binding.yColumns[0] ?? undefined}
              />
            )}
            {(chartBreadcrumbs.length > 0 || (widget.drillFilters ?? []).length > 0) && (
              <div className="chart-breadcrumbs">
                {(widget.drillFilters ?? []).length > 0 && (
                  <div className="chart-bc-row">
                    <span className="chart-bc-filters">
                      {(widget.drillFilters ?? []).map((df) => `${colAlias(df.column)}=${df.value}`).join(" > ")}
                    </span>
                    <button
                      className="chart-bc-reset"
                      onClick={() => {
                        const h = findHierarchyByColumn(hierarchies, widget.binding.xColumns[0] ?? "");
                        const topCol = h?.levels[0]?.column;
                        updateWidget(widget.id, {
                          drillFilters: [],
                          ...(topCol ? { binding: { ...widget.binding, xColumns: widget.binding.xColumns.map((c, i) => i === 0 && topCol ? topCol : c) } } : {}),
                        });
                      }}
                      title="Reset drill-down"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {chartBreadcrumbs.map((bc) => (
                  <div key={bc.hierarchyName} className="chart-bc-row">
                    {bc.levels.map((lv, i) => (
                      <span key={lv.column} className="chart-bc-item">
                        {i > 0 && <ChevronRight size={9} className="chart-bc-sep" />}
                        <button
                          className={`chart-bc-btn${lv.isCurrent ? " chart-bc-btn--current" : ""}`}
                          onClick={() => !lv.isCurrent && chartDrillToLevel(lv.column)}
                          disabled={lv.isCurrent}
                        >
                          {lv.label}
                        </button>
                      </span>
                    ))}
                    {(() => {
                      const currentCol = bc.levels.find((l) => l.isCurrent)?.column;
                      if (!currentCol) return null;
                      return (
                        <span className="chart-bc-actions">
                          {canDrillUp(hierarchies, currentCol) && (
                            <button className="chart-drill-btn" onClick={() => chartDrillUp(currentCol)} title="Drill up">
                              <ArrowUpLeft size={11} />
                            </button>
                          )}
                          {canDrillDown(hierarchies, currentCol) && (
                            <button className="chart-drill-btn" onClick={() => chartDrillDown(currentCol)} title="Drill down">
                              <ArrowDownRight size={11} />
                            </button>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="widget-placeholder">
            <Maximize2 size={32} strokeWidth={1} />
            <p>Drop columns here to build chart</p>
            {widget.binding.xColumns.length > 0 && (
              <p className="binding-preview">
                X: {widget.binding.xColumns.map(colAlias).join(", ")}
                {widget.binding.yColumns.length > 0 && ` | Y: ${widget.binding.yColumns.map(colAlias).join(", ")}`}
                {widget.binding.groupBy.length > 0 && ` | Color: ${widget.binding.groupBy.map(colAlias).join(", ")}`}
              </p>
            )}
            {widget.binding.xColumns.length > 0 && widget.binding.yColumns.length === 0 && (
              <p className="binding-hint">Now drop a numeric column for Y axis</p>
            )}
            {widget.binding.xColumns.length === 0 && widget.binding.yColumns.length > 0 && (
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
