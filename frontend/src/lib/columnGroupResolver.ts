/**
 * Resolves columns into display groups based on workspace config.
 *
 * Two-level hierarchy:
 *   Level 1 – always "Dimensions" and "Measures" (split by data type).
 *   Level 2 – optional admin-configured sub-categories within each.
 *
 * The flat `resolveColumnGroups` is kept for backward compatibility; it now
 * delegates to the hierarchical resolver and flattens the result.
 */

import type { ColumnGroupConfig, ColumnGroupDef, ColumnMeta } from "@/types/dashboard";
import { NUMERIC_RE } from "./constants";

export interface ResolvedGroup {
  key: string;
  label: string;
  columns: ColumnMeta[];
  isNumeric?: boolean;
}

export interface ResolvedLevel1Group {
  key: "dimensions" | "measures";
  label: string;
  isNumeric: boolean;
  allColumns: ColumnMeta[];
  subGroups: ResolvedGroup[];
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
    const explicitSet = new Set(def.columns ?? []);
    const matched = allCols.filter(
      (c) => !assigned.has(c.col_name) && (matchesAny(c.col_name, def.patterns) || explicitSet.has(c.col_name)),
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

/* ── Hierarchical (two-level) resolver ───────────────────── */

export function resolveColumnGroupsHierarchical(
  allCols: ColumnMeta[],
  config?: ColumnGroupConfig,
): ResolvedLevel1Group[] {
  const dims = allCols.filter((c) => !NUMERIC_RE.test(c.data_type));
  const meas = allCols.filter((c) => NUMERIC_RE.test(c.data_type));

  const dimSubDefs = config?.dimensionGroups;
  const meaSubDefs = config?.measureGroups;

  const dimSubGroups: ResolvedGroup[] =
    dimSubDefs && dimSubDefs.length > 0
      ? buildCustomGroups(dims, dimSubDefs)
      : dims.length > 0
        ? [{ key: "dimensions", label: "Dimensions", columns: dims, isNumeric: false }]
        : [];

  const meaSubGroups: ResolvedGroup[] =
    meaSubDefs && meaSubDefs.length > 0
      ? buildCustomGroups(meas, meaSubDefs)
      : meas.length > 0
        ? [{ key: "measures", label: "Measures", columns: meas, isNumeric: true }]
        : [];

  return [
    {
      key: "dimensions",
      label: "Dimensions",
      isNumeric: false,
      allColumns: dims,
      subGroups: dimSubGroups,
    },
    {
      key: "measures",
      label: "Measures",
      isNumeric: true,
      allColumns: meas,
      subGroups: meaSubGroups,
    },
  ];
}

/* ── Flat resolver (backward compat) ─────────────────────── */

export function resolveColumnGroups(
  allCols: ColumnMeta[],
  config?: ColumnGroupConfig,
): ResolvedGroup[] {
  if (config?.mode === "custom" && config.groups?.length && !config.dimensionGroups && !config.measureGroups) {
    return buildCustomGroups(allCols, config.groups);
  }

  const hierarchy = resolveColumnGroupsHierarchical(allCols, config);
  const flat: ResolvedGroup[] = [];
  for (const level1 of hierarchy) {
    if (level1.allColumns.length === 0) continue;
    for (const sub of level1.subGroups) {
      flat.push({ ...sub, isNumeric: level1.isNumeric });
    }
  }
  return flat;
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
 * Detect groups by a shared affix (prefix OR suffix).
 * Returns candidate groups keyed by the affix string with a pattern and member set.
 */
function detectAffix(
  cols: string[],
  mode: "prefix" | "suffix",
  minGroupSize: number,
): { key: string; pattern: string; name: string; members: string[] }[] {
  const affixCounts = new Map<string, Set<string>>();

  for (const col of cols) {
    const parts = col.split("_");
    for (let depth = 1; depth < parts.length; depth++) {
      const affix = mode === "prefix"
        ? parts.slice(0, depth).join("_")
        : parts.slice(parts.length - depth).join("_");
      let set = affixCounts.get(affix);
      if (!set) { set = new Set(); affixCounts.set(affix, set); }
      set.add(col);
    }
  }

  const assigned = new Set<string>();
  const groupMap = new Map<string, string[]>();
  const groupOrder: string[] = [];
  const sorted = cols.slice().sort();

  for (const col of sorted) {
    if (assigned.has(col)) continue;
    const parts = col.split("_");
    let bestAffix = "";
    for (let depth = parts.length - 1; depth >= 1; depth--) {
      const affix = mode === "prefix"
        ? parts.slice(0, depth).join("_")
        : parts.slice(parts.length - depth).join("_");
      const members = affixCounts.get(affix);
      if (members && members.size >= minGroupSize) {
        bestAffix = affix;
        break;
      }
    }
    if (!bestAffix) continue;
    if (!groupMap.has(bestAffix)) {
      groupMap.set(bestAffix, []);
      groupOrder.push(bestAffix);
    }
    const members = affixCounts.get(bestAffix)!;
    for (const m of members) {
      if (!assigned.has(m)) {
        assigned.add(m);
        groupMap.get(bestAffix)!.push(m);
      }
    }
  }

  return groupOrder.map((affix) => ({
    key: `${mode}:${affix}`,
    pattern: mode === "prefix" ? `${affix}_*` : `*_${affix}`,
    name: titleCase(affix),
    members: groupMap.get(affix)!,
  }));
}

/**
 * Analyze column names and detect common prefix AND suffix groups.
 *
 * Strategy:
 *   1. Run prefix detection (e.g. order_*) and suffix detection (e.g. *_amt)
 *   2. Merge both candidate lists, preferring whichever affix captures more
 *      columns for each column. De-duplicate so no column appears in two groups.
 *   3. Return at most 10 groups sorted by member count descending.
 */
export function detectColumnGroups(
  columns: string[],
  minGroupSize = 2,
  subset?: string[],
): SuggestedGroup[] {
  const cols = subset && subset.length > 0
    ? columns.filter((c) => subset.includes(c))
    : columns;

  const prefixGroups = detectAffix(cols, "prefix", minGroupSize);
  const suffixGroups = detectAffix(cols, "suffix", minGroupSize);

  const all = [...prefixGroups, ...suffixGroups]
    .sort((a, b) => b.members.length - a.members.length);

  const assigned = new Set<string>();
  const result: SuggestedGroup[] = [];

  for (const g of all) {
    const remaining = g.members.filter((m) => !assigned.has(m));
    if (remaining.length < minGroupSize) continue;
    for (const m of remaining) assigned.add(m);
    result.push({ name: g.name, pattern: g.pattern, columns: remaining });
  }

  return result;
}
