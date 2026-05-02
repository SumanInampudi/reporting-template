import type { QueryResult, UploadedDataset } from "@/types/dashboard";

/**
 * Merge uploaded CSV data into SQL query results using a Map-based
 * lookup join. Runs entirely in the browser — no backend involved.
 */
export function applyClientJoin(
  sqlResult: QueryResult,
  upload: UploadedDataset,
): QueryResult {
  const cfg = upload.joinConfig;
  if (!cfg?.uploadKeyColumn || !cfg?.primaryKeyColumn) return sqlResult;

  const primaryKeyIdx = sqlResult.columns.indexOf(cfg.primaryKeyColumn);
  if (primaryKeyIdx === -1) return sqlResult;

  const extraCols = upload.columns.filter((c) => c !== cfg.uploadKeyColumn);
  if (extraCols.length === 0) return sqlResult;

  const lookupMap = new Map<string, Record<string, string>>();
  for (const row of upload.rows) {
    const key = String(row[cfg.uploadKeyColumn] ?? "").trim().toUpperCase();
    if (key) lookupMap.set(key, row);
  }

  const emptyExtra = extraCols.map(() => null);

  const mergedColumns = [...sqlResult.columns, ...extraCols];
  const mergedRows: unknown[][] = [];

  for (const row of sqlResult.rows) {
    const keyVal = String(row[primaryKeyIdx] ?? "").trim().toUpperCase();
    const matched = lookupMap.get(keyVal);

    if (matched) {
      mergedRows.push([
        ...row,
        ...extraCols.map((c) => matched[c] ?? null),
      ]);
    } else if (cfg.joinType === "LEFT") {
      mergedRows.push([...row, ...emptyExtra]);
    }
    // INNER: skip unmatched rows
  }

  return { columns: mergedColumns, rows: mergedRows };
}
