# BI Excellence Suite — Feature Documentation

Detailed documentation of every feature in the application, organized by audience (Admin vs. End-User).

---

## Table of Contents

- [Platform Overview](#platform-overview)
- [Admin Features](#admin-features)
  - [Onboarding](#1-onboarding)
  - [Platform Settings](#2-platform-settings)
  - [Workspace Setup Wizard](#3-workspace-setup-wizard)
  - [Dimension Sources (Custom Filters)](#dimension-sources-custom-filters)
  - [Cascade Rules](#cascade-rules)
  - [Hierarchies](#hierarchies)
  - [Free-Text Validation Rules](#free-text-validation-rules)
  - [Abbreviations](#abbreviations)
  - [Workspace Management](#4-workspace-management)
  - [Shared Formulas](#5-shared-formulas)
  - [Custom Themes](#6-custom-themes)
  - [Storage & Migration](#7-storage--migration)
- [End-User Features](#end-user-features)
  - [Home Page (Launchpad)](#1-home-page-launchpad)
  - [Data Explorer](#2-data-explorer)
  - [Filters](#3-filters)
  - [Dashboard](#4-dashboard)
  - [Pivot Table](#5-pivot-table)
  - [Presets (Bookmarks)](#6-presets-bookmarks)
  - [Subscriptions](#7-subscriptions)
  - [Data Export](#8-data-export)
  - [Upload Data](#9-upload-data)
  - [Theme & Appearance](#10-theme--appearance)
  - [Focus Mode](#11-focus-mode)
  - [Navigation & UX](#12-navigation--ux)
  - [Documentation](#13-documentation)
- [AI & Intelligence Features](#ai--intelligence-features)
- [Security & Access Control](#security--access-control)

---

## Platform Overview

The BI Excellence Suite is a self-service dashboarding and data exploration platform that runs on Databricks. It connects to Unity Catalog tables (or custom SQL queries) and provides admins with a wizard-based workspace configuration system and end-users with interactive data exploration, charting, KPI cards, pivot tables, and preset/bookmark capabilities.

**Key architectural layers:**

- **Backend**: FastAPI (Python) with Databricks SQL Connector, Delta table or YAML storage
- **Frontend**: React 18 + TypeScript + Vite, Zustand state management, ECharts for charts, AG Grid for pivot
- **Deployment**: Databricks Apps with OAuth user passthrough and service principal fallback

---

## Admin Features

### 1. Onboarding

- **First-time setup**: When no workspaces exist, a guided onboarding page collects the **team name** and saves it as a platform-wide setting.
- **Team branding**: The team name is displayed in the navigation header and can include a custom logo URL and platform tagline.
- **Single-screen flow**: One input field and a "Get Started" button — minimal friction to first use.

### 2. Platform Settings

Accessible via the **Settings** button in the home page navigation bar:

- **Team name**: Displayed across the application header; can be renamed anytime.
- **Platform tagline**: Customizable subtitle shown below the team name in the navigation bar (e.g., "Analytics Platform", "Data Hub", "Reporting Suite"). Defaults to "Analytics Platform" if left empty.
- **Logo URL**: Custom brand logo image for the navigation bar.
- **Default catalog & schema**: Sets the default Unity Catalog path suggested when creating new workspace connections.
- **Admin role suffixes**: Define which Databricks group name suffixes grant admin privileges (e.g., groups ending in `.DataAdmin`). If left empty, **all users are treated as admins**.
- **Query timeout**: Configurable timeout (in seconds) for SQL query execution awareness (default: 300).

### 3. Workspace Setup Wizard

A 4-step wizard for creating and editing workspaces. Each step is accessible via numbered step indicators with progress tracking.

> Service principal credentials for SP fallback are configured once per environment in `databricks.yml` (`secret_scope` / `secret_key`), not per-workspace. See the README for setup details.

#### Step 1: Database Connection

- **Table mode**: Browse and select a Unity Catalog table by navigating **Catalog → Schema → Table** with dropdown selectors.
- **Custom SQL query mode**: Toggle to paste a raw SQL query as the data source instead of selecting a table.
  - **Validate button**: Runs the query against the warehouse and detects all columns (name, type, count).
  - **Format Query button**: Auto-formats the SQL for readability (indentation, keyword casing).
  - **Column type detection**: Automatically classifies columns as dimensions (string, date, boolean types) or measures (numeric types).
  - **No auto-validation**: Validation only runs when the user explicitly clicks the Validate button.
- **Joins**: Configure additional tables to join to the primary source:
  - Specify join table (catalog/schema/table), join keys (left and right columns), and join type (LEFT or INNER).
  - Multiple joins supported.
- **Base filters (Data Scope)**: Define static data-scoping filters that are **always applied** — end-users cannot override or remove these.
  - **Static value filters**: Column equals/in a fixed set of values.
  - **Query-based filters**: Column values come from a sub-query result.
- **Row limit**: Set maximum rows returned per query (enforced server-side up to `max_row_limit` from environment config).

#### Step 2: Columns (Display Names)

The most feature-rich configuration step. Presented as a tabbed table:

- **Column aliases**: Rename any column to a user-friendly display name (e.g., `prod_cd` → `Product Code`).
- **Type overrides**: Override the auto-detected column type (e.g., force a numeric column to be treated as a dimension string).
- **Aggregation overrides**: Set a default aggregation per column (SUM, AVG, COUNT, MIN, MAX, etc.) used in charts and pivots.
- **Excluded columns**: Hide specific columns from end-users entirely — they won't appear in the sidebar or any UI.
- **Column groups**: Organize columns into custom named groups, or use automatic "measures vs. dimensions" grouping.
  - **Pattern-based assignment**: Assign columns to groups via glob or regex patterns.
  - **Explicit assignment**: Manually assign individual columns to groups.
- **Free text filter columns**: Mark specific columns as free-text entry filters. When users add these as filters, they type or paste values rather than selecting from a dropdown list.
- **Search & select columns**: Mark columns to use an on-demand search mechanism. Users type a search term, click a search button, and the server returns up to 50 matching distinct values. Avoids loading all distinct values upfront for large-cardinality columns.
- **Single-select columns**: Force specific columns to be **single-select only** when used as filters. Users cannot multi-select values for these columns.
- **Resizable table columns**: The configuration table headers support column resizing by dragging their borders.
- **Help tooltips**: Each configuration checkbox (Free Text, Search & Select, Single Only) has an info icon (`ℹ`) with a detailed explanation of what it does.
- **Tab navigation**: Columns are organized in tabs by group. Tab bar scrolls horizontally if there are many groups.

#### Dimension Sources (Custom Filters)

Configure custom filter dimensions beyond the table's own columns. Each dimension source appears as a filter chip for end-users.

- **Static values**: Define a fixed list of value/display-label pairs. Useful for hardcoded categories, status codes, etc.
- **Query-based**: Provide a custom SQL query with value and optional display columns. The query runs at filter-load time to populate options.
- **Table-based**: Point to a Unity Catalog table and specify value column (and optional display column). Loads distinct values from that table.
- **Formula-based**: Define a SQL expression (e.g., `YEAR(order_date)`). Values are computed at runtime via `SELECT DISTINCT (expression) FROM main_table`.
- **Partition quick-add**: Auto-generates a query-based dimension source from a table's partition columns for fast setup.
- **Required toggle**: Mark a dimension as required — users **must** select a value before data loads. A "Required" badge and visual highlight appear when no selection is made.
- **Single-select toggle**: Force the dimension filter to single-select mode. Users see "Single only" text instead of Single/Multi toggle buttons.
- **Sort order**: Configure ascending, descending, or custom (preserves the order returned by the source).
- **Display labels**: Show user-friendly labels that differ from the underlying stored values.

#### Cascade Rules

Define parent-child dependencies between filters so child filter options narrow automatically based on parent selections:

- **Parent-child relationships**: Link any column filter to another column filter, any dimension to a column, or dimension to dimension.
- **Link column**: For dimension-based children (query or table source), specify which column in the child source maps to the parent's selected value.
- **Auto-refresh on selection**: When a user selects values in a parent filter and clicks "Done", all child filters automatically reload with narrowed options (e.g., selecting Country = "US" narrows the State filter to US states only).
- **Chain support**: Cascades can chain (A → B → C), so selecting A refreshes B, which in turn refreshes C.

#### Hierarchies

Define ordered drill-down chains for charts and pivot tables:

- **Hierarchy definition**: Create named hierarchies with an ordered list of column levels (e.g., Country → Region → City).
- **Per-level labels**: Each hierarchy level can have a custom display label and sort order.
- **Auto-cascade generation**: Optionally auto-generate cascade rules from hierarchy level adjacencies (adjacent levels become parent→child cascade pairs).
- **Preview**: Sample DISTINCT queries show example values for each level during configuration.
- **Used in charts**: Charts with hierarchy-bound columns show drill-down/drill-up buttons. Clicking a bar/slice drills into the next level.
- **Used in pivot**: Pivot table row dimensions with hierarchies support click-to-drill with breadcrumb navigation.

#### Free-Text Validation Rules

Per-column validation rules that govern what users can type into free-text filter inputs:

- **Auto-transforms** (applied before validation):
  - **Trim**: Strip leading/trailing whitespace.
  - **Strip special characters**: Remove non-alphanumeric characters (except word chars, spaces, dashes).
  - **Deduplicate**: Remove duplicate entries from the input.
  - **Uppercase / Lowercase**: Force all input to a specific case.
  - **Left-pad**: Pad values to a target length with a specified character (e.g., pad demand header numbers to 10 digits with `0`).
- **Allowed characters**: Restrict input to:
  - Digits only
  - Alphanumeric only
  - Alphanumeric + dash
  - Custom regex pattern
- **Prefix/suffix requirements**: Require values to start or end with specific strings.
- **Length constraints**: Exact length, minimum length, maximum length.
- **Pattern matching**: Custom regex pattern with a user-friendly label (e.g., "xxx-xx-xxx format") and custom error message.
- **Client-side enforcement**: Validation runs in the browser before applying; invalid entries show per-line error messages.

#### Abbreviations

- **Global abbreviations**: A shared dictionary of word-to-abbreviation mappings (e.g., "Department" → "Dept") applied when generating column display names.
- **Workspace-level abbreviations**: Override or extend the global list per workspace.
- **API-managed**: Global abbreviations are managed via a dedicated API endpoint (`GET/PUT /api/abbreviations`).

#### Step 3: Capabilities

Toggle which major feature areas are available in the workspace:

- **Core capabilities**:
  - `self_service` — Data Explorer tab (browse, filter, export)
  - `dashboarding` — Dashboard tab (KPIs, charts, pivot)
  - `ai_insights` — AI Assistant features
- **Self-service features** (each independently toggleable):
  - `download_data` — CSV download from Data Explorer
  - `export_excel` — Excel (.xlsx) export
  - `custom_columns` — User-created formula columns
  - `upload_data` — CSV upload and client-side join
  - `subscriptions` — Email subscriptions on presets
  - `presets` — Save/load preset bookmarks
- **Dashboard features**:
  - `kpi_metrics` — KPI card strip on the dashboard
  - `charts` — Chart widgets
  - `pivot_table` — AG Grid pivot table sub-tab
- **AI options** (each with configurable endpoint):
  - `llm_connection` — Custom LLM chat endpoint URL
  - `zenie_space` — Databricks Genie space ID
  - `root_cause_analysis` — RCA agent endpoint URL
- **Upload limit**: Max file size in MB for CSV upload (default: 2 MB).

#### Step 4: Save

- **Workspace name**: Must be unique across the platform. Auto-generates a URL-friendly slug ID (with collision suffix if needed).
- **Description**: Optional text describing the workspace purpose. Shown in the tile popover on the home page.
- **Accent color**: Pick a color used for the workspace tile icon background on the home page.
- **Summary review**: See all configurations at a glance before saving.

### 4. Workspace Management

From the home page tile popovers and the workspace itself:

- **Edit**: Re-open any workspace in the Setup Wizard to modify its configuration.
- **Delete**: Remove a workspace and **cascade-delete** all associated presets, subscriptions, and shared formulas.
- **Clone**: Duplicate an existing workspace configuration as a starting point for a new one.
- **Pin / Unpin**: Pin frequently used workspaces to a dedicated "Pinned" section at the top of the home page.
- **Admin default preset**: Set a workspace-wide default preset that loads automatically for **all users** on first visit to the workspace.

### 5. Shared Formulas

- Admins can create **server-side formula columns** that are available to all users of a workspace.
- Each shared formula has: **alias** (display name), **SQL expression**, and **data type**.
- Full CRUD: create, update, delete shared formulas.
- Shared formulas appear alongside regular columns in the sidebar and can be used in charts, KPIs, and filters.

### 6. Custom Themes

- Create, save, update, and delete custom color themes with full control over:
  - Background colors (app, sidebar, card, card hover, input)
  - Text colors (primary, secondary, muted)
  - Border colors (default, focus)
  - Accent colors (default, hover, subtle)
  - Danger, success, warning colors
- Themes are stored **server-side** and available to all users of the platform.
- Each theme has an owner and a name.

### 7. Storage & Migration

- **Dual storage backends**:
  - **YAML** (local development): Files stored alongside the app (`workspaces.yaml`, `presets.yaml`, etc.)
  - **Delta tables** (production): JSON documents in Unity Catalog Delta tables under a configurable metadata catalog/schema.
- **Delta tables created on first boot**:
  - `workspaces`, `presets`, `custom_themes`, `abbreviations`, `subscriptions`, `shared_formulas`, `app_settings`
- **YAML → Delta migration**: Admin-only API endpoint (`POST /api/admin/migrate-yaml-to-delta`) to bulk-migrate from local YAML files to Delta tables. Safe to run multiple times (insert-only, no duplicates).

---

## End-User Features

### 1. Home Page (Launchpad)

- **Workspace grid**: Visual tile-based grid showing all available workspaces. Each tile displays:
  - Colored icon square with workspace initials (admin-configured accent color)
  - Capability dots (colored indicators for Self-Service, Dashboarding, AI)
  - Workspace name label (max 2 lines, ellipsis overflow)
  - Pin badge for pinned workspaces
- **Search**: Real-time text filter that narrows visible workspaces by name.
- **Capability filter chips**: Filter workspaces by capability — All, Self-Service, Dashboarding, AI. Active chip is highlighted.
- **Sort**: Sort workspaces by name, creation date, or last modified via a dropdown.
- **Popover details**: Click a tile to see a rich popover with:
  - Workspace name and description
  - Data source table/query badge
  - Capabilities breakdown with feature lists
  - Action buttons: Launch, Edit, Clone, Pin/Unpin, Delete
- **Pinned section**: Pinned workspaces appear in a dedicated top section labeled "Pinned" for quick access.
- **Skeleton loading**: Animated placeholder tiles while workspaces load from the server.
- **Tile animations**: Smooth scale-up entry animation for tiles (`lpTileIn` keyframes).

### 2. Data Explorer

- **Column selection**: Choose which columns to include in the output from the sidebar panel. Columns are organized into groups (dimensions vs. measures, or custom admin-defined groups).
- **Column search**: Type to search for columns by name. **Categories auto-expand** to show matching results when a search is active.
- **Drag-and-drop**: Drag columns from the sidebar onto:
  - The filter bar to create a new filter
  - Chart X/Y/group-by zones to bind data
  - The KPI strip to create a KPI card
- **Data table**: Paginated, sortable data grid showing query results with column headers.
- **Row count**: Displays estimated total matching rows and actual loaded row count.
- **SQL preview**: View the generated SQL query for transparency and debugging.
- **Formula columns**: Create custom calculated columns using SQL expressions:
  - **Session formulas**: Temporary columns that exist only in the current session.
  - **Shared formulas**: Admin-created formulas available to all users (see Admin Features).
- **Base filter banner**: When admin-defined base filters are active, a banner shows the data scope restrictions.

### 3. Filters

Filters are added by dragging columns from the sidebar onto the filter area. The filter type is auto-detected based on the column's data type and admin configuration.

#### Standard Filters (Value List)

- **Auto-populated options**: Loads up to **500** distinct values from the column (with `ORDER BY` and `LIMIT`).
- **Search within values**: Type in the popover to filter the dropdown list in real-time.
- **Single / Multi select**: Toggle between selecting one value or multiple values.
  - Admins can **force single-select** — the toggle is replaced with a "Single only" label.
- **Select all / Deselect all**: Bulk action buttons in multi-select mode.
- **Sort toggle**: Switch between ascending and descending sort order within the popover.
- **Cascade refresh**: Selecting values and clicking "Done" triggers automatic refresh of any dependent child filters (per cascade rules).
- **Label display**: Chip label shows "All" (no filter), the single selected value name, or "N selected". Secondary label shows "N of M" count in multi mode.
- **Base filter awareness**: Distinct value queries include workspace base filters so users only see values within their data scope.

#### Date Filters

- **Date range mode**: Pick a custom "From" and "To" date using native date pickers. "To" date is capped at today's date.
- **Preset mode** (date_relative): Quick preset buttons:
  - Today, Yesterday
  - Last 7 Days, Last 30 Days, Last 90 Days
  - This Week, This Month, This Quarter, This Year
- **Mode switching**: Toggle between Date Range, Presets, and Value List views for the same date column.
- **Apply on selection**: Custom range requires both From and To; presets apply immediately.

#### Numeric Range Filters

- **Operators**: Greater than (`>`), greater than or equal (`>=`), less than (`<`), less than or equal (`<=`), equal (`=`), not equal (`!=`), between (two values).
- **Number inputs**: Type numeric values with validation.
- **Switch to value list**: Option to switch to selecting specific numeric values from a distinct list.

#### Free Text Filters

- **Textarea input**: Enter multiple values separated by **commas or newlines**. Each line is treated as a separate filter value.
- **Wildcard support**: Use `*` for pattern matching (translates to SQL `LIKE` with `%`). Values with wildcards skip strict validation.
- **Case sensitivity toggle**: Switch between case-sensitive and case-insensitive matching (appears in the popover header).
- **Auto-transforms**: Values are automatically transformed before validation based on admin-configured rules:
  - Trim whitespace
  - Strip special characters
  - Left-pad with a character to a target length
  - Force uppercase or lowercase
- **Client-side validation**: Each entered value is validated against the admin's rules (length, pattern, allowed characters, prefix/suffix). Invalid entries show **per-line error messages** and block the Apply action.

#### Search & Select Filters

- **On-demand search**: Type at least **2 characters** and click the **Search button** (or press Enter) to query the server.
- **Server-side matching**: Runs `SELECT DISTINCT column FROM table WHERE LOWER(CAST(col AS STRING)) LIKE '%term%' LIMIT 50` with base filters applied.
- **Selected tags**: Chosen values appear as removable tags above the search results for easy management.
- **Single / Multi mode**: Respects admin-configured single-select enforcement. In single mode, selecting a new value replaces the previous one.
- **Loading spinner**: Visual feedback (spinner icon on the search button) during server search.
- **Minimum characters**: Search button is disabled until the minimum character count is met.

#### Dimension Filters (Custom)

- **Dynamic value loading**: Values load based on the dimension source type:
  - **Static**: Predefined list loads instantly.
  - **Query**: Custom SQL runs on popover open.
  - **Table**: `SELECT DISTINCT` from the configured table.
  - **Formula**: `SELECT DISTINCT (expression)` from the main table.
- **Display labels**: Can show user-friendly labels different from the underlying raw values (e.g., display "United States" but filter by "US").
- **Required indicator**: Required dimensions show a red "Required" badge and highlight styling when no selection is made. Data won't load until all required dimensions have selections.
- **Sort options**: Ascending, descending, or custom (preserves source order).
- **Single-select enforcement**: Respects the `forceSingleSelect` toggle from admin configuration.
- **Cascade support**: Dimension filters participate in cascade chains just like standard column filters.

#### Dynamic Filter Builder

- **Advanced filter expressions**: Create complex filter logic beyond simple value selection.
- **Multiple groups**: Each group contains conditions joined by **AND** or **OR**; groups are joined by a **root operator** (AND/OR).
- **Condition operators**: `=`, `!=`, `>`, `>=`, `<`, `<=`, `BETWEEN`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL`.
- **Value types**: Compare a column against a **literal value** or against **another column's values**.
- **Column-type-aware operators**: The available operators change based on the column's data type (e.g., LIKE only for strings).
- **Enable / Disable**: Toggle individual dynamic filters on or off without deleting them.
- **Saved with presets**: Dynamic filter configurations persist in preset snapshots and restore on load.
- **SQL generation**: Each condition generates proper SQL with escaping; groups are parenthesized and joined; all enabled dynamic filters are ANDed into the main WHERE clause.

### 4. Dashboard

#### KPI Cards

- **Drag-to-create**: Drag any column from the sidebar onto the KPI strip to create a new metric card.
- **Aggregations**: SUM, AVG, COUNT, COUNT_DISTINCT, MIN, MAX, NONE.
- **Special row count**: A virtual `__row_count__` column (available in the Design sidebar under "Special Measures") displays the total row count matching current filters using `COUNT(*)`.
- **Number formats**:
  - **Compact**: Abbreviated (1.2K, 3.4M, 5.6B)
  - **Number**: Full formatted number (1,234,567)
  - **Currency**: Dollar-prefixed ($1,234)
  - **Percent**: Percentage format (12.3%)
- **Prefix / Suffix**: Add custom text before or after the value (e.g., "$", "units", "%").
- **Animated count-up**: Values animate from 0 to the actual number when loading completes.
- **Edit dialog**: Click the edit icon to modify title, column, aggregation, format, prefix, and suffix.
- **Drag-reorder**: Rearrange KPI cards by dragging them along the strip.
- **Filter-aware**: KPI queries respect **all** applied filters — column filters, dimension filters, dynamic filters, and admin-defined base filters.

#### Charts

Eleven chart types, all powered by Apache ECharts:

- **Bar chart**: Vertical bars with configurable corner radius. Stacked mode available. When there's a single Y measure with no group-by, bars get **per-category colors** from the palette.
- **Line chart**: Smooth or straight lines. Show/hide data point symbols. Supports stacking.
- **Area chart**: Filled area with gradient fills. Smooth curves option. Stacked mode.
- **Pie chart**: Standard or donut style (configurable inner radius via `pieInnerRadius`). Labeled slices.
- **Scatter plot**: X-Y point distribution for correlation analysis.
- **Heatmap**: Matrix visualization with color intensity mapping via a visual map legend. X = categories, Y = column names.
- **Radar chart**: Multi-axis radar/spider diagram for multi-metric comparison.
- **Funnel chart**: Stage-based funnel with automatic descending sort. Labels inside bars.
- **Treemap chart**: Hierarchical area-proportional visualization. Supports group-by for nested treemaps with parent-child grouping. Breadcrumb navigation.
- **Gauge chart**: Single-value gauge with pointer and progress arc. Can render with **only a Y column** (no X needed). Max value auto-detected from data.
- **Table chart**: Renders data as a sortable data table instead of a visual chart.

#### Chart Settings

Each chart widget has a settings panel with these options:

- **Palette**: Choose from multiple color palette presets for series colors.
- **Legend**: Show/hide legend; position options (top, bottom, left, right).
- **Data labels**: Show/hide value labels directly on data points.
- **X-axis**: Show/hide; label rotation angle.
- **Y-axis**: Show/hide; min/max value bounds.
- **Number format**: Format for displayed values.
- **Stacked mode**: Stack series on top of each other (bar, line, area).
- **Smooth lines**: Curved vs. straight lines (line, area).
- **Show symbols**: Show/hide data point markers (line, area).
- **Sort order**: Ascending, descending, or no sort on chart data.
- **Row limit**: Cap the number of data points rendered in the chart.
- **Data zoom**: Enable an interactive zoom slider on the X axis for panning through large datasets.
- **Aggregation**: SUM, AVG, COUNT, MIN, MAX, NONE — applied in the chart's SQL `GROUP BY` query.

#### Chart Binding

- **X columns (dimensions)**: Drag non-numeric columns to the X axis. First non-numeric drop goes to X.
- **Y columns (measures)**: Drag numeric columns to the Y axis. Multiple Y columns create multi-series charts.
- **Group by (color/breakdown)**: Drag a dimension column to split data into separate series (up to 20 distinct group values). Additional non-numeric drops after X go to group-by.
- **Column picker**: Search and select columns via a dropdown in the binding section of settings.
- **Binding migration**: Legacy single-column bindings are automatically migrated to the multi-column format.

#### Dynamic Dimension

- A special virtual column (`__dynamic_dimension__`) available in the **Design** sidebar under "Dynamic Fields".
- When bound to a chart's X axis, a **dimension dropdown** appears on the chart widget header.
- End-users can **switch the dimension at runtime** (e.g., switch between viewing data by Country, Region, or Product) without reconfiguring the chart.
- Options are populated from the workspace's dimension columns, filtered by selected output columns.
- Dynamic dimension value is saved in preset snapshots.

#### Dashboard Layout

- **2-column grid**: Widgets arranged in a responsive 2-column CSS grid layout.
- **Widget sizing**: Each widget can be **1×1** (half-width) or **2×1** (full-width), controlled via a span toggle.
- **Drag-reorder**: Rearrange widgets by dragging to change their position in the grid.
- **Drop zone**: Drop a chart type from the sidebar Design panel to create a new empty widget.
- **Dashboard filter bar**: A compact read-only filter bar on the dashboard tab showing the currently applied filters for context.

#### Chart Interactions

- **Export as CSV**: Download the chart's underlying data as a CSV file.
- **Export as PNG**: Download the chart as a PNG image via ECharts' `getDataURL`.
- **Drill-down**: When hierarchies are configured, clicking chart elements (bars, slices, etc.) drills into the next hierarchy level. Drill-up buttons and breadcrumbs navigate back.

### 5. Pivot Table

Full-featured pivot table powered by AG Grid Community:

- **Row fields**: Drag dimensions to define row groupings.
- **Column fields**: Drag dimensions to column pivots to create crosstab layouts.
- **Value fields**: Drag measures with configurable aggregation.
- **Aggregation options**: SUM, AVG, COUNT, COUNT_DISTINCT, MIN, MAX, **MEDIAN** (`PERCENTILE_APPROX`), **STDDEV** — more options than charts.
- **Field search**: Search available fields by name in the field picker.
- **Format per value**: Configure number format individually for each value field.
- **Grand total row**: Optional summary row at the bottom of the pivot.
- **Heatmap coloring**: Visual heat coloring on value cells for quick pattern recognition.
- **Hierarchy drill**: Click on drillable row dimensions to drill into child hierarchy levels. Breadcrumb navigation to drill back up. Jump to any level.
- **Server-side aggregation**: SQL query uses `GROUP BY ALL` with up to **50,000** rows from the server.
- **CSV export**: Export the current pivot view as a CSV file.
- **Theme-aware**: Uses AG Grid's quartz theme (light) or quartz-dark theme based on the app's current color scheme.
- **Preset persistence**: Pivot configuration (row/col/value fields, formats, settings) is saved in preset snapshots.

### 6. Presets (Bookmarks)

Save and restore complete workspace states:

- **Captured state**: A preset snapshot includes:
  - Selected table and output columns
  - Formula columns (session-level)
  - All filter states (selected values, date ranges, numeric conditions)
  - Dynamic filters (groups, conditions, enabled state)
  - Dimension filter selections
  - Chart widgets (type, binding, settings — **not** cached data)
  - Dashboard layout and widget sizing
  - KPI cards (columns, aggregations, formats)
  - Pivot configuration
  - Theme configuration (color scheme)
  - Active tab (Data/Dashboard)
- **Save preset**: Click "Save" to capture the current state with a name and optional description.
- **Load preset**: Select a preset to restore its saved state. Validates columns against current metadata and warns about any missing columns.
- **Overwrite**: Update an existing preset with the current state via "Save" on an already-loaded preset.
- **Duplicate**: Clone a preset to create a variation without modifying the original.
- **Rename**: Change the preset's display name.
- **Public / Private**: Toggle visibility — public presets are visible to all workspace users; private only to the creator.
- **User default**: Set a personal default preset (saved in browser localStorage) that auto-loads when opening the workspace.
- **Admin default**: Admins can set a workspace-wide default preset (saved on the server) that loads for **all users** who haven't set their own default.
- **Dirty detection**: A visual indicator appears when the current state differs from the loaded preset (compares tables, widgets, filters, KPIs, output columns, and color scheme).
- **Keyboard shortcut**: `Ctrl+S` / `Cmd+S` to quick-save the current preset.
- **Auto-load**: On workspace open, automatically loads the user's default → admin default → or clean state, in that priority order.

### 7. Subscriptions

Email-based scheduled data delivery (when `subscriptions` feature is enabled):

- **Email subscriptions**: Subscribe to a preset's data export on a recurring schedule.
- **Frequency options**:
  - **Daily**: Delivers every day.
  - **Weekly**: Pick day of week (Monday through Sunday).
  - **Monthly**: Pick day of month (1–28, or -1 for last day of month).
- **Export format**: CSV or Excel (.xlsx) per subscription.
- **Multiple recipients**: Add multiple email addresses per subscription.
- **Batch management**: Add, edit, enable/disable, or remove subscriptions in batch. Batch save updates all at once.
- **Preset-linked**: Each subscription is tied to a specific preset and workspace. Deleting a preset cascade-deletes its subscriptions.

### 8. Data Export

Multiple export options across the application:

- **Data Explorer CSV**: Export current query results as CSV (UTF-8 with BOM for Excel compatibility). Feature: `download_data`.
- **Data Explorer Excel**: Export as `.xlsx` file using openpyxl on the server. Feature: `export_excel`.
- **Chart CSV**: Export individual chart data as a CSV file via the chart's menu.
- **Chart PNG**: Export individual charts as PNG images via ECharts' `getDataURL`.
- **Pivot CSV**: Export the current pivot table view as a CSV file.
- **Full result set**: Server-side exports (CSV/Excel) run the full SQL **without** the frontend row limit, capturing all matching data.

### 9. Upload Data

Client-side CSV upload and join (when `upload_data` feature is enabled):

- **CSV / TSV upload**: Upload a CSV file (auto-detects TSV if first line contains tabs).
- **Size limit**: Configurable per workspace (default: 2 MB, set in Capabilities step).
- **Join configuration**: After upload, configure:
  - Join keys: which column in the uploaded file maps to which column in the primary table.
  - Join type: LEFT join (keep all primary rows) or INNER join (only matching rows).
- **Client-side parsing**: File is parsed entirely in the browser — no server upload, keeping data local.
- **Merge with primary data**: Uploaded columns appear alongside primary table columns in the Data Explorer.

### 10. Theme & Appearance

- **Built-in color schemes**: Nike Dark, Nike Light (black & white), Dark, Light, Midnight, Nord, Slate, Minimal, Corporate.
- **Custom theme editor**: Full control over every color token:
  - Background: app, sidebar, card, card hover, input
  - Text: primary, secondary, muted
  - Borders: default, focus
  - Accent: default, hover, subtle
  - Semantic: danger, success, warning
- **Save custom themes**: Persist custom themes server-side for reuse across sessions and users.
- **Density options**:
  - **Compact**: Smaller text, tighter spacing (root font-size: 14px)
  - **Comfortable**: Default balanced sizing (root font-size: 16px)
  - **Spacious**: Larger text, more padding (root font-size: 18px)
- **Per-workspace theme**: Each workspace stores its own default theme and density in settings. Applied when the workspace opens.
- **Real-time preview**: Theme and density changes apply instantly without page reload.
- **Chart palettes**: Independent from the app theme — each chart widget can use a different color palette.

### 11. Focus Mode

- **Distraction-free viewing**: Toggle via **F11** or **Ctrl+Shift+F** to hide the header, navigation tabs, status bar, and preset bar.
- **Collapsible sidebar**: A floating sidebar remains accessible for column selection and chart design.
- **Escape to exit**: Press **Esc** to return to the normal view.
- **Full-screen dashboard**: Ideal for presenting dashboards on shared screens or during meetings.

### 12. Navigation & UX

- **Keyboard shortcuts**: Various shortcuts for common actions:
  - `Ctrl+S` / `Cmd+S` — Save preset
  - `F11` / `Ctrl+Shift+F` — Toggle focus mode
  - `Esc` — Exit focus mode
- **Status bar**: Bottom bar showing connection info, active query status, and row counts.
- **Guided tours**: Interactive step-by-step onboarding tours for:
  - Home page orientation
  - Workspace overview
  - Data tab walkthrough
  - Dashboard features
  - Setup Wizard guide
- **Help drawer**: Contextual help panel accessible from the interface.
- **Skeleton loading**: Animated placeholder content during data loading throughout the app.
- **Animated transitions**: Smooth tile entry animations, popover slide-ins, count-up number animations, and progress bar transitions.

### 13. Documentation

- **Built-in docs page**: Accessible from the home page navigation bar ("Docs" link).
- **Dual guides**: Separate **User Guide** and **Admin Guide** sections with tabbed navigation.
- **Searchable**: Full-text search across all documentation sections.
- **Font size control**: Adjustable text size for readability.
- **In-app screenshots**: Visual references for each feature section.

---

## AI & Intelligence Features

### 1. Genie Integration (Databricks AI)

- **Natural language queries**: Ask questions in plain English; Genie translates to SQL and returns data results.
- **Conversation support**: Multi-turn conversations with context retention via `conversation_id`.
- **Space-based**: Connects to a configured Databricks Genie space ID (set in workspace AI settings).
- **Result display**: Shows text explanations, generated SQL, and tabular grid results from query execution.
- **Polling**: Backend polls Genie API for up to 120 seconds (2-second intervals) waiting for completion.

### 2. LLM Chat Endpoint

- **Custom LLM integration**: Configure a custom LLM endpoint URL for AI-powered chat assistance within the workspace.
- **Floating chat bubble**: Accessible from the workspace UI for quick questions.

### 3. Root Cause Analysis

- **RCA Agent**: Configure an endpoint for automated root cause analysis of data anomalies.
- **Workspace-scoped**: Each workspace can have its own RCA endpoint.

---

## Security & Access Control

- **OAuth / PAT authentication**: User identity flows through Databricks reverse-proxy headers (`x-forwarded-access-token`). All SQL queries run under the user's identity.
- **Service principal fallback**: When user tokens fail, the system falls back to a configured service principal via Databricks Secrets (`secret_scope` / `secret_key`).
- **Role-based access**: Two roles — **Admin** and **Consumer**:
  - Role is determined by Databricks group membership: if any group name ends with a configured suffix → Admin.
  - Admins can access the Setup Wizard, Platform Settings, workspace management.
  - Consumers can use Data Explorer, Dashboard, Presets, and Exports.
  - If no admin suffixes are configured, **everyone is treated as admin**.
- **CORS**: Configurable allowed origins for cross-origin API requests.
- **Data scoping (Base Filters)**: Admin-defined base filters ensure users only see data within their authorized scope. These are enforced on every query — filters, charts, KPIs, exports, and distinct value lists.
- **No client-side secret exposure**: Secrets are resolved server-side via Databricks Secrets API; tokens never reach the browser.

---

*This document covers all features as of the current codebase version. It is automatically kept in sync — see `.cursor/rules/keep-docs-updated.mdc`.*
