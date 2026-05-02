import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Loader2, Settings2, GripVertical } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { toast } from "@/components/ui/Toast";
import { runQuery } from "@/lib/api";
import { formatKpiValue, buildKpiSql, aggLabel } from "@/lib/kpiUtils";
import KpiCardEditor from "./KpiCardEditor";
import type { KpiCard, KpiFormat } from "@/types/dashboard";

function useCountUp(
  target: number | null | undefined,
  format: KpiFormat,
  prefix?: string,
  suffix?: string,
  duration = 400,
): string {
  const [display, setDisplay] = useState(() => formatKpiValue(target, format, prefix, suffix));
  const rafRef = useRef(0);
  const prevRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (target == null) { setDisplay(formatKpiValue(null, format, prefix, suffix)); return; }

    const from = prevRef.current ?? 0;
    prevRef.current = target;
    if (from === target) { setDisplay(formatKpiValue(target, format, prefix, suffix)); return; }

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      setDisplay(formatKpiValue(current, format, prefix, suffix));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, format, prefix, suffix, duration]);

  return display;
}

interface Props {
  card: KpiCard;
}

function KpiAnimatedValue({ loading, card }: { loading: boolean; card: KpiCard }) {
  const display = useCountUp(card.value, card.format, card.prefix, card.suffix);
  return (
    <div className="kpi-card-value">
      {loading ? <Loader2 size={18} className="spin" /> : display}
    </div>
  );
}

export default function KpiCardItem({ card }: Props) {
  const { updateKpiCard, removeKpiCard, columns, selectedCatalog, selectedSchema, selectedTable, appliedFilters, filtersVersion, baseDataset, estimatedRowCount } = useStore();
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: card.id, data: { type: "kpi-sort" } });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);

  const isRowCount = card.column === "__row_count__" || card.column === "__row_number__";

  const isCustomQuery = useStore((s) => s.activeWorkspace?.datasource?.source_mode === "query");
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : null);
  const allCols = colKey ? (columns[colKey] ?? []) : [];

  useEffect(() => {
    if (!isRowCount) return;
    const count = estimatedRowCount ?? baseDataset?.rows.length ?? null;
    updateKpiCard(card.id, { value: count, loading: false });
  }, [isRowCount, baseDataset, estimatedRowCount, card.id, updateKpiCard]);

  const fetchValue = useCallback(async () => {
    if (!card.column || !card.table || isRowCount) return;
    setLoading(true);
    try {
      const resolvedTable = useStore.getState().effectiveTableRef() ?? card.table;
      const bf = useStore.getState().activeWorkspace?.datasource?.base_filters;
      const sql = buildKpiSql(resolvedTable, card.column, card.aggregation, bf, appliedFilters);
      const result = await runQuery(sql, 1);
      const raw = result.rows[0]?.[0];
      updateKpiCard(card.id, { value: raw != null ? Number(raw) : null, loading: false });
    } catch {
      updateKpiCard(card.id, { value: null, loading: false });
      toast.error("Failed to load KPI data");
    } finally {
      setLoading(false);
    }
  }, [card.column, card.table, card.aggregation, card.id, updateKpiCard, appliedFilters, isRowCount]);

  useEffect(() => {
    if (isRowCount) return;
    if (card.column && card.table) {
      fetchValue();
    }
  }, [card.column, card.table, fetchValue, filtersVersion, isRowCount]);

  useEffect(() => {
    if (editing) setTitle(card.title);
  }, [editing, card.title]);

  const portalTarget = document.getElementById("themed-portal") ?? document.body;

  const sortStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div className="kpi-card" ref={setNodeRef} style={sortStyle} {...attributes}>
      <button
        className="kpi-card-drag"
        {...listeners}
        title="Drag to reorder"
      >
        <GripVertical size={11} />
      </button>
      <button className="kpi-card-remove" onClick={() => removeKpiCard(card.id)} title="Remove">
        <X size={11} />
      </button>

      <div className="kpi-card-top-row">
        <button className="kpi-card-gear" onClick={() => setEditing(true)} title="Configure KPI">
          <Settings2 size={12} />
        </button>
        <span className="kpi-card-agg-badge" title={`${aggLabel(card.aggregation)} of ${card.column}`}>
          {aggLabel(card.aggregation)}
        </span>
      </div>

      <KpiAnimatedValue loading={loading} card={card} />

      <div className="kpi-card-label" title={card.title}>{card.title}</div>

      {editing && createPortal(
        <div className="kpi-modal-backdrop" onClick={() => setEditing(false)}>
          <div className="kpi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kpi-modal-header">
              <h3 className="kpi-modal-title">Configure KPI</h3>
              <button className="kpi-modal-close" onClick={() => setEditing(false)}>
                <X size={16} />
              </button>
            </div>
            <KpiCardEditor
              card={card}
              columns={allCols}
              title={title}
              setTitle={setTitle}
              onRefresh={() => { fetchValue(); setEditing(false); }}
              onColumnReset={() => {}}
            />
          </div>
        </div>,
        portalTarget,
      )}
    </div>
  );
}
