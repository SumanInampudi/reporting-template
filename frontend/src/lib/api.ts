import type { ColumnGroupConfig, ColumnMeta, CurrentUser, CustomThemeColors, Preset, PresetSnapshot, QueryResult, SavedCustomTheme, Subscription, SubscriptionFormat, SubscriptionSchedule, Workspace } from "@/types/dashboard";


const BASE = "/api";
const QUERY_CACHE_MAX = 128;
const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: QueryResult;
  timestamp: number;
}

const _queryCache = new Map<string, CacheEntry>();
const _inflightQueries = new Map<string, Promise<QueryResult>>();

function queryCacheKey(sql: string, limit: number): string {
  return `${sql}::${limit}`;
}

function evictStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of _queryCache) {
    if (now - entry.timestamp > QUERY_CACHE_TTL_MS) _queryCache.delete(key);
  }
  while (_queryCache.size > QUERY_CACHE_MAX) {
    const oldest = _queryCache.keys().next().value;
    if (oldest != null) _queryCache.delete(oldest);
  }
}

export function clearQueryCache() {
  _queryCache.clear();
  _inflightQueries.clear();
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return fetchJSON("/me");
}

export async function fetchCatalogs(): Promise<string[]> {
  return fetchJSON("/catalogs");
}

export async function fetchSchemas(catalog: string): Promise<string[]> {
  return fetchJSON(`/catalogs/${encodeURIComponent(catalog)}/schemas`);
}

export async function fetchTablesIn(
  catalog: string,
  schema: string
): Promise<Record<string, unknown>[]> {
  return fetchJSON(
    `/catalogs/${encodeURIComponent(catalog)}/schemas/${encodeURIComponent(schema)}/tables`
  );
}

export interface ColumnsResponse {
  columns: ColumnMeta[];
  partition_columns: string[];
}

export async function fetchColumnsIn(
  catalog: string,
  schema: string,
  table: string
): Promise<ColumnsResponse> {
  const res = await fetchJSON<ColumnsResponse | ColumnMeta[]>(
    `/catalogs/${encodeURIComponent(catalog)}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/columns`
  );
  if (Array.isArray(res)) return { columns: res, partition_columns: [] };
  return res;
}

export async function fetchTables(): Promise<Record<string, string>[]> {
  return fetchJSON("/tables");
}

export async function fetchColumns(tableName: string): Promise<ColumnsResponse> {
  const res = await fetchJSON<ColumnsResponse | ColumnMeta[]>(
    `/tables/${encodeURIComponent(tableName)}/columns`
  );
  if (Array.isArray(res)) return { columns: res, partition_columns: [] };
  return res;
}

