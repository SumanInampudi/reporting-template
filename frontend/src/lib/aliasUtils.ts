/**
 * Column alias engine.
 * - Global abbreviation dictionary for pattern-based alias generation
 * - Per-workspace alias lookup with automatic fallback
 */

export type AliasStrategy = "title_case" | "pattern" | "original";

export interface AbbreviationEntry {
  word: string;
  abbr: string;
}

const DEFAULT_ABBREVIATIONS: AbbreviationEntry[] = [
  { word: "reporting", abbr: "Rptg" },
  { word: "coverage", abbr: "Cvrd" },
  { word: "covered", abbr: "Cvrd" },
  { word: "percentage", abbr: "%" },
  { word: "percent", abbr: "%" },
  { word: "quantity", abbr: "Qty" },
  { word: "number", abbr: "#" },
  { word: "description", abbr: "Desc" },
  { word: "remaining", abbr: "Rem" },
  { word: "shipping", abbr: "Ship" },
  { word: "customer", abbr: "Cust" },
  { word: "transaction", abbr: "Txn" },
  { word: "department", abbr: "Dept" },
  { word: "organization", abbr: "Org" },
  { word: "management", abbr: "Mgmt" },
  { word: "information", abbr: "Info" },
  { word: "manufacturing", abbr: "Mfg" },
  { word: "inventory", abbr: "Inv" },
  { word: "fulfillment", abbr: "Fulfill" },
  { word: "distribution", abbr: "Dist" },
  { word: "destination", abbr: "Dest" },
  { word: "allocation", abbr: "Alloc" },
  { word: "application", abbr: "App" },
  { word: "authentication", abbr: "Auth" },
  { word: "configuration", abbr: "Config" },
  { word: "identifier", abbr: "ID" },
  { word: "timestamp", abbr: "TS" },
  { word: "category", abbr: "Cat" },
  { word: "average", abbr: "Avg" },
  { word: "maximum", abbr: "Max" },
  { word: "minimum", abbr: "Min" },
  { word: "amount", abbr: "Amt" },
  { word: "document", abbr: "Doc" },
  { word: "reference", abbr: "Ref" },
  { word: "sequence", abbr: "Seq" },
  { word: "dimension", abbr: "Dim" },
  { word: "indicator", abbr: "Ind" },
  { word: "original", abbr: "Orig" },
  { word: "received", abbr: "Rcvd" },
  { word: "delivered", abbr: "Dlvd" },
  { word: "cancelled", abbr: "Cncl" },
  { word: "approved", abbr: "Aprvd" },
  { word: "external", abbr: "Ext" },
  { word: "internal", abbr: "Int" },
];

let _abbreviations: AbbreviationEntry[] = [...DEFAULT_ABBREVIATIONS];

export function getAbbreviations(): AbbreviationEntry[] {
  return _abbreviations;
}

export function setAbbreviations(entries: AbbreviationEntry[]): void {
  _abbreviations = entries;
}

export function getDefaultAbbreviations(): AbbreviationEntry[] {
  return [...DEFAULT_ABBREVIATIONS];
}

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function buildAbbrMap(abbrs: AbbreviationEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { word, abbr } of abbrs) {
    map.set(word.toLowerCase(), abbr);
  }
  return map;
}

export function titleCaseAlias(col: string): string {
  return col
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(capitalize)
    .join(" ")
    .trim();
}

export function patternAlias(col: string, abbrs?: AbbreviationEntry[]): string {
  const map = buildAbbrMap(abbrs ?? _abbreviations);
  return col
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => map.get(word.toLowerCase()) ?? capitalize(word))
    .join(" ")
    .trim();
}

export function generateAliases(
  columns: string[],
  strategy: AliasStrategy,
  abbrs?: AbbreviationEntry[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const col of columns) {
    switch (strategy) {
      case "title_case":
        result[col] = titleCaseAlias(col);
        break;
      case "pattern":
        result[col] = patternAlias(col, abbrs);
        break;
      case "original":
        result[col] = col;
        break;
    }
  }
  return result;
}

/**
 * Resolve the display name for a column.
 * Priority: manual alias → auto-generated via pattern → title case fallback.
 */
const SPECIAL_DISPLAY_NAMES: Record<string, string> = {
  "__row_count__": "Row Count",
  "__row_number__": "Row Count",
  "__dynamic_dimension__": "Dynamic Dimension",
};

export function displayName(
  column: string,
  aliases?: Record<string, string>,
): string {
  if (SPECIAL_DISPLAY_NAMES[column]) return SPECIAL_DISPLAY_NAMES[column];
  if (aliases?.[column]) return aliases[column];
  return patternAlias(column);
}
