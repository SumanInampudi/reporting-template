import type {
  FilterCondition,
  FilterGroup,
  FilterOperator,
  DynamicFilter,
  ColumnMeta,
} from "@/types/dashboard";
import { NUMERIC_RE, DATE_RE } from "@/lib/constants";

export interface DFValidationIssue {
  level: "error" | "warning";
  path: string;
  message: string;
}

const NUMERIC_OPS: FilterOperator[] = ["=", "!=", ">", ">=", "<", "<=", "BETWEEN", "IN", "NOT IN", "IS NULL", "IS NOT NULL"];
const STRING_OPS: FilterOperator[] = ["=", "!=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"];
const DATE_OPS: FilterOperator[] = ["=", "!=", ">", ">=", "<", "<=", "BETWEEN", "IS NULL", "IS NOT NULL"];
const BOOL_OPS: FilterOperator[] = ["=", "!=", "IS NULL", "IS NOT NULL"];

export function operatorsForType(dataType: string): FilterOperator[] {
  if (NUMERIC_RE.test(dataType)) return NUMERIC_OPS;
  if (DATE_RE.test(dataType)) return DATE_OPS;
  if (/bool/i.test(dataType)) return BOOL_OPS;
  return STRING_OPS;
}

const UNARY_OPS = new Set<FilterOperator>(["IS NULL", "IS NOT NULL"]);

function validateCondition(
  c: FilterCondition,
  colMap: Map<string, ColumnMeta>,
  groupIdx: number,
  condIdx: number,
): DFValidationIssue[] {
  const issues: DFValidationIssue[] = [];
  const path = `Group ${groupIdx + 1}, Condition ${condIdx + 1}`;

  if (!c.column) {
    issues.push({ level: "error", path, message: "Column is required" });
    return issues;
  }

  const meta = colMap.get(c.column);
  if (meta) {
    const allowed = operatorsForType(meta.data_type);
    if (!allowed.includes(c.operator)) {
      issues.push({
        level: "warning",
        path,
        message: `Operator "${c.operator}" may not be valid for ${meta.data_type}`,
      });
    }
  }

  if (UNARY_OPS.has(c.operator)) return issues;

  if (!c.value.trim()) {
    issues.push({ level: "error", path, message: "Value is required" });
  }

  if (c.operator === "BETWEEN" && !c.value2.trim()) {
    issues.push({ level: "error", path, message: "Second value is required for BETWEEN" });
  }

  if (c.valueType === "column" && c.value && meta) {
    const rhsMeta = colMap.get(c.value);
    if (rhsMeta) {
      const lhsNumeric = NUMERIC_RE.test(meta.data_type);
      const rhsNumeric = NUMERIC_RE.test(rhsMeta.data_type);
      const lhsDate = DATE_RE.test(meta.data_type);
      const rhsDate = DATE_RE.test(rhsMeta.data_type);
      if ((lhsNumeric && !rhsNumeric && !rhsDate) || (lhsDate && !rhsDate && !rhsNumeric)) {
        issues.push({
          level: "warning",
          path,
          message: `Type mismatch: ${c.column} (${meta.data_type}) vs ${c.value} (${rhsMeta.data_type})`,
        });
      }
    }
  }

  return issues;
}

function validateGroup(
  g: FilterGroup,
  colMap: Map<string, ColumnMeta>,
  groupIdx: number,
): DFValidationIssue[] {
  const issues: DFValidationIssue[] = [];
  if (g.conditions.length === 0) {
    issues.push({
      level: "error",
      path: `Group ${groupIdx + 1}`,
      message: "Group must have at least one condition",
    });
  }
  g.conditions.forEach((c, i) => {
    issues.push(...validateCondition(c, colMap, groupIdx, i));
  });
  return issues;
}

export function validateDynamicFilter(
  filter: DynamicFilter,
  allCols: ColumnMeta[],
): DFValidationIssue[] {
  const issues: DFValidationIssue[] = [];
  const colMap = new Map(allCols.map((c) => [c.col_name, c]));

  if (!filter.label.trim()) {
    issues.push({ level: "error", path: "Label", message: "Filter label is required" });
  }

  if (filter.groups.length === 0) {
    issues.push({ level: "error", path: "Filter", message: "Add at least one group" });
  }

  filter.groups.forEach((g, i) => {
    issues.push(...validateGroup(g, colMap, i));
  });

  return issues;
}
