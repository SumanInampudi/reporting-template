import { buildAllDynamicFiltersWhere } from "./dynamicFilterSql";
import type { BaseFilter, ColumnAggregation, DynamicFilter, FilterItem, FormulaColumn, JoinConfig, SharedFormulaColumn } from "@/types/dashboard";

export function buildBaseFilterClauses(baseFilters?: BaseFilter[]): string[] {
  if (!baseFilters || baseFilters.length === 0) return [];
  const clauses: string[] = [];
  for (const bf of baseFilters) {
    if (bf.mode === "query") {
      const expr = bf.queryExpression?.trim();
      if (expr) clauses.push(`(${expr})`);
      continue;
    }
    if (!bf.column || bf.values.length === 0 || bf.values.every((v) => v === "")) continue;
    const col = `\`${bf.column}\``;
    const escaped = bf.values.map((v) => `'${v.replace(/'/g, "''")}'`);
    switch (bf.operator) {
      case "=":
        clauses.push(`${col} = ${escaped[0]}`);
        break;
      case "!=":
        clauses.push(`${col} != ${escaped[0]}`);
        break;
      case "IN":
        clauses.push(`${col} IN (${escaped.join(", ")})`);
        break;
      case "NOT IN":
        clauses.push(`${col} NOT IN (${escaped.join(", ")})`);
        break;
      case ">": case "<": case ">=": case "<=":
        clauses.push(`${col} ${bf.operator} ${escaped[0]}`);
        break;
      case "BETWEEN":
        if (escaped.length >= 2) clauses.push(`${col} BETWEEN ${escaped[0]} AND ${escaped[1]}`);
        break;
      case "LIKE":
        clauses.push(`${col} LIKE '%${bf.values[0].replace(/'/g, "''")}%'`);
        break;
    }
  }
  return clauses;
}

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
  joinCtx?: SmartJoinContext,
  baseFilters?: BaseFilter[],
): string {
  const neededTables = resolveNeededTables(table, outputCols ?? [], filters, joinCtx);
  const useJoin = joinCtx && neededTables.size > 1;

  const fromClause = useJoin
    ? buildFromWithJoins(table, joinCtx!.joins, neededTables, joinCtx!.catalog, joinCtx!.schema)
    : quoteTableRef(table);

  const allFilterTables = useJoin ? [...neededTables] : [table];
  const clauses: string[] = [...buildBaseFilterClauses(baseFilters)];
  for (const ft of allFilterTables) {
    clauses.push(...buildWhereClauses(ft, filters, dynamicFilters));
  }
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
      `FROM ${fromClause}`,
      where,
      "GROUP BY ALL",
    ].filter(Boolean).join("\n");
    return `SELECT COUNT(*) AS cnt FROM (\n${inner}\n) _grouped`;
  }

  const parts = [`SELECT COUNT(*) AS cnt`, `FROM ${fromClause}`];
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

    if (f.filterType === "free_text") {
      const vals = f.freeTextValues ?? [];
      if (vals.length === 0) continue;
      const caseSensitive = f.freeTextCaseSensitive ?? false;
      const col = `\`${f.column}\``;
      const colExpr = caseSensitive ? col : `UPPER(${col})`;
      const parts: string[] = [];
      const exactVals: string[] = [];
      for (const v of vals) {
        const normalized = caseSensitive ? v : v.toUpperCase();
        const escaped = normalized.replace(/'/g, "''");
        if (v.includes("*")) {
          parts.push(`${colExpr} LIKE '${escaped.replace(/\*/g, "%")}'`);
        } else {
          exactVals.push(`'${escaped}'`);
        }
      }
      if (exactVals.length === 1) {
        parts.push(`${colExpr} = ${exactVals[0]}`);
      } else if (exactVals.length > 1) {
        parts.push(`${colExpr} IN (${exactVals.join(", ")})`);
      }
      if (parts.length === 1) {
        clauses.push(parts[0]);
      } else {
        clauses.push(`(${parts.join(" OR ")})`);
      }
      continue;
    }

    if (f.selectedValues.length === 0) continue;
    if (f.values.length > 0 && f.selectedValues.length >= f.values.length) continue;
    const col = f.formulaExpression ? `(${f.formulaExpression})` : `\`${f.column}\``;
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

/** Backtick-quote a `catalog.schema.table` reference. Subqueries (starting with `(`) pass through unchanged. */
export function quoteTableRef(fqName: string): string {
  if (fqName.startsWith("(")) return fqName;
  const parts = fqName.split(".");
  return parts.length === 3
    ? `\`${parts[0]}\`.\`${parts[1]}\`.\`${parts[2]}\``
    : fqName;
}

function quoteTable(fqName: string): string {
  return quoteTableRef(fqName);
}

function buildFromWithJoins(
  primaryTable: string,
  joins: JoinConfig[],
  neededTables: Set<string>,
  catalog: string,
  schema: string,
): string {
  const parts = [quoteTable(primaryTable)];
  for (const j of joins) {
    if (!j.table || !j.leftKey || !j.rightKey) continue;
    const fq = `${catalog}.${schema}.${j.table}`;
    if (!neededTables.has(fq)) continue;
    const qRight = quoteTable(fq);
    parts.push(
      `${j.joinType} JOIN ${qRight} ON ${quoteTable(primaryTable)}.\`${j.leftKey}\` = ${qRight}.\`${j.rightKey}\``,
    );
  }
  return parts.join("\n");
}

export interface SmartJoinContext {
  joins: JoinConfig[];
  columnTableMap: Record<string, string>;
  catalog: string;
  schema: string;
}

function resolveNeededTables(
  primaryTable: string,
  outputCols: string[],
  filters: FilterItem[],
  ctx?: SmartJoinContext,
): Set<string> {
  const needed = new Set<string>([primaryTable]);
  if (!ctx || ctx.joins.length === 0) return needed;

  for (const col of outputCols) {
    if (col.startsWith("__fc__") || col.startsWith("__sf__")) continue;
    const t = ctx.columnTableMap[col];
    if (t && t !== primaryTable) needed.add(t);
  }
  for (const f of filters) {
    if (f.selectedValues.length > 0 || f.dateFrom || f.dateTo || f.numericValue !== undefined || (f.freeTextValues && f.freeTextValues.length > 0)) {
      const t = ctx.columnTableMap[f.column];
      if (t && t !== primaryTable) needed.add(t);
    }
  }
  return needed;
}

export function buildLoadSql(
  table: string,
  outputCols: string[],
  formulaCols: FormulaColumn[],
  filters: FilterItem[],
  dynamicFilters: DynamicFilter[],
  limit = 0,
  aggregations?: Record<string, ColumnAggregation>,
  joinCtx?: SmartJoinContext,
  baseFilters?: BaseFilter[],
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
  const neededTables = resolveNeededTables(table, outputCols, filters, joinCtx);
  const useJoin = joinCtx && neededTables.size > 1;

  const fromClause = useJoin
    ? buildFromWithJoins(table, joinCtx!.joins, neededTables, joinCtx!.catalog, joinCtx!.schema)
    : quoteTableRef(table);

  const parts = [`SELECT ${cols}`, `FROM ${fromClause}`];

  const allFilterTables = useJoin ? [...neededTables] : [table];
  const clauses: string[] = [...buildBaseFilterClauses(baseFilters)];
  for (const ft of allFilterTables) {
    clauses.push(...buildWhereClauses(ft, filters, dynamicFilters));
  }
  if (clauses.length > 0) parts.push(`WHERE ${clauses.join(" AND ")}`);
  parts.push("GROUP BY ALL");
  if (limit > 0) parts.push(`LIMIT ${limit}`);
  return parts.join("\n");
}
