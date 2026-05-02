import { format } from "sql-formatter";

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "ON",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS",
  "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET",
  "AS", "IS", "NULL", "BETWEEN", "LIKE", "EXISTS",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VIEW",
  "UNION", "ALL", "DISTINCT", "TOP", "WITH",
  "ASC", "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "CAST", "COALESCE", "IFNULL", "NULLIF",
  "TRUE", "FALSE",
]);

const FUNCTIONS = new Set([
  "COUNT", "SUM", "AVG", "MIN", "MAX",
  "COALESCE", "IFNULL", "NULLIF", "CAST",
  "UPPER", "LOWER", "TRIM", "LENGTH", "SUBSTRING", "REPLACE", "CONCAT",
  "DATE", "YEAR", "MONTH", "DAY", "NOW", "CURRENT_DATE", "CURRENT_TIMESTAMP",
  "ROUND", "FLOOR", "CEIL", "ABS", "MOD",
  "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD",
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Tokenises a SQL string and wraps tokens in <span> elements for CSS styling.
 * Handles: keywords, functions, strings, numbers, operators, backtick-quoted identifiers, and comments.
 */
export function highlightSql(raw: string): string {
  const TOKEN_RE =
    /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`|\b\d+(?:\.\d+)?\b|[<>=!]+|[(),;.*]|\b\w+\b/g;

  return raw.replace(TOKEN_RE, (tok) => {
    if (tok.startsWith("--") || tok.startsWith("/*"))
      return `<span class="sql-cmt">${escapeHtml(tok)}</span>`;

    if (tok.startsWith("'") || tok.startsWith('"'))
      return `<span class="sql-str">${escapeHtml(tok)}</span>`;

    if (tok.startsWith("`"))
      return `<span class="sql-id">${escapeHtml(tok)}</span>`;

    if (/^\d/.test(tok))
      return `<span class="sql-num">${escapeHtml(tok)}</span>`;

    if (/^[<>=!]+$/.test(tok))
      return `<span class="sql-op">${escapeHtml(tok)}</span>`;

    const upper = tok.toUpperCase();
    if (FUNCTIONS.has(upper))
      return `<span class="sql-fn">${escapeHtml(tok)}</span>`;

    if (SQL_KEYWORDS.has(upper))
      return `<span class="sql-kw">${escapeHtml(tok)}</span>`;

    return escapeHtml(tok);
  });
}

export function formatAndHighlight(sql: string): string {
  try {
    const formatted = format(sql, {
      language: "sql",
      keywordCase: "upper",
      indentStyle: "standard",
      linesBetweenQueries: 2,
    });
    return highlightSql(formatted);
  } catch {
    return highlightSql(sql);
  }
}
