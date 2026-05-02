import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Loader2, Settings2, GripVertical } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { runQuery } from "@/lib/api";
import { formatKpiValue, buildKpiSql, aggLabel } from "@/lib/kpiUtils";
import KpiCardEditor from "./KpiCardEditor";
import type { KpiCard } from "@/types/dashboard";

interface Props {
  card: KpiCard;
}

export default function KpiCardItem({ card }: Props) {
  const { updateKpiCard, removeKpiCard, columns, selectedCatalog, selectedSchema, selectedTable } = useStore();
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: card.id, data: { type: "kpi-sort" } });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const fetchedRef = useRef(false);

  const colKey = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
    : null;
  const allCols = colKey ? (columns[colKey] ?? []) : [];

  const fetchValue = useCallback(async () => {
    if (!card.column || !card.table) return;
    setLoading(true);
    try {
      const sql = buildKpiSql(card.table, card.column, card.aggregation);
      const result = await runQuery(sql, 1);
      const raw = result.rows[0]?.[0];
      updateKpiCard(card.id, { value: raw != null ? Number(raw) : null, loading: false });
    } catch {
      updateKpiCard(card.id, { value: null, loading: false });
    } finally {
      setLoading(false);
    }
  }, [card.column, card.table, card.aggregation, card.id, updateKpiCard]);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (card.column && card.table) {
      fetchedRef.current = true;
      fetchValue();
    }
  }, [card.column, card.table, fetchValue]);

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

      <div className="kpi-card-value">
        {loading
          ? <Loader2 size={18} className="spin" />
          : formatKpiValue(card.value, card.format, card.prefix, card.suffix)}
      </div>

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
              onRefresh={() => { fetchedRef.current = false; fetchValue(); setEditing(false); }}
              onColumnReset={() => { fetchedRef.current = false; }}
            />
          </div>
        </div>,
        portalTarget,
      )}
    </div>
  );
}