export async function runQuery(
  sql: string,
  limit?: number,
  signal?: AbortSignal,
  skipCache?: boolean,
): Promise<QueryResult> {
  const effectiveLimit = limit ?? 0;
  const key = queryCacheKey(sql, effectiveLimit);

  if (!skipCache) {
    const cached = _queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  if (!signal) {
    const inflight = _inflightQueries.get(key);
    if (inflight) return inflight;
  }

  const promise = fetchJSON<QueryResult>("/query", {
    method: "POST",
    body: JSON.stringify({ sql, limit: effectiveLimit || undefined }),
    signal,
  }).then((data) => {
    evictStaleEntries();
    _queryCache.set(key, { data, timestamp: Date.now() });
    _inflightQueries.delete(key);
    return data;
  }).catch((err) => {
    _inflightQueries.delete(key);
    throw err;
  });

  if (!signal) _inflightQueries.set(key, promise);
  return promise;
}

export async function exportCsv(sql: string, filename: string = "export.csv"): Promise<void> {
  const res = await fetch(`${BASE}/export-csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, filename }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail ?? detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("Server returned empty response");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportExcel(sql: string, filename: string = "export.xlsx"): Promise<void> {
  const res = await fetch(`${BASE}/export-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, filename }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail ?? detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("Server returned empty response");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchConfig(): Promise<Record<string, string>> {
  return fetchJSON("/config");
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  return fetchJSON("/test-connection", { method: "POST" });
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  return fetchJSON("/workspaces");
}

export async function fetchWorkspace(id: string): Promise<Workspace> {
  return fetchJSON(`/workspaces/${encodeURIComponent(id)}`);
}

export async function createWorkspace(data: {
  name: string;
  description?: string;
  catalog?: string | null;
  schema_name?: string | null;
  default_table?: string | null;
  capabilities?: string[];
  features?: string[];
  dashboard_features?: string[];
  ai_settings?: Record<string, unknown>;
  column_aliases?: Record<string, string>;
  column_type_overrides?: Record<string, string>;
  column_aggregations?: Record<string, string>;
  excluded_columns?: string[];
  column_groups?: ColumnGroupConfig;
  dimension_sources?: unknown[];
  cascade_rules?: unknown[];
  abbreviations?: { word: string; abbr: string }[];
  free_text_filter_columns?: string[];
  search_select_columns?: string[];
  single_select_columns?: string[];
  free_text_validation_rules?: unknown[];
  theme?: string;
  density?: string;
  row_limit?: number;
}): Promise<Workspace> {
  return fetchJSON("/workspaces", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateWorkspace(id: string, data: {
  name?: string;
  description?: string;
  catalog?: string | null;
  schema_name?: string | null;
  default_table?: string | null;
  capabilities?: string[];
  features?: string[];
  ai_settings?: Record<string, unknown>;
  column_aliases?: Record<string, string>;
  excluded_columns?: string[];
  column_groups?: ColumnGroupConfig;
  search_select_columns?: string[];
  single_select_columns?: string[];
  row_limit?: number;
}): Promise<Workspace> {
  return fetchJSON(`/workspaces/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await fetchJSON(`/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchAppSettings(): Promise<Record<string, string>> {
  return fetchJSON("/app-settings");
}

export async function saveAppSettings(data: Record<string, string | null>): Promise<Record<string, string>> {
  return fetchJSON("/app-settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function setAdminDefaultPreset(workspaceId: string, presetId: string | null): Promise<Workspace> {
  return fetchJSON(`/workspaces/${encodeURIComponent(workspaceId)}/default-preset`, {
    method: "PATCH",
    body: JSON.stringify({ preset_id: presetId }),
  });
}


// ── Presets ──────────────────────────────────────────────────────────

function presetsUrl(workspaceId: string, presetId?: string): string {
  const base = `/workspaces/${encodeURIComponent(workspaceId)}/presets`;
  return presetId ? `${base}/${encodeURIComponent(presetId)}` : base;
}

export async function fetchPresets(workspaceId: string): Promise<Preset[]> {
  return fetchJSON(presetsUrl(workspaceId));
}

export async function fetchPreset(workspaceId: string, presetId: string): Promise<Preset> {
  return fetchJSON(presetsUrl(workspaceId, presetId));
}

export async function createPreset(workspaceId: string, data: {
  name: string;
  description?: string;
  owner?: string;
  is_public?: boolean;
  snapshot: PresetSnapshot;
  data_sql?: string | null;
}): Promise<Preset> {
  return fetchJSON(presetsUrl(workspaceId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePreset(workspaceId: string, presetId: string, data: {
  name?: string;
  description?: string;
  is_public?: boolean;
  snapshot?: PresetSnapshot;
  data_sql?: string | null;
}): Promise<Preset> {
  return fetchJSON(presetsUrl(workspaceId, presetId), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePreset(workspaceId: string, presetId: string): Promise<void> {
  await fetchJSON(presetsUrl(workspaceId, presetId), { method: "DELETE" });
}

export async function duplicatePreset(workspaceId: string, presetId: string): Promise<Preset> {
  return fetchJSON(`${presetsUrl(workspaceId, presetId)}/duplicate`, { method: "POST" });
}

// ── Subscriptions (per-user model) ───────────────────────────────────

function subscriptionsUrl(workspaceId: string, presetId: string, subId?: string): string {
  const base = `/workspaces/${encodeURIComponent(workspaceId)}/presets/${encodeURIComponent(presetId)}/subscriptions`;
  return subId ? `${base}/${encodeURIComponent(subId)}` : base;
}

export async function fetchSubscriptions(workspaceId: string, presetId: string): Promise<Subscription[]> {
  return fetchJSON(subscriptionsUrl(workspaceId, presetId));
}

export async function createSubscription(workspaceId: string, presetId: string, data: {
  email: string;
  schedule: SubscriptionSchedule;
  format: SubscriptionFormat;
  added_by: string;
}): Promise<Subscription> {
  return fetchJSON(subscriptionsUrl(workspaceId, presetId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSubscription(workspaceId: string, presetId: string, subId: string, data: {
  schedule?: SubscriptionSchedule;
  format?: SubscriptionFormat;
  enabled?: boolean;
}): Promise<Subscription> {
  return fetchJSON(subscriptionsUrl(workspaceId, presetId, subId), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSubscription(workspaceId: string, presetId: string, subId: string): Promise<void> {
  await fetchJSON(subscriptionsUrl(workspaceId, presetId, subId), { method: "DELETE" });
}

export async function batchSaveSubscriptions(
  workspaceId: string,
  presetId: string,
  subscriptions: Array<{
    id?: string;
    email: string;
    schedule: SubscriptionSchedule;
    format: SubscriptionFormat;
    enabled?: boolean;
    added_by?: string;
  }>,
): Promise<Subscription[]> {
  return fetchJSON(subscriptionsUrl(workspaceId, presetId), {
    method: "PUT",
    body: JSON.stringify({ subscriptions }),
  });
}

// ── Custom Themes ────────────────────────────────────────────────────

export async function fetchCustomThemes(): Promise<SavedCustomTheme[]> {
  return fetchJSON("/custom-themes");
}

export async function createCustomTheme(data: {
  name: string;
  colors: CustomThemeColors;
  owner?: string;
}): Promise<SavedCustomTheme> {
  return fetchJSON("/custom-themes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCustomTheme(themeId: string, data: {
  name?: string;
  colors?: CustomThemeColors;
}): Promise<SavedCustomTheme> {
  return fetchJSON(`/custom-themes/${encodeURIComponent(themeId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomTheme(themeId: string): Promise<void> {
  await fetchJSON(`/custom-themes/${encodeURIComponent(themeId)}`, { method: "DELETE" });
}

// ── Abbreviations ────────────────────────────────────────────────────

export interface AbbreviationEntry {
  word: string;
  abbr: string;
}

export async function fetchAbbreviations(): Promise<AbbreviationEntry[]> {
  return fetchJSON("/abbreviations");
}

export async function saveAbbreviations(entries: AbbreviationEntry[]): Promise<AbbreviationEntry[]> {
  return fetchJSON("/abbreviations", {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

// ── Shared Formula Columns ──────────────────────────────────────────

import type { SharedFormulaColumn } from "@/types/dashboard";

const sharedFormulasUrl = (wsId: string) =>
  `/workspaces/${encodeURIComponent(wsId)}/shared-formulas`;

export async function fetchSharedFormulas(workspaceId: string): Promise<SharedFormulaColumn[]> {
  return fetchJSON(sharedFormulasUrl(workspaceId));
}

export async function createSharedFormula(
  workspaceId: string,
  data: { alias: string; expression: string; data_type: string },
): Promise<SharedFormulaColumn> {
  return fetchJSON(sharedFormulasUrl(workspaceId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSharedFormula(
  workspaceId: string,
  formulaId: string,
  data: Partial<{ alias: string; expression: string; data_type: string }>,
): Promise<SharedFormulaColumn> {
  return fetchJSON(`${sharedFormulasUrl(workspaceId)}/${encodeURIComponent(formulaId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSharedFormula(workspaceId: string, formulaId: string): Promise<void> {
  await fetchJSON(`${sharedFormulasUrl(workspaceId)}/${encodeURIComponent(formulaId)}`, {
    method: "DELETE",
  });
}

/* ── Genie ────────────────────────────────────────────────────────── */

export interface GenieResponse {
  conversation_id: string;
  message_id: string;
  status: string;
  text: string | null;
  sql: string | null;
  columns: string[] | null;
  rows: (string | null)[][] | null;
  error: string | null;
}

export async function askGenie(
  spaceId: string,
  question: string,
  context?: string,
  conversationId?: string,
): Promise<GenieResponse> {
  return fetchJSON("/genie/ask", {
    method: "POST",
    body: JSON.stringify({
      space_id: spaceId,
      question,
      context: context || undefined,
      conversation_id: conversationId || undefined,
    }),
  });
}
