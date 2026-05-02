import type { CascadeRule, DimensionHierarchy, HierarchyLevel } from "@/types/dashboard";

/**
 * Find the hierarchy that contains a given column at any level.
 */
export function findHierarchyByColumn(
  hierarchies: DimensionHierarchy[],
  column: string,
): DimensionHierarchy | undefined {
  return hierarchies.find((h) => h.levels.some((lv) => lv.column === column));
}

/**
 * Given a column that's part of a hierarchy, return the level index (0-based).
 */
export function getLevelIndex(
  hierarchy: DimensionHierarchy,
  column: string,
): number {
  return hierarchy.levels.findIndex((lv) => lv.column === column);
}

/**
 * Check whether a drill-down is possible for this column
 * (i.e., there's a next, more specific level below it).
 */
export function canDrillDown(
  hierarchies: DimensionHierarchy[],
  column: string,
): boolean {
  const h = findHierarchyByColumn(hierarchies, column);
  if (!h) return false;
  const idx = getLevelIndex(h, column);
  return idx >= 0 && idx < h.levels.length - 1;
}

/**
 * Check whether a drill-up is possible for this column
 * (i.e., there's a parent, broader level above it).
 */
export function canDrillUp(
  hierarchies: DimensionHierarchy[],
  column: string,
): boolean {
  const h = findHierarchyByColumn(hierarchies, column);
  if (!h) return false;
  const idx = getLevelIndex(h, column);
  return idx > 0;
}

/**
 * Return the next (child) level in the hierarchy, or undefined if at the bottom.
 */
export function getChildLevel(
  hierarchy: DimensionHierarchy,
  column: string,
): HierarchyLevel | undefined {
  const idx = getLevelIndex(hierarchy, column);
  if (idx < 0 || idx >= hierarchy.levels.length - 1) return undefined;
  return hierarchy.levels[idx + 1];
}

/**
 * Return the parent level in the hierarchy, or undefined if at the top.
 */
export function getParentLevel(
  hierarchy: DimensionHierarchy,
  column: string,
): HierarchyLevel | undefined {
  const idx = getLevelIndex(hierarchy, column);
  if (idx <= 0) return undefined;
  return hierarchy.levels[idx - 1];
}

/**
 * Get all column names in a hierarchy from top to a given level (inclusive).
 */
export function getAncestorColumns(
  hierarchy: DimensionHierarchy,
  column: string,
): string[] {
  const idx = getLevelIndex(hierarchy, column);
  if (idx < 0) return [];
  return hierarchy.levels.slice(0, idx + 1).map((lv) => lv.column);
}

/**
 * Return the display label for a level. Falls back to the column name.
 */
export function levelLabel(
  level: HierarchyLevel,
  aliasMap?: Record<string, string> | ((col: string) => string),
): string {
  if (level.label) return level.label;
  if (typeof aliasMap === "function") return aliasMap(level.column);
  if (aliasMap) return aliasMap[level.column] ?? level.column;
  return level.column;
}

/**
 * Generate cascade rules from hierarchies. For each hierarchy, create a
 * parent→child cascade rule for every adjacent pair of levels.
 * Existing rules are preserved; only new, non-duplicate rules are appended.
 */
export function generateCascadeRulesFromHierarchies(
  hierarchies: DimensionHierarchy[],
  existingRules: CascadeRule[],
): CascadeRule[] {
  const existingKeys = new Set(
    existingRules.map((r) => `${r.parentId}|${r.childId}`),
  );

  const newRules: CascadeRule[] = [];

  for (const h of hierarchies) {
    for (let i = 0; i < h.levels.length - 1; i++) {
      const parent = h.levels[i];
      const child = h.levels[i + 1];
      if (!parent.column || !child.column) continue;

      const parentId = `col:${parent.column}`;
      const childId = `col:${child.column}`;
      const key = `${parentId}|${childId}`;

      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      newRules.push({
        id: `hcr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        parentId,
        parentType: "column",
        childId,
        childType: "column",
      });
    }
  }

  return [...existingRules, ...newRules];
}
