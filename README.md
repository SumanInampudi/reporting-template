# BI Excellence Dashboard

A self-service BI dashboard that connects to **Databricks** tables via Unity Catalog. Teams can configure workspaces, build charts, create KPI cards, pivot data, and manage presets — all through a browser UI deployed as a Databricks App.

## Architecture

```
databricks.yml / .env             ← Infrastructure config: warehouse, metadata location, secret scope
        │
        ▼
backend/ (FastAPI + Uvicorn)      ← Python API: SQL queries, workspace/preset CRUD
   ├── db.py                      ← Databricks SQL connector with SP fallback
   ├── rbac.py                    ← Role-based access control (admin/consumer)
   ├── storage.py                 ← Persistence router (YAML or Delta)
   ├── storage_delta.py           ← Delta table backend (production)
   └── storage_yaml.py            ← YAML file backend (local dev)
        │
        ▼
frontend/ (React + Vite)          ← Dashboard UI
   ├── Home Page                  ← Launchpad-style workspace tiles
   ├── Setup Wizard               ← Multi-step workspace builder
   ├── Data & Filters tab         ← Table explorer, column selector, filters
   ├── Dashboard tab              ← KPI cards, ECharts, AG Grid pivot table
   └── AI Insights (optional)     ← LLM-powered analysis via chat bubble
```

---

## Quick Start for New Teams

### What you change in YAML

A handful of infrastructure values must be set in `databricks.yml` before you deploy — everything else is configured in the UI. Edit the variables marked with ✏️:

```yaml
variables:
  app_slug:
    default: "your-team-slug"           # ✏️ URL-safe app name (e.g. "emea-orderbook")

targets:
  dev:
    variables:
      warehouse_id: "your-dev-warehouse-id"             # ✏️
      app_metadata_catalog: "development"               # ✏️ Where metadata tables live
      app_metadata_schema: "your_team_bi_metadata"      # ✏️ Unique schema per team
      secret_scope: "your-team-secrets-non-prod"        # ✏️ Secret scope for SP fallback ("none" to disable)
      secret_key: "sp-token"                            # Default key name; override if different

  prod:
    variables:
      warehouse_id: "your-prod-warehouse-id"            # ✏️
      app_metadata_catalog: "non_published_analytics"   # ✏️
      app_metadata_schema: "your_team_bi_metadata"      # ✏️
      secret_scope: "your-team-secrets"                 # ✏️ Prod secret scope
      secret_key: "sp-token"
```

