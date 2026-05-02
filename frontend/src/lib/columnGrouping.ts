import type { ColumnMeta } from "@/types/dashboard";
import { NUMERIC_RE } from "./constants";

export interface ColumnSubGroup {
  dimensions: ColumnMeta[];
  measures: ColumnMeta[];
}

export interface PrefixGroup {
  prefix: string;
  label: string;
  sub: ColumnSubGroup;
  allNames: string[];
}

function extractPrefix(name: string): string {
  const parts = name.split(/[_.]/).filter(Boolean);
  return parts.length > 1 ? parts[0].toLowerCase() : "";
}

/**
 * Groups columns by their name prefix (first token before `_` or `.`),
 * then sub-groups each into dimensions and measures.
 * Prefixes with fewer than `minGroupSize` members are merged into "other".
 */
export function groupColumnsByPrefix(
  cols: ColumnMeta[],
  minGroupSize = 2,
): PrefixGroup[] {
  const buckets = new Map<string, ColumnMeta[]>();

  for (const col of cols) {
    const pfx = extractPrefix(col.col_name);
    const key = pfx || "__solo__";
    const arr = buckets.get(key);
    if (arr) arr.push(col);
    else buckets.set(key, [col]);
  }

  const groups: PrefixGroup[] = [];
  const otherCols: ColumnMeta[] = [];

  for (const [key, members] of buckets) {
    if (key === "__solo__" || members.length < minGroupSize) {
      otherCols.push(...members);
    } else {
      groups.push(buildGroup(key, members));
    }
  }

  groups.sort((a, b) => a.prefix.localeCompare(b.prefix));

  if (otherCols.length > 0) {
    groups.push(buildGroup("other", otherCols));
  }

  return groups;
}

function buildGroup(prefix: string, members: ColumnMeta[]): PrefixGroup {
  const dimensions: ColumnMeta[] = [];
  const measures: ColumnMeta[] = [];
  const allNames: string[] = [];

  for (const col of members) {
    allNames.push(col.col_name);
    if (NUMERIC_RE.test(col.data_type)) measures.push(col);
    else dimensions.push(col);
  }

  return {
    prefix,
    label: prefix === "other" ? "Other" : prefix.charAt(0).toUpperCase() + prefix.slice(1),
    sub: { dimensions, measures },
    allNames,
  };
}
