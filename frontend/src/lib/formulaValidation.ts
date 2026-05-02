import type { ColumnMeta } from "@/types/dashboard";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export function validateFormula(
  expression: string,
  columnNames: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!expression.trim()) return issues;

  let openParens = 0;
  let inSingleQuote = false;
  for (const ch of expression) {
    if (ch === "'" && !inSingleQuote) { inSingleQuote = true; continue; }
    if (ch === "'" && inSingleQuote) { inSingleQuote = false; continue; }
    if (inSingleQuote) continue;
    if (ch === "(") openParens++;
    if (ch === ")") openParens--;
    if (openParens < 0) {
      issues.push({ level: "error", message: "Unexpected closing parenthesis" });
      break;
    }
  }
  if (inSingleQuote) {
    issues.push({ level: "error", message: "Unclosed single quote" });
  }
  if (openParens > 0) {
    issues.push({ level: "error", message: `${openParens} unclosed parenthesis${openParens > 1 ? "es" : ""}` });
  }

  const upper = expression.toUpperCase();
  const caseCount = (upper.match(/\bCASE\b/g) ?? []).length;
  const endCount = (upper.match(/\bEND\b/g) ?? []).length;
  if (caseCount > endCount) {
    issues.push({ level: "error", message: `CASE without matching END (${caseCount} CASE, ${endCount} END)` });
  }

  if (columnNames.size > 0) {
    const identifiers = expression.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g) ?? [];
    const SQL_KEYWORDS = new Set([
      "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL", "AS",
      "CASE", "WHEN", "THEN", "ELSE", "END", "IF", "BETWEEN", "LIKE", "CAST",
      "CONCAT", "COALESCE", "ROUND", "YEAR", "MONTH", "DAY", "DATEDIFF",
      "UPPER", "LOWER", "TRIM", "LENGTH", "SUBSTR", "ABS", "NULLIF",
      "SUM", "AVG", "COUNT", "MIN", "MAX", "TRUE", "FALSE", "INT", "STRING",
      "DOUBLE", "BOOLEAN", "FLOAT", "DECIMAL", "DATE", "TIMESTAMP", "BIGINT",
    ]);

    const unknowns = new Set<string>();
    for (const id of identifiers) {
      if (SQL_KEYWORDS.has(id.toUpperCase())) continue;
      if (/^\d/.test(id)) continue;
      if (!columnNames.has(id)) unknowns.add(id);
    }
    if (unknowns.size > 0) {
      const list = Array.from(unknowns).slice(0, 5).join(", ");
      issues.push({
        level: "warning",
        message: `Unknown identifier${unknowns.size > 1 ? "s" : ""}: ${list}${unknowns.size > 5 ? "..." : ""}`,
      });
    }
  }

  return issues;
}

export function validateAlias(alias: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!alias.trim()) {
    issues.push({ level: "error", message: "Column name is required" });
    return issues;
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias.trim())) {
    issues.push({ level: "error", message: "Column name must be alphanumeric (letters, digits, underscores)" });
  }
  return issues;
}
