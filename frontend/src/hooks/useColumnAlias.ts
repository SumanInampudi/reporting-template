import { useCallback } from "react";
import { useStore } from "./useStore";
import { displayName as resolveAlias } from "@/lib/aliasUtils";

/**
 * Returns a function that resolves the display name for a column,
 * using the active workspace's column_aliases with pattern fallback.
 */
export function useColumnAlias(): (column: string) => string {
  const aliases = useStore((s) => s.activeWorkspace?.column_aliases);
  return useCallback(
    (column: string) => resolveAlias(column, aliases),
    [aliases],
  );
}
