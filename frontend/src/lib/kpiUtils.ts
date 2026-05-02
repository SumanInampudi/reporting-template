import type { Aggregation, KpiFormat } from "@/types/dashboard";

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

export function buildKpiSql(table: string, column: string, aggregation: Aggregation): string {
  const parts = table.split(".");
  const qt = parts.length === 3
    ? `\`${parts[0]}\`.\`${parts[1]}\`.\`${parts[2]}\``
    : table;
  const aggExpr = aggregation === "COUNT_DISTINCT"
    ? `COUNT(DISTINCT \`${column}\`)`
    : `${aggregation}(\`${column}\`)`;
  return `SELECT ${aggExpr} AS val FROM ${qt}`;
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
