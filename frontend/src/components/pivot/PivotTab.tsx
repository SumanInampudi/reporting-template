import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { runQuery } from "@/lib/api";
import { Table2, AlertTriangle, GripVertical, X, ChevronDown, Loader2 } from "lucide-react";

type AggFunc = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
const AGG_OPTIONS: AggFunc[] = ["SUM", "AVG", "COUNT", "MIN", "MAX"];

interface ValueField {
  name: string;
  agg: AggFunc;
}

interface PivotConfig {
  rowFields: string[];
  colFields: string[];
  valueFields: ValueField[];
}

/* ─── Draggable field chip ──────────────────── */

function DraggableChip({ id, label, zone }: { id: string; label: string; zone: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${zone}::${id}`,
    data: { field: id, fromZone: zone },
  });
  return (
    <div
      ref={setNodeRef}
      className={`pivot-chip ${isDragging ? "pivot-chip--dragging" : ""}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={12} />
      <span>{label}</span>
    </div>
  );
}

/* ─── Drop zone ─────────────────────────────── */

function DropZone({
  id,
  label,
  fields,
  alias,
  onRemove,
  renderExtra,
}: {
  id: string;
  label: string;
  fields: string[];
  alias: (c: string) => string;
  onRemove: (field: string) => void;
  renderExtra?: (field: string) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="pivot-zone" ref={setNodeRef}>
      <div className="pivot-zone__label">{label}</div>
      <div className={`pivot-zone__area ${isOver ? "pivot-zone__area--over" : ""}`}>
        {fields.length === 0 && <span className="pivot-zone__hint">Drop fields here</span>}
        {fields.map((f) => (
          <div key={f} className="pivot-zone__item">
            <DraggableChip id={f} label={alias(f)} zone={id} />
            {renderExtra?.(f)}
            <button className="pivot-zone__remove" onClick={() => onRemove(f)} title="Remove">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Build pivot SQL ────────────────────────── */

function buildPivotSql(
  tableName: string,
  config: PivotConfig,
  filters: { column: string; selectedValues: string[]; filterType: string; dateFrom?: string; dateTo?: string }[],
): string {
  if (config.rowFields.length === 0 && config.valueFields.length === 0) return "";

  const selectParts: string[] = [];
  const groupByParts: string[] = [];

  for (const f of config.rowFields) {
    selectParts.push(`\`${f}\``);
    groupByParts.push(`\`${f}\``);
  }
  for (const f of config.colFields) {
    selectParts.push(`\`${f}\``);
    groupByParts.push(`\`${f}\``);
  }
  for (const vf of config.valueFields) {
    selectParts.push(`${vf.agg}(\`${vf.name}\`) AS \`${vf.agg}_${vf.name}\``);
  }

  const parts = [`SELECT ${selectParts.join(", ")}`, `FROM ${tableName}`];

  const whereClauses: string[] = [];
  for (const f of filters) {
    if ((f.filterType === "date_range" || f.filterType === "date_relative") && (f.dateFrom || f.dateTo)) {
      const col = `\`${f.column}\``;
      if (f.dateFrom && f.dateTo) whereClauses.push(`${col} >= '${f.dateFrom}' AND ${col} <= '${f.dateTo}'`);
      else if (f.dateFrom) whereClauses.push(`${col} >= '${f.dateFrom}'`);
      else if (f.dateTo) whereClauses.push(`${col} <= '${f.dateTo}'`);
      continue;
    }
    if (f.selectedValues.length === 0) continue;
    const col = `\`${f.column}\``;
    const escaped = f.selectedValues.map((v) => `'${v.replace(/'/g, "''")}'`);
    if (f.selectedValues.length === 1) whereClauses.push(`${col} = ${escaped[0]}`);
    else whereClauses.push(`${col} IN (${escaped.join(", ")})`);
  }
  if (whereClauses.length > 0) parts.push(`WHERE ${whereClauses.join(" AND ")}`);

  if (groupByParts.length > 0) parts.push(`GROUP BY ${groupByParts.join(", ")}`);
  parts.push("LIMIT 50000");
  return parts.join("\n");
}

/* ─── Client-side pivot of server aggregated rows ── */

interface PivotResult {
  rows: Record<string, unknown>[];
  colDefs: { field: string; headerName: string }[];
}

function pivotServerData(
  rawCols: string[],
  rawRows: unknown[][],
  config: PivotConfig,
  alias: (c: string) => string,
): PivotResult {
  if (config.colFields.length === 0) {
    const colDefs = rawCols.map((c) => ({ field: c, headerName: alias(c) }));
    const rows = rawRows.map((r) => {
      const obj: Record<string, unknown> = {};
      rawCols.forEach((c, i) => { obj[c] = r[i]; });
      return obj;
    });
    return { rows, colDefs };
  }

  const colIdx = new Map(rawCols.map((c, i) => [c, i]));
  const getVal = (row: unknown[], col: string) => row[colIdx.get(col) ?? -1];

  const rowKey = (row: unknown[]) =>
    config.rowFields.map((f) => String(getVal(row, f) ?? "")).join("||");
  const colKey = (row: unknown[]) =>
    config.colFields.map((f) => String(getVal(row, f) ?? "")).join("||");

  const groups = new Map<string, { dims: Record<string, unknown>; vals: Map<string, number> }>();
  const allColKeys = new Set<string>();

  for (const row of rawRows) {
    const rk = rowKey(row);
    const ck = colKey(row);
    allColKeys.add(ck);

    if (!groups.has(rk)) {
      const dims: Record<string, unknown> = {};
      for (const f of config.rowFields) dims[f] = getVal(row, f);
      groups.set(rk, { dims, vals: new Map() });
    }
    const group = groups.get(rk)!;

    for (const vf of config.valueFields) {
      const aggCol = `${vf.agg}_${vf.name}`;
      const bucketKey = `${ck}||${aggCol}`;
      const num = Number(getVal(row, aggCol)) || 0;
      group.vals.set(bucketKey, (group.vals.get(bucketKey) ?? 0) + num);
    }
  }

  const sortedColKeys = [...allColKeys].sort();
  const colDefs: { field: string; headerName: string }[] = [];
  for (const f of config.rowFields) {
    colDefs.push({ field: f, headerName: alias(f) });
  }
  for (const ck of sortedColKeys) {
    for (const vf of config.valueFields) {
      const fieldKey = `${ck}__${vf.agg}_${vf.name}`.replace(/[^a-zA-Z0-9_]/g, "_");
      const colLabel = ck || "(blank)";
      const header = config.valueFields.length > 1
        ? `${colLabel} — ${alias(vf.name)} (${vf.agg})`
        : `${colLabel} (${vf.agg})`;
      colDefs.push({ field: fieldKey, headerName: header });
    }
  }

  const rows: Record<string, unknown>[] = [];
  for (const [, group] of groups) {
    const row: Record<string, unknown> = { ...group.dims };
    for (const ck of sortedColKeys) {
      for (const vf of config.valueFields) {
        const aggCol = `${vf.agg}_${vf.name}`;
        const bucketKey = `${ck}||${aggCol}`;
        const fieldKey = `${ck}__${aggCol}`.replace(/[^a-zA-Z0-9_]/g, "_");
        row[fieldKey] = group.vals.get(bucketKey) ?? null;
      }
    }
    rows.push(row);
  }

  return { rows, colDefs };
}

/* ─── Main PivotTab ─────────────────────────── */

export default function PivotTab() {
  const baseDataset = useStore((s) => s.baseDataset);
  const appliedFilters = useStore((s) => s.appliedFilters);
  const selectedCatalog = useStore((s) => s.selectedCatalog);
  const selectedSchema = useStore((s) => s.selectedSchema);
  const selectedTable = useStore((s) => s.selectedTable);
  const alias = useColumnAlias();
  const gridRef = useRef<AgGridReact>(null);

  const [config, setConfig] = useState<PivotConfig>({
    rowFields: [],
    colFields: [],
    valueFields: [],
  });

  const [pivotData, setPivotData] = useState<{ rows: Record<string, unknown>[]; colDefs: { field: string; headerName: string }[] }>({ rows: [], colDefs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const allColumns = useMemo(() => (baseDataset ? baseDataset.columns : []), [baseDataset]);

  const fqTable = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}` : null;

  const usedFields = useMemo(() => {
    const s = new Set<string>();
    config.rowFields.forEach((f) => s.add(f));
    config.colFields.forEach((f) => s.add(f));
    config.valueFields.forEach((f) => s.add(f.name));
    return s;
  }, [config]);

  const availableFields = useMemo(() => allColumns.filter((c) => !usedFields.has(c) && !c.startsWith("__")), [allColumns, usedFields]);

  useEffect(() => {
    if (!fqTable || config.valueFields.length === 0) {
      setPivotData({ rows: [], colDefs: [] });
      return;
    }
    const sql = buildPivotSql(fqTable, config, appliedFilters);
    if (!sql) return;

    setLoading(true);
    setError(null);
    runQuery(sql)
      .then((result) => {
        const pivoted = pivotServerData(result.columns, result.rows, config, alias);
        setPivotData(pivoted);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Pivot query failed");
        setPivotData({ rows: [], colDefs: [] });
      })
      .finally(() => setLoading(false));
  }, [fqTable, config, appliedFilters, alias]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;

      const data = active.data.current as { field: string; fromZone: string } | undefined;
      if (!data) return;

      const { field, fromZone } = data;
      const toZone = String(over.id);

      if (fromZone === toZone) return;

      setConfig((prev) => {
        const next = { ...prev };

        if (fromZone === "rows") next.rowFields = prev.rowFields.filter((f) => f !== field);
        else if (fromZone === "cols") next.colFields = prev.colFields.filter((f) => f !== field);
        else if (fromZone === "values") next.valueFields = prev.valueFields.filter((f) => f.name !== field);

        if (toZone === "rows" && !next.rowFields.includes(field)) {
          next.rowFields = [...next.rowFields, field];
        } else if (toZone === "cols" && !next.colFields.includes(field)) {
          next.colFields = [...next.colFields, field];
        } else if (toZone === "values" && !next.valueFields.some((v) => v.name === field)) {
          next.valueFields = [...next.valueFields, { name: field, agg: "SUM" }];
        }

        return next;
      });
    },
    [],
  );

  const removeFromZone = useCallback((zone: "rows" | "cols" | "values", field: string) => {
    setConfig((prev) => {
      if (zone === "rows") return { ...prev, rowFields: prev.rowFields.filter((f) => f !== field) };
      if (zone === "cols") return { ...prev, colFields: prev.colFields.filter((f) => f !== field) };
      return { ...prev, valueFields: prev.valueFields.filter((f) => f.name !== field) };
    });
  }, []);

  const setAgg = useCallback((field: string, agg: AggFunc) => {
    setConfig((prev) => ({
      ...prev,
      valueFields: prev.valueFields.map((v) => (v.name === field ? { ...v, agg } : v)),
    }));
  }, []);

  const agColDefs = useMemo(
    () =>
      pivotData.colDefs.map((cd, i) => ({
        field: cd.field,
        headerName: cd.headerName,
        sortable: true,
        filter: true,
        resizable: true,
        pinned: i < config.rowFields.length ? ("left" as const) : undefined,
        cellDataType: i >= config.rowFields.length ? ("number" as const) : undefined,
        valueFormatter:
          i >= config.rowFields.length
            ? (p: { value: unknown }) => {
                const v = p.value;
                if (v == null) return "";
                const n = Number(v);
                return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
              }
            : undefined,
      })),
    [pivotData.colDefs, config.rowFields.length],
  );

  const activeField = activeId?.split("::")[1] ?? null;

  if (!baseDataset) {
    return (
      <div className="pivot-empty">
        <div className="pivot-empty-inner">
          <Table2 size={48} strokeWidth={1} />
          <h3>No data loaded</h3>
          <p>Load data in the <strong>Data &amp; Filters</strong> tab first to use the pivot table.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pivot-tab">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Field config panel */}
        <div className="pivot-config">
          {/* Available fields */}
          <div className="pivot-available">
            <div className="pivot-zone__label">Fields</div>
            <div className="pivot-available__list">
              {availableFields.map((f) => (
                <DraggableChip key={f} id={f} label={alias(f)} zone="available" />
              ))}
              {availableFields.length === 0 && (
                <span className="pivot-zone__hint">All fields assigned</span>
              )}
            </div>
          </div>

          {/* Drop zones */}
          <div className="pivot-zones">
            <DropZone
              id="rows"
              label="Rows"
              fields={config.rowFields}
              alias={alias}
              onRemove={(f) => removeFromZone("rows", f)}
            />
            <DropZone
              id="cols"
              label="Columns"
              fields={config.colFields}
              alias={alias}
              onRemove={(f) => removeFromZone("cols", f)}
            />
            <DropZone
              id="values"
              label="Values"
              fields={config.valueFields.map((v) => v.name)}
              alias={alias}
              onRemove={(f) => removeFromZone("values", f)}
              renderExtra={(f) => {
                const vf = config.valueFields.find((v) => v.name === f);
                if (!vf) return null;
                return (
                  <div className="pivot-agg-select">
                    <select value={vf.agg} onChange={(e) => setAgg(f, e.target.value as AggFunc)}>
                      {AGG_OPTIONS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} />
                  </div>
                );
              }}
            />
          </div>
        </div>

        <DragOverlay>
          {activeField ? (
            <div className="pivot-chip pivot-chip--overlay">
              <GripVertical size={12} />
              <span>{alias(activeField)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Loading / Error / Grid */}
      {loading ? (
        <div className="pivot-placeholder">
          <Loader2 size={24} className="spin" />
          <p>Running pivot query...</p>
        </div>
      ) : error ? (
        <div className="pivot-placeholder">
          <AlertTriangle size={24} />
          <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>
        </div>
      ) : pivotData.rows.length > 0 ? (
        <div className="pivot-grid ag-theme-quartz-dark">
          <AgGridProvider modules={[AllCommunityModule]}>
            <AgGridReact
              ref={gridRef}
              rowData={pivotData.rows}
              columnDefs={agColDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 80,
              }}
              animateRows
              domLayout="autoHeight"
              suppressMovableColumns={false}
              enableCellTextSelection
              ensureDomOrder
            />
          </AgGridProvider>
        </div>
      ) : (
        <div className="pivot-placeholder">
          <p>Drag fields into <strong>Rows</strong>, <strong>Columns</strong>, and <strong>Values</strong> to build your pivot table.</p>
        </div>
      )}
    </div>
  );
}
