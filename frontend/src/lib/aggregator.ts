import type { Aggregation, ChartSettings, QueryResult, SortOrder } from "@/types/dashboard";

const CHART_ROW_CAP = 10_000;

export function aggregateClientSide(
  raw: QueryResult,
  xColumn: string,
  yColumns: string[],
  settings: ChartSettings,
  groupByColumn?: string | null,
): QueryResult {
  const xIdx = raw.columns.indexOf(xColumn);
  if (xIdx === -1) return { columns: [xColumn, ...yColumns], rows: [] };

  const yIdxs = yColumns.map((c) => raw.columns.indexOf(c));
  const agg: Aggregation = settings.aggregation;
  const gIdx = groupByColumn ? raw.columns.indexOf(groupByColumn) : -1;

  if (agg === "NONE") {
    const outCols = gIdx >= 0 ? [xColumn, groupByColumn!, ...yColumns] : [xColumn, ...yColumns];
    const rows = raw.rows.map((r) => {
      const row: unknown[] = [r[xIdx]];
      if (gIdx >= 0) row.push(r[gIdx]);
      for (const i of yIdxs) row.push(i >= 0 ? r[i] : null);
      return row;
    });
    return applySort({ columns: outCols, rows }, settings.sortOrder, CHART_ROW_CAP);
  }

  if (gIdx >= 0) {
    return aggregateWithGroupBy(raw, xIdx, gIdx, yIdxs, xColumn, groupByColumn!, yColumns, agg, settings.sortOrder, CHART_ROW_CAP);
  }

  const groups = new Map<string, { counts: number[]; sums: number[]; mins: number[]; maxes: number[] }>();

  for (const row of raw.rows) {
    const key = String(row[xIdx] ?? "");
    let g = groups.get(key);
    if (!g) {
      g = {
        counts: yIdxs.map(() => 0),
        sums: yIdxs.map(() => 0),
        mins: yIdxs.map(() => Infinity),
        maxes: yIdxs.map(() => -Infinity),
      };
      groups.set(key, g);
    }
    for (let i = 0; i < yIdxs.length; i++) {
      const val = Number(yIdxs[i] >= 0 ? row[yIdxs[i]] : 0) || 0;
      g.counts[i]++;
      g.sums[i] += val;
      if (val < g.mins[i]) g.mins[i] = val;
      if (val > g.maxes[i]) g.maxes[i] = val;
    }
  }

  const outCols = [xColumn, ...yColumns];
  const rows: unknown[][] = [];

  for (const [key, g] of groups) {
    const row: unknown[] = [key];
    for (let i = 0; i < yIdxs.length; i++) {
      if (agg === "SUM") row.push(g.sums[i]);
      else if (agg === "AVG") row.push(g.counts[i] > 0 ? g.sums[i] / g.counts[i] : 0);
      else if (agg === "COUNT") row.push(g.counts[i]);
      else if (agg === "MIN") row.push(g.mins[i] === Infinity ? 0 : g.mins[i]);
      else if (agg === "MAX") row.push(g.maxes[i] === -Infinity ? 0 : g.maxes[i]);
      else row.push(g.sums[i]);
    }
    rows.push(row);
  }

  return applySort({ columns: outCols, rows }, settings.sortOrder, CHART_ROW_CAP);
}

function aggregateWithGroupBy(
  raw: QueryResult,
  xIdx: number,
  gIdx: number,
  yIdxs: number[],
  xColumn: string,
  groupByColumn: string,
  yColumns: string[],
  agg: Aggregation,
  sort: SortOrder,
  limit: number,
): QueryResult {
  const groups = new Map<string, { count: number; sum: number; min: number; max: number }>();

  for (const row of raw.rows) {
    const x = String(row[xIdx] ?? "");
    const g = String(row[gIdx] ?? "");
    const key = `${x}\0${g}`;
    const val = Number(yIdxs[0] >= 0 ? row[yIdxs[0]] : 0) || 0;

    let acc = groups.get(key);
    if (!acc) {
      acc = { count: 0, sum: 0, min: Infinity, max: -Infinity };
      groups.set(key, acc);
    }
    acc.count++;
    acc.sum += val;
    if (val < acc.min) acc.min = val;
    if (val > acc.max) acc.max = val;
  }

  const outCols = [xColumn, groupByColumn, ...yColumns];
  const rows: unknown[][] = [];

  for (const [key, acc] of groups) {
    const [x, g] = key.split("\0");
    const row: unknown[] = [x, g];
    let v: number;
    if (agg === "SUM") v = acc.sum;
    else if (agg === "AVG") v = acc.count > 0 ? acc.sum / acc.count : 0;
    else if (agg === "COUNT") v = acc.count;
    else if (agg === "MIN") v = acc.min === Infinity ? 0 : acc.min;
    else if (agg === "MAX") v = acc.max === -Infinity ? 0 : acc.max;
    else v = acc.sum;
    row.push(v);
    rows.push(row);
  }

  return applySort({ columns: outCols, rows }, sort, limit);
}

function applySort(result: QueryResult, sort: SortOrder, limit: number): QueryResult {
  let rows = [...result.rows];

  if (sort === "x-asc") rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  else if (sort === "x-desc") rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  else if (sort === "y-asc") rows.sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0));
  else if (sort === "y-desc") rows.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));

  if (limit > 0 && rows.length > limit) rows = rows.slice(0, limit);

  return { columns: result.columns, rows };
}
