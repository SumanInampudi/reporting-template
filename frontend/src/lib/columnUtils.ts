import type { ColumnMeta } from "@/types/dashboard";
import { NUMERIC_RE, DATE_RE } from "./constants";

export type ColumnCategory = "dimension" | "fact";

export interface CategorizedColumns {
  dimensions: ColumnMeta[];
  facts: ColumnMeta[];
}

export function classifyColumn(col: ColumnMeta): ColumnCategory {
  if (NUMERIC_RE.test(col.data_type)) return "fact";
  return "dimension";
}

export function categorizeColumns(cols: ColumnMeta[]): CategorizedColumns {
  const dimensions: ColumnMeta[] = [];
  const facts: ColumnMeta[] = [];

  for (const col of cols) {
    if (classifyColumn(col) === "fact") {
      facts.push(col);
    } else {
      dimensions.push(col);
    }
  }

  return { dimensions, facts };
}

export function isNumeric(dataType: string): boolean {
  return NUMERIC_RE.test(dataType);
}

export function isDate(dataType: string): boolean {
  return DATE_RE.test(dataType);
}
