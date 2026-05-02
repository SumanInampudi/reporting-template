import { useMemo, useState } from "react";
import { Lock, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import type { BaseFilter, BaseFilterOperator } from "@/types/dashboard";

function humanize(bf: BaseFilter, aliases: Record<string, string>): string {
  if (bf.mode === "query") return bf.queryExpression?.trim() ? `SQL: ${bf.queryExpression.trim()}` : "";

  const col = aliases[bf.column] || bf.column.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const vals = bf.values.filter(Boolean);
  if (vals.length === 0) return "";

  const opMap: Record<BaseFilterOperator, (v: string[]) => string> = {
    "=":       (v) => `${col} is ${v[0]}`,
    "!=":      (v) => `${col} is not ${v[0]}`,
    "IN":      (v) => `${col} is ${v.join(" or ")}`,
    "NOT IN":  (v) => `${col} is not ${v.join(", ")}`,
    ">":       (v) => `${col} is greater than ${v[0]}`,
    "<":       (v) => `${col} is less than ${v[0]}`,
    ">=":      (v) => `${col} is ${v[0]} or more`,
    "<=":      (v) => `${col} is at most ${v[0]}`,
    "BETWEEN": (v) => `${col} is between ${v[0]} and ${v[1] ?? "?"}`,
    "LIKE":    (v) => `${col} contains "${v[0]}"`,
  };

  return opMap[bf.operator]?.(vals) ?? `${col} ${bf.operator} ${vals.join(", ")}`;
}

export default function BaseFilterBanner() {
  const baseFilters = useStore((s) => s.activeWorkspace?.datasource?.base_filters);
  const aliases = useStore((s) => s.activeWorkspace?.column_aliases ?? {});
  const [expanded, setExpanded] = useState(false);

  const descriptions = useMemo(() => {
    if (!baseFilters || baseFilters.length === 0) return [];
    return baseFilters
      .map((bf) => humanize(bf, aliases))
      .filter(Boolean);
  }, [baseFilters, aliases]);

  if (descriptions.length === 0) return null;

  return (
    <div className="bf-banner">
      <button className="bf-banner-toggle" onClick={() => setExpanded(!expanded)}>
        <Lock size={12} className="bf-banner-lock" />
        <span className="bf-banner-label">
          Data scope applied ({descriptions.length})
        </span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="bf-banner-details">
          {descriptions.map((d, i) => (
            <span key={i} className="bf-banner-rule">{d}</span>
          ))}
        </div>
      )}
    </div>
  );
}
