import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import KpiCardItem from "./KpiCardItem";

export default function KpiStrip() {
  const { kpiCards } = useStore();

  const { setNodeRef, isOver } = useDroppable({
    id: "kpi-strip-drop",
    data: { type: "kpi-strip" },
  });

  const kpiIds = kpiCards.map((c) => c.id);

  return (
    <div className={`kpi-strip${isOver ? " kpi-strip--drop-hover" : ""}`} ref={setNodeRef}>
      <SortableContext items={kpiIds} strategy={horizontalListSortingStrategy}>
        {kpiCards.map((card) => (
          <KpiCardItem key={card.id} card={card} />
        ))}
      </SortableContext>
      <div className="kpi-drop-hint">
        <Plus size={14} />
        <span>{kpiCards.length === 0 ? "Drop a column here to add KPI" : "Drop column"}</span>
      </div>
    </div>
  );
}
