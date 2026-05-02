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
  source_table?: string;
}

export interface TableMeta {
  tableName: string;
  database: string;
  isTemporary: boolean;
}

export interface QueryResult {
  columns: string[];
  column_types?: string[];
  rows: unknown[][];
}

export interface ChartBinding {
  xColumns: string[];
  yColumns: string[];
  groupBy: string[];
}

/** @deprecated Use xColumns/groupBy arrays. Kept for preset migration. */
export interface LegacyChartBinding {
  xColumn: string | null;
  yColumns: string[];
  groupBy: string | null;
}

export function migrateBinding(b: unknown): ChartBinding {
  if (!b || typeof b !== "object") return { xColumns: [], yColumns: [], groupBy: [] };
  const obj = b as Record<string, unknown>;
  if (Array.isArray(obj.xColumns)) {
    return {
      xColumns: obj.xColumns as string[],
      yColumns: Array.isArray(obj.yColumns) ? obj.yColumns as string[] : [],
      groupBy: Array.isArray(obj.groupBy) ? obj.groupBy as string[] : [],
    };
  }
  return {
    xColumns: typeof obj.xColumn === "string" ? [obj.xColumn] : [],
    yColumns: Array.isArray(obj.yColumns) ? obj.yColumns as string[] : [],
    groupBy: typeof obj.groupBy === "string" ? [obj.groupBy] : [],
  };
}

export type WidgetSize = "1x1" | "2x1";

export interface DrillFilter {
  column: string;
  value: string;
}

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
  drillFilters?: DrillFilter[];
  dynamicDimensionValue?: string;
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
export type FilterType = "value_list" | "date_range" | "date_relative" | "numeric_range" | "free_text" | "search_select";
export type NumericOp = "=" | "!=" | ">" | ">=" | "<" | "<=" | "between";

export type DatePreset =
  | "today" | "yesterday"
  | "last_7_days" | "last_30_days" | "last_90_days"
  | "this_week" | "this_month" | "this_quarter" | "this_year"
  | "custom";

export type FilterSortOrder = "asc" | "desc" | "custom";

