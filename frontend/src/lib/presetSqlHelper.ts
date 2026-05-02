import { useStore } from "@/hooks/useStore";
import { buildLoadSql } from "./sqlBuilder";

/**
 * Generate the data SQL for the current workspace state.
 * Used when saving/updating presets so the query is persisted for subscriptions.
 */
export function buildPresetSql(): string | null {
  const s = useStore.getState();
  const { selectedOutputColumns, formulaColumns, sharedFormulas, filters, dynamicFilters } = s;

  const fqTable = s.effectiveTableRef();
  if (!fqTable || selectedOutputColumns.length === 0) return null;

  const sfAsFc = sharedFormulas.map((sf) => ({
    id: sf.id, alias: sf.alias, expression: sf.expression, dataType: sf.data_type,
  }));
  const allFc = [...formulaColumns, ...sfAsFc];
  const limit = s.effectiveRowLimit();
  const aggs = s.resolvedAggregations();
  const bf = s.activeWorkspace?.datasource?.base_filters;
  return buildLoadSql(fqTable, selectedOutputColumns, allFc, filters, dynamicFilters, limit, aggs, undefined, bf);
}
