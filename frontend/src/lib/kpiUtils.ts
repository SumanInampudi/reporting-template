import type { Aggregation, BaseFilter, FilterItem, KpiFormat } from "@/types/dashboard";
import { buildBaseFilterClauses, quoteTableRef } from "./sqlBuilder";
import { buildWhereClause } from "./chartBuilder";

export const AGG_OPTIONS: { id: Aggregation; label: string }[] = [
  { id: "SUM", label: "SUM" },
  { id: "AVG", label: "AVG" },
  { id: "COUNT", label: "COUNT" },
  { id: "COUNT_DISTINCT", label: "DISTINCT" },
  { id: "MIN", label: "MIN" },
  { id: "MAX", label: "MAX" },
];

export const FMT_OPTIONS: { id: KpiFormat; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "number", label: "Number" },
  { id: "currency", label: "Currency" },
  { id: "percent", label: "Percent" },
];

export function formatKpiValue(
  val: number | null | undefined,
  fmt: KpiFormat,
  prefix?: string,
  suffix?: string,
): string {
  if (val == null) return "—";
  let out: string;
  if (fmt === "compact") {
    if (Math.abs(val) >= 1_000_000_000) out = `${(val / 1_000_000_000).toFixed(1)}B`;
    else if (Math.abs(val) >= 1_000_000) out = `${(val / 1_000_000).toFixed(1)}M`;
    else if (Math.abs(val) >= 1_000) out = `${(val / 1_000).toFixed(1)}K`;
    else out = val.toFixed(val % 1 ? 2 : 0);
  } else if (fmt === "currency") {
    out = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (fmt === "percent") {
    out = `${(val * 100).toFixed(1)}%`;
  } else {
    out = val.toLocaleString();
  }
  return `${prefix ?? ""}${out}${suffix ?? ""}`;
}

export function buildKpiSql(table: string, column: string, aggregation: Aggregation, baseFilters?: BaseFilter[], filters?: FilterItem[]): string {
  const qt = quoteTableRef(table);
  const isRowCount = column === "__row_count__" || column === "__row_number__";
  const aggExpr = isRowCount
    ? "COUNT(*)"
    : aggregation === "COUNT_DISTINCT"
      ? `COUNT(DISTINCT \`${column}\`)`
      : `${aggregation}(\`${column}\`)`;
  const allWhereParts: string[] = [...buildBaseFilterClauses(baseFilters)];
  if (filters && filters.length > 0) {
    const userWhere = buildWhereClause(filters, table);
    if (userWhere) allWhereParts.push(userWhere.replace(/^WHERE\s+/, ""));
  }
  const where = allWhereParts.length > 0 ? ` WHERE ${allWhereParts.join(" AND ")}` : "";
  return `SELECT ${aggExpr} AS val FROM ${qt}${where}`;
}

export function aggLabel(agg: Aggregation): string {
  return agg === "COUNT_DISTINCT" ? "DISTINCT" : agg;
}

export function isNumericType(dataType: string): boolean {
  return /int|float|double|decimal|number|bigint/i.test(dataType);
}

export function humanizeColumn(col: string): string {
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
