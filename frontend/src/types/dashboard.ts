export interface CurrentUser {
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: "admin" | "consumer";
  groups: string[];
}

export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "scatter"
  | "area"
  | "heatmap"
  | "radar"
  | "funnel"
  | "treemap"
  | "gauge"
  | "table";

export type LegendPosition = "top" | "bottom" | "left" | "right" | "hidden";
export type NumberFormat = "default" | "compact" | "comma" | "percent";
export type Aggregation = "SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT" | "MIN" | "MAX" | "NONE";
export type ColumnAggregation = "SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT" | "MIN" | "MAX" | "NONE";
export type SortOrder = "none" | "x-asc" | "x-desc" | "y-asc" | "y-desc";
export type PaletteKey = "default" | "pastel" | "bold" | "earth" | "monochrome" | "ocean";

export interface ChartSettings {
  palette: PaletteKey;
  showLegend: boolean;
  legendPosition: LegendPosition;
  showDataLabels: boolean;

  xLabelRotation: number;
  showXAxis: boolean;
  showYAxis: boolean;
  yAxisMin?: number;
  yAxisMax?: number;
  numberFormat: NumberFormat;

  stacked: boolean;
  smooth: boolean;
  showSymbols: boolean;
  barBorderRadius: number;
  pieInnerRadius: number;

  aggregation: Aggregation;
  sortOrder: SortOrder;
  rowLimit: number;
  enableDataZoom: boolean;
}

export interface ColumnMeta {
  col_name: string;
  data_type: string;
}

