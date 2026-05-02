import { useMemo } from "react";
import { Palette, TableIcon } from "lucide-react";
import DraggableChartType from "./DraggableChartType";
import ColumnGroup from "./ColumnGroup";
import { useStore } from "@/hooks/useStore";
import { categorizeColumns } from "@/lib/columnUtils";
import { CHART_OPTIONS } from "@/lib/constants";
import type { ColumnMeta } from "@/types/dashboard";

const SPECIAL_MEASURES: ColumnMeta[] = [
  { col_name: "__row_count__", data_type: "INT" },
];

const DYNAMIC_DIM: ColumnMeta[] = [
  { col_name: "__dynamic_dimension__", data_type: "STRING" },
];

export default function DesignTab() {
  const {
    columns, selectedTable, selectedCatalog, selectedSchema,
    selectedOutputColumns, baseDataset,
  } = useStore();

  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : null);
  const allColumns = colKey ? columns[colKey] ?? [] : [];

  const visibleColumns = useMemo(() => {
    if (selectedOutputColumns.length === 0) return allColumns;
    const selected = new Set(selectedOutputColumns);
    return allColumns.filter((c) => selected.has(c.col_name));
  }, [allColumns, selectedOutputColumns]);

  const { dimensions, facts } = categorizeColumns(visibleColumns);

  const hasDataset = !!baseDataset;

  return (
    <div className="sidebar-scroll">
      <div className="sidebar-section">
        <h3 className="sidebar-heading"><Palette size={14} /> Chart Types</h3>
        <p className="sidebar-hint">Drag a chart onto an empty grid slot</p>
        <div className="chart-type-grid">
          {CHART_OPTIONS.map((opt) => (
            <DraggableChartType key={opt.type} type={opt.type} label={opt.label} />
          ))}
        </div>
      </div>

      {visibleColumns.length > 0 && (
        <div className="sidebar-section">
          <h3 className="sidebar-heading">
            <TableIcon size={14} /> Columns
            {visibleColumns.length > 0 && (
              <span className="col-group-count">{visibleColumns.length}</span>
            )}
          </h3>
          <p className="sidebar-hint">Drag columns onto a chart widget</p>

          <ColumnGroup
            title="Dimensions"
            icon="dimension"
            columns={dimensions}
            table={colKey!}
          />

          <ColumnGroup
            title="Facts / Measures"
            icon="fact"
            columns={facts}
            table={colKey!}
          />

          {hasDataset && (
            <>
              <ColumnGroup
                title="Special Measures"
                icon="fact"
                columns={SPECIAL_MEASURES}
                table={colKey!}
              />
              <ColumnGroup
                title="Dynamic Fields"
                icon="dimension"
                columns={DYNAMIC_DIM}
                table={colKey!}
              />
            </>
          )}
        </div>
      )}

      {visibleColumns.length === 0 && (
        <div className="sidebar-section">
          <p className="sidebar-info">
            {allColumns.length > 0
              ? "No output columns selected. Go to the Data Explorer tab to choose columns."
              : "Select a table in the Data Source tab first."}
          </p>
        </div>
      )}
    </div>
  );
}