export interface FilterItem {
  id: string;
  column: string;
  table: string;
  dataType: string;
  filterType: FilterType;
  mode: FilterMode;
  values: string[];
  selectedValues: string[];
  sortOrder?: FilterSortOrder;
  dateFrom?: string;
  dateTo?: string;
  datePreset?: DatePreset;
  numericOp?: NumericOp;
  numericValue?: number;
  numericValue2?: number;
  freeTextValues?: string[];
  freeTextCaseSensitive?: boolean;
  formulaExpression?: string;
  singleSelectForced?: boolean;
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
  | "dark" | "light" | "nike" | "nike-light" | "midnight" | "slate"
  | "minimal" | "nord" | "corporate" | "custom";

export type Density = "compact" | "comfortable" | "spacious";

export type AppTab = "data" | "dashboard" | "ai_insights";

export type Capability = "self_service" | "dashboarding" | "ai_insights";

export type SelfServiceFeature = "download_data" | "export_excel" | "custom_columns" | "subscriptions" | "presets" | "upload_data";

export type DashboardingFeature = "kpi_metrics" | "charts" | "pivot_table";

export type AiInsightsOption = "llm_connection" | "zenie_space" | "root_cause_analysis";

export interface AiSettings {
  options: AiInsightsOption[];
  llmEndpoint?: string;
  zenieEndpoint?: string;
  rcaEndpoint?: string;
}

/* ── Dimension Sources ────────────────────────── */

export type DimensionSourceType = "static" | "query" | "table" | "formula";

export interface DimensionStaticValue {
  value: string;
  display: string;
}

export interface DimensionSource {
  id: string;
  column: string;
  label: string;
  required: boolean;
  sourceType: DimensionSourceType;
  sortOrder?: FilterSortOrder;
  forceSingleSelect?: boolean;
  staticValues?: DimensionStaticValue[];
  query?: string;
  valueColumn?: string;
  displayColumn?: string;
  tableCatalog?: string;
  tableSchema?: string;
  tableName?: string;
  formula?: string;
  formulaValues?: DimensionStaticValue[];
}

/* ── Dimension Hierarchies ────────────────────── */

export interface HierarchyLevel {
  id: string;
  column: string;
  label?: string;
  sortOrder?: "asc" | "desc";
}

export interface DimensionHierarchy {
  id: string;
  name: string;
  levels: HierarchyLevel[];
  autoCascade?: boolean;
}

/* ── Free-Text Validation Rules ───────────────── */

export type AllowedCharsPreset = "any" | "digits" | "alphanumeric" | "alphanumeric_dash" | "custom";

export interface FreeTextValidationRule {
  column: string;
  min_length?: number;
  max_length?: number;
  exact_length?: number;
  pattern?: string;
  pattern_label?: string;
  lpad_length?: number;
  lpad_char?: string;
  uppercase?: boolean;
  lowercase?: boolean;
  trim?: boolean;
  strip_special?: boolean;
  deduplicate?: boolean;
  allowed_chars?: AllowedCharsPreset;
  allowed_chars_custom?: string;
  starts_with?: string;
  ends_with?: string;
  error_message?: string;
}

/* ── Cascade Rules ────────────────────────────── */

export interface CascadeRule {
  id: string;
  parentId: string;
  parentType: "column" | "dimension";
  childId: string;
  childType: "column" | "dimension";
  linkColumn?: string;
}

/* ── Table Joins ─────────────────────────────── */

export type JoinType = "LEFT" | "INNER" | "RIGHT";

export interface JoinConfig {
  id: string;
  table: string;
  joinType: JoinType;
  leftKey: string;
  rightKey: string;
}

export type AppPage = "home" | "setup" | "workspace" | "docs";

export type BaseFilterOperator = "=" | "!=" | "IN" | "NOT IN" | ">" | "<" | ">=" | "<=" | "BETWEEN" | "LIKE";

export type BaseFilterMode = "static" | "query";

export interface BaseFilter {
  id: string;
  column: string;
  operator: BaseFilterOperator;
  values: string[];
  mode?: BaseFilterMode;
  queryExpression?: string;
}

export type DatasourceMode = "table" | "query";

export interface WorkspaceDatasource {
  catalog: string | null;
  schema: string | null;
  default_table: string | null;
  base_filters?: BaseFilter[];
  source_mode?: DatasourceMode;
  custom_query?: string;
}

export interface WorkspaceSettings {
  theme: string;
  density: string;
  row_limit: number;
  upload_limit_mb?: number;
  accent_color?: string;
}

export type GroupingMode = "measures_dimensions" | "custom";

export interface ColumnGroupDef {
  name: string;
  patterns: string[];
  columns?: string[];
}

export interface ColumnGroupConfig {
  mode: GroupingMode;
  dimensionGroups?: ColumnGroupDef[];
  measureGroups?: ColumnGroupDef[];
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
  column_type_overrides?: Record<string, string>;
  column_aggregations?: Record<string, ColumnAggregation>;
  excluded_columns?: string[];
  column_groups?: ColumnGroupConfig;
  dimension_sources?: DimensionSource[];
  cascade_rules?: CascadeRule[];
  hierarchies?: DimensionHierarchy[];
  abbreviations?: { word: string; abbr: string }[];
  free_text_filter_columns?: string[];
  search_select_columns?: string[];
  single_select_columns?: string[];
  free_text_validation_rules?: FreeTextValidationRule[];
  joins?: JoinConfig[];
  default_preset_id?: string;
}

export interface CustomThemeColors {
  bgApp: string;
  bgSidebar: string;
  bgCard: string;
  bgCardHover?: string;
  bgInput: string;
  border: string;
  borderFocus?: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover?: string;
  accentSubtle?: string;
  danger?: string;
  success?: string;
  warning?: string;
  radius?: string;
  shadow?: string;
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

/* ── Pivot ────────────────────────────────────── */

export interface PivotValueField {
  name: string;
  agg: string;
  fmt: string;
}

export interface PivotSnapshot {
  rowFields: string[];
  colFields: string[];
  valueFields: PivotValueField[];
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
  dynamicDimensionValue?: string;
}

export interface PresetSnapshot {
  selectedTable: string | null;
  selectedOutputColumns: string[];
  formulaColumns: FormulaColumn[];
  filters: FilterItem[];
  dynamicFilters: DynamicFilter[];
  dimensionFilterSelections?: Record<string, string[]>;
  activatedOptionalDimIds?: string[];
  widgets: WidgetSnapshot[];
  layouts: LayoutItem[];
  gridRows: number;
  gridCols: number;
  dashboardCols?: number;
  kpiCards?: KpiCard[];
  pivotConfig?: PivotSnapshot;
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

/* ── User Upload (client-side join) ─────────── */

export interface UploadJoinConfig {
  uploadKeyColumn: string;
  primaryKeyColumn: string;
  joinType: "LEFT" | "INNER";
}

export interface UploadedDataset {
  fileName: string;
  columns: string[];
  rows: Record<string, string>[];
  joinConfig: UploadJoinConfig | null;
  uploadedAt: string;
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
