/**
 * Resolves columns into display groups based on workspace config.
 * - "measures_dimensions" (default): split by numeric vs non-numeric data type.
 * - "custom": match columns against glob-style patterns from the config,
 *   remaining columns fall into an "Other" group.
 */

import type { ColumnGroupConfig, ColumnGroupDef, ColumnMeta } from "@/types/dashboard";
import { NUMERIC_RE } from "./constants";

export interface ResolvedGroup {
  key: string;
  label: string;
  columns: ColumnMeta[];
  isNumeric?: boolean;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesAny(name: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(name));
}

function buildCustomGroups(
  allCols: ColumnMeta[],
  defs: ColumnGroupDef[],
): ResolvedGroup[] {
  const assigned = new Set<string>();
  const groups: ResolvedGroup[] = [];

  for (const def of defs) {
    const matched = allCols.filter(
      (c) => !assigned.has(c.col_name) && matchesAny(c.col_name, def.patterns),
    );
    for (const c of matched) assigned.add(c.col_name);
    groups.push({
      key: def.name,
      label: def.name,
      columns: matched,
    });
  }

  const remaining = allCols.filter((c) => !assigned.has(c.col_name));
  if (remaining.length > 0) {
    groups.push({ key: "__other__", label: "Other", columns: remaining });
  }

  return groups;
}

function buildMeasuresDimensions(allCols: ColumnMeta[]): ResolvedGroup[] {
  const dims = allCols.filter((c) => !NUMERIC_RE.test(c.data_type));
  const meas = allCols.filter((c) => NUMERIC_RE.test(c.data_type));
  const groups: ResolvedGroup[] = [];
  if (dims.length > 0) groups.push({ key: "dimensions", label: "Dimensions", columns: dims, isNumeric: false });
  if (meas.length > 0) groups.push({ key: "measures", label: "Measures", columns: meas, isNumeric: true });
  return groups;
}

export function resolveColumnGroups(
  allCols: ColumnMeta[],
  config?: ColumnGroupConfig,
): ResolvedGroup[] {
  if (!config || config.mode === "measures_dimensions") {
    return buildMeasuresDimensions(allCols);
  }
  return buildCustomGroups(allCols, config.groups ?? []);
}

export function previewPatternMatches(
  columns: string[],
  patterns: string[],
): string[] {
  return columns.filter((c) => matchesAny(c, patterns));
}

/* ── Auto-detect groups from column name prefixes ── */

export interface SuggestedGroup {
  name: string;
  pattern: string;
  columns: string[];
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/**
 * Analyze column names and detect common prefix groups.
 * Uses a greedy longest-prefix strategy:
 *   1. For each column, build all possible prefixes (split by `_`)
 *   2. Count columns sharing each prefix
 *   3. For each column, pick the longest prefix with >= minGroupSize members
 *   4. Deduplicate into groups, generate patterns and human labels
 */
export function detectColumnGroups(
  columns: string[],
  minGroupSize = 2,
): SuggestedGroup[] {
  const prefixCounts = new Map<string, Set<string>>();

  for (const col of columns) {
    const parts = col.split("_");
    for (let depth = 1; depth < parts.length; depth++) {
      const prefix = parts.slice(0, depth).join("_");
      let set = prefixCounts.get(prefix);
      if (!set) { set = new Set(); prefixCounts.set(prefix, set); }
      set.add(col);
    }
  }

  const assigned = new Set<string>();
  const groupMap = new Map<string, string[]>();
  const groupOrder: string[] = [];

  const sorted = columns.slice().sort();

  for (const col of sorted) {
    if (assigned.has(col)) continue;

    const parts = col.split("_");
    let bestPrefix = "";
    for (let depth = parts.length - 1; depth >= 1; depth--) {
      const prefix = parts.slice(0, depth).join("_");
      const members = prefixCounts.get(prefix);
      if (members && members.size >= minGroupSize) {
        bestPrefix = prefix;
        break;
      }
    }

    if (!bestPrefix) continue;

    if (!groupMap.has(bestPrefix)) {
      groupMap.set(bestPrefix, []);
      groupOrder.push(bestPrefix);
    }

    const members = prefixCounts.get(bestPrefix)!;
    for (const m of members) {
      if (!assigned.has(m)) {
        assigned.add(m);
        groupMap.get(bestPrefix)!.push(m);
      }
    }
  }

  return groupOrder.map((prefix) => ({
    name: titleCase(prefix),
    pattern: `${prefix}_*`,
    columns: groupMap.get(prefix)!,
  }));
}