> **Heads up:** the `secret_scope` must already exist in Databricks and contain the SP PAT before you deploy. See [Step 8](#8-service-principal-setup) for one-time setup, or set `secret_scope: "none"` to skip SP fallback entirely.

### What you configure in the UI (everything else)

After first deploy, the app guides you through setup — no more YAML editing:

| Setting | Where in UI |
|---------|-------------|
| Team / Platform Name | Onboarding screen (first visit) or **Settings** in nav bar |
| Admin Role Suffixes | **Settings** → Admin Role Suffixes |
| Query Timeout | **Settings** → Query Timeout |
| Data sources, capabilities, features | Per-workspace via the **Setup Wizard** |
| Presets, themes, filters | Per-workspace via the workspace UI |

---

## Step-by-Step Setup

### 1. Prerequisites

- Python 3.10+
- Node.js 18+ with `npm`
- Databricks CLI >= 0.250.0 (`databricks -v`)
- Access to a Databricks SQL Warehouse
- A service principal (SP) token in a Databricks secret scope (for deployed environments)

### 2. Clone the Repository

```bash
git clone <repo-url>
cd tools/dashboarding-template
```

### 3. Configure `databricks.yml`

Edit the infrastructure values described above. These cannot be moved to the UI because the app needs them to start:

| Variable | Why it must be in YAML |
|----------|----------------------|
| `app_slug` | Determines the Databricks App name/URL — needed at deploy time |
| `warehouse_id` | SQL warehouse connection — backend can't start without it |
| `app_metadata_catalog` | Location of metadata Delta tables — needed before any UI exists |
| `app_metadata_schema` | Same — the settings database can't store its own location |
| `secret_scope` | Holds the service-principal PAT used as a fallback when a user's OAuth token can't query the warehouse. Set to `none` to disable SP fallback (queries then run only as the logged-in user). |
| `secret_key` | Key inside the scope that stores the SP PAT (default: `sp-token`). |

### 4. Local Development

```bash
# Copy the example env file and fill in your values
cp .env.example .env

# Start the full app locally (backend + frontend)
bash deploy-local.sh
```

Or start backend and frontend separately:

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
backend/.venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api/*` to the backend.

### 5. First Launch — Onboarding

When the app starts with no workspaces and no saved settings, you'll see the **Onboarding Screen**:

1. Enter your **Team / Platform Name** (e.g. "ZOOM 360", "EMEA Analytics")
2. Click **Get Started**
3. You're taken to the home page where you can create workspaces

### 6. Platform Settings (Admin)

Click **Settings** in the nav bar to configure:

- **Team / Platform Name** — rename anytime
- **Admin Role Suffixes** — comma-separated AD group suffixes that grant admin role (e.g. `DataAdmin,ClusterAdmin`). Leave empty = everyone is admin.
- **Query Timeout** — max SQL query execution time in seconds (default: 300)

These are stored in the database and override any env var / YAML defaults.

### 7. Deploy to Databricks

```bash
# Deploy to dev (default target)
./deploy-databricks.sh

# Deploy to production
./deploy-databricks.sh prod
```

The script handles everything: validation → code upload → app start. After deployment:

| Target | App Name | URL Pattern |
|--------|----------|-------------|
| dev | `<app_slug>-dev` | `https://<app_slug>-dev-<workspace-id>.<region>.databricksapps.com/` |
| prod | `<app_slug>-prod` | `https://<app_slug>-prod-<workspace-id>.<region>.databricksapps.com/` |

On first boot, the app automatically creates these Delta tables:

```
<metadata_catalog>.<metadata_schema>.workspaces
<metadata_catalog>.<metadata_schema>.presets
<metadata_catalog>.<metadata_schema>.custom_themes
<metadata_catalog>.<metadata_schema>.abbreviations
<metadata_catalog>.<metadata_schema>.app_settings
<metadata_catalog>.<metadata_schema>.shared_formulas
<metadata_catalog>.<metadata_schema>.subscriptions
```

### 8. Service Principal Setup

Before you deploy, you need a Databricks **secret scope** holding a service-principal PAT. The app uses this token as a fallback when a user's OAuth token can't reach the SQL warehouse (e.g. they don't have direct `CAN_USE` permission on the warehouse), and to access metadata tables in catalogs not granted to all users.

**Create the scope and store the token (one-time, per environment):**

```bash
# Create scope (use a different scope name per environment, dev vs prod)
databricks secrets create-scope your-team-secrets-non-prod

# Store the SP token under the key referenced in databricks.yml (default: sp-token)
databricks secrets put-secret your-team-secrets-non-prod sp-token
# (paste the SP PAT when prompted)

# Grant the deployed app permission to read the scope
databricks secrets put-acl your-team-secrets-non-prod <app-service-principal> READ
```

Then **reference these scope names** in `databricks.yml` under each target's `secret_scope` (see [Step 3](#3-configure-databricksyml)).

**SP token permissions required:**

| Resource | Permissions |
|----------|-------------|
| Metadata catalog + schema | `USAGE`, `CREATE TABLE`, `SELECT`, `INSERT`, `DELETE` |
| Data catalogs/schemas | `USAGE`, `SELECT` |
| SQL Warehouse | `CAN_USE` |

> **Skip this step** if all your users will have direct warehouse access — set `secret_scope: "none"` in `databricks.yml` and the app will run queries only as the logged-in user (no SP fallback).

---

## Multi-Team Isolation

Each team deploys independently with their own `app_slug` and `app_metadata_schema`:

```
development.team_alpha_metadata.workspaces     ← Team Alpha
development.team_alpha_metadata.presets
development.team_alpha_metadata.app_settings

development.team_beta_metadata.workspaces      ← Team Beta
development.team_beta_metadata.presets
development.team_beta_metadata.app_settings
```

Teams share the same codebase but have completely separate data. No team can see or modify another team's workspaces, presets, or settings.

---

## Features

| Feature | Description |
|---------|-------------|
| **Launchpad Home** | macOS-style tile grid with search, filter, sort, and pinning |
| **Workspaces** | Named configurations pointing to a data source with capabilities |
| **Setup Wizard** | 4-step guided workspace builder (connection, columns, capabilities, save) |
| **Custom SQL Datasource** | Paste a custom SQL query as a data source with validation and formatting |
| **Data & Filters** | Browse catalogs/schemas/tables, select columns, apply filters, preview data |
| **Data Scope** | Admin-defined base filters that restrict data across the entire workspace |
| **Filter Types** | Value list, date range/presets, numeric range, free text, search & select |
| **Single-Select Enforcement** | Admin can force specific columns/dimensions to single-select only |
| **Dimension Sources** | Custom filters from static values, SQL queries, tables, or formulas |
| **Cascade Rules** | Parent-child filter dependencies with auto-refresh |
| **Hierarchies** | Drill-down chains for charts and pivot (e.g., Country → Region → City) |
| **Validation Rules** | Admin-configured input validation for free-text filters (length, pattern, padding, case) |
| **Dynamic Filter Builder** | Advanced AND/OR filter groups with 13+ operators |
| **KPI Cards** | Configurable metric cards with aggregation, formatting, and row count |
| **Charts** | 11 ECharts types (bar, line, pie, scatter, area, heatmap, radar, funnel, treemap, gauge, table) |
| **Dynamic Dimension** | Runtime dimension switching on charts without reconfiguration |
| **Pivot Table** | AG Grid pivot with heatmaps, drill-down, MEDIAN/STDDEV aggregations, and export |
| **Presets** | Save/load dashboard states; admin and user defaults; dirty detection |
| **Subscriptions** | Scheduled email delivery of preset data (daily/weekly/monthly, CSV/Excel) |
| **Upload Data** | CSV upload with client-side join to primary table |
| **Export** | CSV, Excel, chart PNG, and pivot CSV export |
| **Shared Formulas** | Server-side reusable formula columns for all workspace users |
| **AI Assistant** | Genie AI, custom LLM, and root cause analysis integration |
| **Themes** | 9 color schemes + fully custom themes with server persistence |
| **Density** | Compact, comfortable, and spacious UI density modes |
| **RBAC** | Admin/consumer roles based on Databricks group membership |
| **Focus Mode** | Distraction-free dashboard viewing (F11 / Ctrl+Shift+F) |
| **Guided Tours** | Interactive onboarding tours for home, workspace, data, and dashboard |
| **Built-in Docs** | Searchable user and admin guides with in-app navigation |
| **Platform Settings** | UI-managed team name, admin roles, query timeout |
| **Onboarding** | First-time setup screen for new deployments |

> **Detailed feature documentation**: See [`features.md`](features.md) for an exhaustive breakdown of every feature with full descriptions.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript + Vite | UI framework |
| Charts | Apache ECharts | Visualizations |
| Pivot Table | AG Grid Community | Sortable/filterable pivot output |
| Layout | react-grid-layout | Dashboard widget grid |
| Drag & Drop | @dnd-kit | Field/chart drag interactions |
| State | Zustand | State management |
| Backend | FastAPI (Python) | REST API |
| DB Connector | databricks-sql-connector | SQL warehouse queries |
| Storage | Delta tables (Unity Catalog) | Workspace/preset/settings persistence |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/me` | Current user info + role + groups |
| GET | `/api/config` | App configuration (team name, limits, security) |
| GET | `/api/catalogs` | List Unity Catalog catalogs |
| GET | `/api/catalogs/{c}/schemas` | List schemas |
| GET | `/api/catalogs/{c}/schemas/{s}/tables` | List tables |
| GET | `/api/catalogs/{c}/schemas/{s}/tables/{t}/columns` | Describe columns |
| GET | `/api/tables` | Tables in default catalog/schema |
| GET | `/api/tables/{name}/columns` | Describe columns in default catalog/schema |
| POST | `/api/query` | Execute SQL `{ sql, limit }` |
| POST | `/api/export-csv` | Stream CSV export (full result set) |
| POST | `/api/export-excel` | Stream Excel (.xlsx) export |
| GET | `/api/secret-scopes` | List Databricks secret scopes |
| POST | `/api/test-connection` | Test database connectivity |
| GET | `/api/workspaces` | List all workspaces |
| POST | `/api/workspaces` | Create a workspace |
| GET | `/api/workspaces/{id}` | Get a workspace |
| PUT | `/api/workspaces/{id}` | Update a workspace |
| DELETE | `/api/workspaces/{id}` | Delete workspace + cascaded data |
| PATCH | `/api/workspaces/{id}/default-preset` | Set/clear admin default preset |
| GET | `/api/workspaces/{id}/presets` | List presets |
| POST | `/api/workspaces/{id}/presets` | Create a preset |
| GET | `/api/workspaces/{id}/presets/{pid}` | Get a preset |
| PUT | `/api/workspaces/{id}/presets/{pid}` | Update a preset |
| DELETE | `/api/workspaces/{id}/presets/{pid}` | Delete a preset |
| POST | `/api/workspaces/{id}/presets/{pid}/duplicate` | Duplicate a preset |
| GET | `/api/workspaces/{wid}/presets/{pid}/subscriptions` | List subscriptions |
| POST | `/api/workspaces/{wid}/presets/{pid}/subscriptions` | Create subscription |
| PUT | `/api/workspaces/{wid}/presets/{pid}/subscriptions` | Batch update subscriptions |
| PUT | `/api/workspaces/{wid}/presets/{pid}/subscriptions/{sid}` | Update subscription |
| DELETE | `/api/workspaces/{wid}/presets/{pid}/subscriptions/{sid}` | Delete subscription |
| GET | `/api/workspaces/{id}/shared-formulas` | List shared formulas |
| POST | `/api/workspaces/{id}/shared-formulas` | Create shared formula |
| PUT | `/api/workspaces/{id}/shared-formulas/{fid}` | Update shared formula |
| DELETE | `/api/workspaces/{id}/shared-formulas/{fid}` | Delete shared formula |
| GET | `/api/custom-themes` | List custom themes |
| POST | `/api/custom-themes` | Create custom theme |
| PUT | `/api/custom-themes/{id}` | Update custom theme |
| DELETE | `/api/custom-themes/{id}` | Delete custom theme |
| GET | `/api/abbreviations` | List global abbreviations |
| PUT | `/api/abbreviations` | Replace global abbreviations |
| GET | `/api/app-settings` | Get platform settings |
| PATCH | `/api/app-settings` | Update platform settings |
| POST | `/api/genie/ask` | Ask Databricks Genie AI |
| POST | `/api/admin/migrate-yaml-to-delta` | One-time YAML → Delta migration |

---

## Environment Variables Reference

These are set via `databricks.yml` (deployed) or `.env` (local). Settings marked with **UI** can also be managed from the Platform Settings modal after deployment.

| Variable | Required | Default | UI? | Description |
|----------|----------|---------|-----|-------------|
| `DATABRICKS_HOST` | Yes | — | No | Workspace URL |
| `DATABRICKS_TOKEN` | Local only | — | No | Personal access token |
| `DATABRICKS_WAREHOUSE_ID` | Yes | — | No | SQL warehouse ID |
| `DEFAULT_CATALOG` | Yes | `main` | No | Default data catalog |
| `DEFAULT_SCHEMA` | Yes | `default` | No | Default data schema |
| `AUTH_MODE` | Yes | `pat` | No | `pat` (local) or `oauth` (deployed) |
| `STORAGE_BACKEND` | Yes | `yaml` | No | `delta` (recommended) or `yaml` |
| `APP_METADATA_CATALOG` | If delta | `development` | No | Catalog for metadata tables |
| `APP_METADATA_SCHEMA` | If delta | `bi_app_metadata` | No | Schema for metadata tables |
| `DEFAULT_SECRET_SCOPE` | Deployed | `none` | No | Databricks secret scope for SP token |
| `DEFAULT_SECRET_KEY` | Deployed | `sp-token` | No | Key within the secret scope |
| `TEAM_NAME` | No | `BI Excellence Suite` | **Yes** | Display name (overridden by UI) |
| `ADMIN_ROLE_SUFFIXES` | No | _(all admin)_ | **Yes** | Group suffixes granting admin role |
| `QUERY_TIMEOUT_SECONDS` | No | `300` | **Yes** | SQL query timeout |
| `ALLOWED_CATALOGS` | No | _(all)_ | No | Comma-separated catalog allowlist |
| `DEFAULT_ROW_LIMIT` | No | `0` | No | Default query row limit (0 = no limit) |
| `MAX_ROW_LIMIT` | No | `0` | No | Max query row limit (0 = no limit) |
| `LOG_LEVEL` | No | `INFO` | No | Python log level |

---

## Data Migration

If you have existing YAML data and want to migrate to Delta:

```bash
curl -X POST http://localhost:8000/api/admin/migrate-yaml-to-delta
```

Safe to run multiple times — it only inserts records that don't already exist.