export interface TableMeta {
  tableName: string;
  database: string;
  isTemporary: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface ChartBinding {
  xColumn: string | null;
  yColumns: string[];
  groupBy: string | null;
}

export type WidgetSize = "1x1" | "2x1";

export interface DashboardWidget {
  id: string;
  chartType: ChartType;
  title: string;
  tableName: string | null;
  binding: ChartBinding;
  data: QueryResult | null;
  sql: string | null;
  settings: ChartSettings;
  size: WidgetSize;
}

/* ── KPI Cards ─────────────────────────────────── */

export type KpiFormat = "number" | "compact" | "currency" | "percent";

export interface KpiCard {
  id: string;
  title: string;
  column: string;
  table: string;
  aggregation: Aggregation;
  format: KpiFormat;
  prefix?: string;
  suffix?: string;
  value?: number | null;
  loading?: boolean;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export type FilterMode = "single" | "multi";
export type FilterType = "value_list" | "date_range" | "date_relative" | "numeric_range";
export type NumericOp = "=" | "!=" | ">" | ">=" | "<" | "<=" | "between";

export type DatePreset =
  | "today" | "yesterday"
  | "last_7_days" | "last_30_days" | "last_90_days"
  | "this_week" | "this_month" | "this_quarter" | "this_year"
  | "custom";

export interface FilterItem {
  id: string;
  column: string;
  table: string;
  dataType: string;
  filterType: FilterType;
  mode: FilterMode;
  values: string[];
  selectedValues: string[];
  dateFrom?: string;
  dateTo?: string;
  datePreset?: DatePreset;
  numericOp?: NumericOp;
  numericValue?: number;
  numericValue2?: number;
}

export interface DragItem {
  type: "column" | "chart-type" | "table" | "filter-column";
  payload: string;
}

export interface FormulaColumn {
  id: string;
  alias: string;
  expression: string;
  dataType: "STRING" | "INT" | "DOUBLE" | "BOOLEAN";
}

export interface SharedFormulaColumn {
  id: string;
  workspace_id: string;
  alias: string;
  expression: string;
  data_type: "STRING" | "INT" | "DOUBLE" | "BOOLEAN";
  owner: string;
  created_at: string;
  updated_at: string;
}

export type ColorScheme =
  | "dark" | "light" | "nike" | "midnight" | "slate"
  | "minimal" | "nord" | "corporate" | "custom";

export type Density = "compact" | "comfortable" | "spacious";

export type AppTab = "data" | "dashboard" | "ai_insights";

export type Capability = "self_service" | "dashboarding" | "ai_insights";

export type SelfServiceFeature = "download_data" | "custom_columns" | "subscriptions" | "presets";

export type DashboardingFeature = "kpi_metrics" | "charts" | "pivot_table";

export type AiInsightsOption = "llm_connection" | "zenie_space" | "root_cause_analysis";

export interface AiSettings {
  options: AiInsightsOption[];
  llmEndpoint?: string;
  zenieEndpoint?: string;
  rcaEndpoint?: string;
}

export type AppPage = "home" | "setup" | "workspace";

export interface WorkspaceDatasource {
  catalog: string | null;
  schema: string | null;
  default_table: string | null;
}

export interface WorkspaceSettings {
  theme: string;
  density: string;
  row_limit: number;
}

export type GroupingMode = "measures_dimensions" | "custom";

export interface ColumnGroupDef {
  name: string;
  patterns: string[];
}

export interface ColumnGroupConfig {
  mode: GroupingMode;
  groups?: ColumnGroupDef[];
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  created_at: string;
  datasource: WorkspaceDatasource;
  capabilities: Capability[];
  features: SelfServiceFeature[];
  dashboard_features?: DashboardingFeature[];
  settings: WorkspaceSettings;
  ai_settings?: AiSettings;
  column_aliases?: Record<string, string>;
  column_aggregations?: Record<string, ColumnAggregation>;
  excluded_columns?: string[];
  column_groups?: ColumnGroupConfig;
  secret_scope?: string;
  secret_key?: string;
}

export interface CustomThemeColors {
  bgApp: string;
  bgSidebar: string;
  bgCard: string;
  bgInput: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
}

export interface SavedCustomTheme {
  id: string;
  name: string;
  colors: CustomThemeColors;
  owner: string;
  created_at: string;
  updated_at: string;
}

export interface ThemeConfig {
  colorScheme: ColorScheme;
  density: Density;
  customColors?: CustomThemeColors;
}

/* ── Dynamic Filter types ────────────────────── */

export type FilterOperator =
  | "=" | "!=" | ">" | ">=" | "<" | "<="
  | "BETWEEN"
  | "LIKE" | "NOT LIKE"
  | "IN" | "NOT IN"
  | "IS NULL" | "IS NOT NULL";

export type FilterValueType = "literal" | "column";

export type LogicalJoin = "AND" | "OR";

export interface FilterCondition {
  id: string;
  column: string;
  operator: FilterOperator;
  valueType: FilterValueType;
  value: string;
  value2: string;
}

export interface FilterGroup {
  id: string;
  join: LogicalJoin;
  conditions: FilterCondition[];
}

export interface DynamicFilter {
  id: string;
  label: string;
  rootJoin: LogicalJoin;
  groups: FilterGroup[];
  enabled: boolean;
}

/* ── Presets ──────────────────────────────────── */

export interface WidgetSnapshot {
  id: string;
  chartType: ChartType;
  title: string;
  tableName: string | null;
  binding: ChartBinding;
  sql: string | null;
  settings: ChartSettings;
  size?: WidgetSize;
}

export interface PresetSnapshot {
  selectedTable: string | null;
  selectedOutputColumns: string[];
  formulaColumns: FormulaColumn[];
  filters: FilterItem[];
  dynamicFilters: DynamicFilter[];
  widgets: WidgetSnapshot[];
  layouts: LayoutItem[];
  gridRows: number;
  gridCols: number;
  dashboardCols?: number;
  kpiCards?: KpiCard[];
  themeConfig: ThemeConfig;
  activeTab: AppTab;
}

export interface Preset {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  owner: string;
  is_public: boolean;
  data_sql?: string | null;
  snapshot: PresetSnapshot;
  created_at: string;
  updated_at: string;
}

/* ── Subscriptions (per-user model) ─────────── */

export type SubscriptionFrequency = "daily" | "weekly" | "monthly";
export type SubscriptionFormat = "csv" | "xlsx";

export interface SubscriptionSchedule {
  frequency: SubscriptionFrequency;
  day_of_week?: number;
  day_of_month?: number;  // -1 = last day of month
}

export interface Subscription {
  id: string;
  workspace_id: string;
  preset_id: string;
  email: string;
  schedule: SubscriptionSchedule;
  format: SubscriptionFormat;
  enabled: boolean;
  added_by: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  last_status?: "success" | "failed";
}
