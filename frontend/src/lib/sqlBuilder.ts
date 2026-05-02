import { buildAllDynamicFiltersWhere } from "./dynamicFilterSql";
import type { ColumnAggregation, DynamicFilter, FilterItem, FormulaColumn, SharedFormulaColumn } from "@/types/dashboard";

/**
 * Build a COUNT(*) query that mirrors the actual data query shape.
 * When aggregations are active, wraps a grouped subquery so the count
 * reflects the number of grouped rows (not raw table rows).
 */
export function buildCountSql(
  table: string,
  filters: FilterItem[],
  dynamicFilters: DynamicFilter[],
  outputCols?: string[],
  aggregations?: Record<string, ColumnAggregation>,
): string {
  const clauses = buildWhereClauses(table, filters, dynamicFilters);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  if (outputCols && outputCols.length > 0) {
    const selectParts: string[] = [];
    for (const col of outputCols) {
      if (col.startsWith("__fc__") || col.startsWith("__sf__")) continue;
      const agg = aggregations?.[col];
      if (agg && agg !== "NONE") {
        const expr = agg === "COUNT_DISTINCT"
          ? `COUNT(DISTINCT \`${col}\`)`
          : `${agg}(\`${col}\`)`;
        selectParts.push(`${expr} AS \`${col}\``);
      } else {
        selectParts.push(`\`${col}\``);
      }
    }
    const inner = [
      `SELECT ${selectParts.join(", ")}`,
      `FROM ${table}`,
      where,
      "GROUP BY ALL",
    ].filter(Boolean).join("\n");
    return `SELECT COUNT(*) AS cnt FROM (\n${inner}\n) _grouped`;
  }

  const parts = [`SELECT COUNT(*) AS cnt`, `FROM ${table}`];
  if (where) parts.push(where);
  return parts.join("\n");
}


function buildWhereClauses(
  table: string,
  filters: FilterItem[],
  dynamicFilters: DynamicFilter[],
): string[] {
  const clauses: string[] = [];
  for (const f of filters) {
    if (f.table !== table) continue;

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
        clauses.push(`${col} BETWEEN ${f.numericValue} AND ${f.numericValue2}`);
      } else if (op !== "between") {
        clauses.push(`${col} ${op} ${f.numericValue}`);
      }
      continue;
    }

    if (f.selectedValues.length === 0) continue;
    if (f.values.length > 0 && f.selectedValues.length >= f.values.length) continue;
    const col = `\`${f.column}\``;
    const escaped = f.selectedValues.map((v) => `'${v.replace(/'/g, "''")}'`);
    if (f.mode === "single" || f.selectedValues.length === 1) {
      clauses.push(`${col} = ${escaped[0]}`);
    } else {
      clauses.push(`${col} IN (${escaped.join(", ")})`);
    }
  }

  const dynWhere = buildAllDynamicFiltersWhere(dynamicFilters);
  if (dynWhere) clauses.push(dynWhere);

  return clauses;
}

export function buildLoadSql(
  table: string,
  outputCols: string[],
  formulaCols: FormulaColumn[],
  filters: FilterItem[],
  dynamicFilters: DynamicFilter[],
  limit = 0,
  aggregations?: Record<string, ColumnAggregation>,
): string {
  const fcMap = new Map<string, FormulaColumn>();
  for (const fc of formulaCols) {
    fcMap.set(`__fc__${fc.id}__${fc.alias}`, fc);
    fcMap.set(`__sf__${fc.id}__${fc.alias}`, fc);
  }

  let hasRealAgg = false;
  const selectParts: string[] = [];

  for (const col of outputCols) {
    const fc = fcMap.get(col);
    const agg = aggregations?.[col];
    if (fc) {
      selectParts.push(`(${fc.expression}) AS \`${fc.alias}\``);
    } else if (agg && agg !== "NONE") {
      const aggExpr = agg === "COUNT_DISTINCT"
        ? `COUNT(DISTINCT \`${col}\`)`
        : `${agg}(\`${col}\`)`;
      selectParts.push(`${aggExpr} AS \`${col}\``);
      hasRealAgg = true;
    } else {
      selectParts.push(`\`${col}\``);
    }
  }

  const cols = selectParts.length > 0 ? selectParts.join(", ") : "*";
  const parts = [`SELECT ${cols}`, `FROM ${table}`];

  const clauses = buildWhereClauses(table, filters, dynamicFilters);
  if (clauses.length > 0) parts.push(`WHERE ${clauses.join(" AND ")}`);
  parts.push("GROUP BY ALL");
  if (limit > 0) parts.push(`LIMIT ${limit}`);
  return parts.join("\n");
}
