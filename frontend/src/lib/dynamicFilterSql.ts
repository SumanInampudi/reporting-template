import type { DynamicFilter, FilterCondition, FilterGroup } from "@/types/dashboard";

function escLiteral(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function buildConditionSql(c: FilterCondition): string | null {
  if (!c.column) return null;

  const lhs = `\`${c.column}\``;

  if (c.operator === "IS NULL") return `${lhs} IS NULL`;
  if (c.operator === "IS NOT NULL") return `${lhs} IS NOT NULL`;

  const rhs = c.valueType === "column" ? `\`${c.value}\`` : escLiteral(c.value);

  if (!c.value && c.valueType === "literal") return null;
  if (!c.value && c.valueType === "column") return null;

  if (c.operator === "BETWEEN") {
    if (!c.value2 && c.valueType === "literal") return null;
    const rhs2 = c.valueType === "column" ? `\`${c.value2}\`` : escLiteral(c.value2);
    return `${lhs} BETWEEN ${rhs} AND ${rhs2}`;
  }

  if (c.operator === "IN" || c.operator === "NOT IN") {
    const vals = c.value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (vals.length === 0) return null;
    const list = c.valueType === "column"
      ? vals.map((v) => `\`${v}\``).join(", ")
      : vals.map((v) => escLiteral(v)).join(", ");
    return `${lhs} ${c.operator} (${list})`;
  }

  return `${lhs} ${c.operator} ${rhs}`;
}

function buildGroupSql(g: FilterGroup): string | null {
  const parts: string[] = [];
  for (const c of g.conditions) {
    const sql = buildConditionSql(c);
    if (sql) parts.push(sql);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `(${parts.join(` ${g.join} `)})`;
}

export function buildDynamicFilterWhere(filter: DynamicFilter): string | null {
  if (!filter.enabled) return null;
  const parts: string[] = [];
  for (const g of filter.groups) {
    const sql = buildGroupSql(g);
    if (sql) parts.push(sql);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `(${parts.join(` ${filter.rootJoin} `)})`;
}

export function buildAllDynamicFiltersWhere(filters: DynamicFilter[]): string | null {
  const parts: string[] = [];
  for (const f of filters) {
    const sql = buildDynamicFilterWhere(f);
    if (sql) parts.push(sql);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts.join(" AND ");
}

export function summarizeDynamicFilter(filter: DynamicFilter): string {
  const groupSummaries: string[] = [];
  for (const g of filter.groups) {
    const condStrs: string[] = [];
    for (const c of g.conditions) {
      if (!c.column) continue;
      if (c.operator === "IS NULL" || c.operator === "IS NOT NULL") {
        condStrs.push(`${c.column} ${c.operator}`);
      } else if (c.operator === "BETWEEN") {
        const rhs = c.valueType === "column" ? c.value : `'${c.value}'`;
        const rhs2 = c.valueType === "column" ? c.value2 : `'${c.value2}'`;
        condStrs.push(`${c.column} BETWEEN ${rhs} AND ${rhs2}`);
      } else {
        const rhs = c.valueType === "column" ? c.value : `'${c.value}'`;
        condStrs.push(`${c.column} ${c.operator} ${rhs}`);
      }
    }
    if (condStrs.length > 0) {
      groupSummaries.push(condStrs.join(` ${g.join} `));
    }
  }
  if (groupSummaries.length === 0) return "(empty)";
  return groupSummaries.join(` ${filter.rootJoin} `);
}
