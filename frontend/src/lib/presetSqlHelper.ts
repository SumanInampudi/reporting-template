import { useStore } from "@/hooks/useStore";
import { buildLoadSql } from "./sqlBuilder";

/**
 * Generate the data SQL for the current workspace state.
 * Used when saving/updating presets so the query is persisted for subscriptions.
 */
export function buildPresetSql(): string | null {
  const s = useStore.getState();
  const { selectedCatalog, selectedSchema, selectedTable, selectedOutputColumns, formulaColumns, sharedFormulas, filters, dynamicFilters } = s;

  const fqTable =
    selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : null;

  if (!fqTable || selectedOutputColumns.length === 0) return null;

  const sfAsFc = sharedFormulas.map((sf) => ({
    id: sf.id, alias: sf.alias, expression: sf.expression, dataType: sf.data_type,
  }));
  const allFc = [...formulaColumns, ...sfAsFc];
  const limit = s.effectiveRowLimit();
  const aggs = s.activeWorkspace?.column_aggregations;
  return buildLoadSql(fqTable, selectedOutputColumns, allFc, filters, dynamicFilters, limit, aggs);
}
