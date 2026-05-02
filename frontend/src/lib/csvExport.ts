import type { QueryResult } from "@/types/dashboard";

function escapeCell(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function queryResultToCsv(data: QueryResult): string {
  const header = data.columns.map(escapeCell).join(",");
  const rows = data.rows.map((row) => row.map(escapeCell).join(","));
  return [header, ...rows].join("\n");
}

export function downloadCsv(data: QueryResult, filename: string) {
  const csv = queryResultToCsv(data);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
