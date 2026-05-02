# BI Excellence Dashboard

A self-service BI dashboard that connects to **Databricks** tables via Unity Catalog. Teams can configure workspaces, build charts, create KPI cards, pivot data, and manage presets — all through a browser UI deployed as a Databricks App.

## Architecture

```
.env / databricks.yml          ← Configuration (connection, auth, metadata storage)
        │
        ▼
backend/ (FastAPI + Uvicorn)   ← Python API: SQL queries, workspace/preset CRUD
   ├── db.py                   ← Databricks SQL connector with SP fallback
   ├── storage.py              ← Persistence router (YAML or Delta)
   ├── storage_delta.py        ← Delta table backend (production)
   └── storage_yaml.py         ← YAML file backend (optional local dev)
        │
        ▼
frontend/ (React + Vite)       ← Dashboard UI
   ├── Data & Filters tab      ← Table explorer, column selector, filters
   ├── Dashboard tab            ← KPI cards, ECharts, AG Grid pivot table
   └── AI Insights tab          ← LLM-powered analysis (optional)
```

## Team Onboarding — Setup Checklist

When your team clones this repo, follow these steps to get running:

### 1. Prerequisites

- Python 3.10+ with `pip`
- Node.js 18+ with `npm`
- Databricks CLI >= 0.250.0 (for DAB deployment)
- Access to a Databricks SQL Warehouse
- A service principal (SP) token stored in a Databricks secret scope

### 2. Local Development Setup

```bash
# Clone and enter the project
git clone <repo-url>
cd tools/dashboarding-template

# Copy the example env file
cp .env.example .env
```

Edit `.env` with your team's values:

```bash
# ── Databricks connection ──────────────────────────
DATABRICKS_HOST=your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=dapi...                  # Your personal PAT (local dev only)
DATABRICKS_WAREHOUSE_ID=your-warehouse-id

# ── Default data catalog ───────────────────────────
DEFAULT_CATALOG=development
DEFAULT_SCHEMA=default
ALLOWED_CATALOGS=development              # Comma-separated, or empty for all

# ── Auth mode ──────────────────────────────────────
AUTH_MODE=pat                             # "pat" for local, "oauth" for deployed

# ── App metadata storage ──────────────────────────
STORAGE_BACKEND=delta                     # "delta" (recommended) or "yaml"
APP_METADATA_CATALOG=development          # Catalog for metadata tables
APP_METADATA_SCHEMA=your_team_app_schema  # Schema — unique per team!

# ── Service Principal (optional for local) ─────────
DEFAULT_SECRET_SCOPE=your-secret-scope    # Databricks secret scope with SP token
DEFAULT_SECRET_KEY=sp-token               # Key within the scope
```

### 3. Start the Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
backend/.venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

On first startup, the app automatically creates these Delta tables:
```
<APP_METADATA_CATALOG>.<APP_METADATA_SCHEMA>.workspaces
<APP_METADATA_CATALOG>.<APP_METADATA_SCHEMA>.presets
<APP_METADATA_CATALOG>.<APP_METADATA_SCHEMA>.custom_themes
<APP_METADATA_CATALOG>.<APP_METADATA_SCHEMA>.abbreviations
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api/*` to the backend.

### 5. Deploy to Databricks (DAB)

Update the target variables in `databricks.yml` for your team:

```yaml
targets:
  dev:
    variables:
      warehouse_id: "your-warehouse-id"
      catalog: "development"
      schema: "default"
      allowed_catalogs: "development,published_analytics"
      secret_scope: "your-secrets-non-prod"
      secret_key: "sp-token"
      app_metadata_catalog: "development"
      app_metadata_schema: "your_team_app_dev"

  prod:
    variables:
      warehouse_id: "your-warehouse-id"
      catalog: "published_analytics"
      schema: "default"
      allowed_catalogs: "published_analytics,published_domain"
      secret_scope: "your-secrets-prod"
      secret_key: "sp-token"
      app_metadata_catalog: "non_published_analytics"
      app_metadata_schema: "your_team_app"
```

Then deploy:

```bash
databricks bundle deploy -t dev --var warehouse_id=<id>
databricks bundle run bi_dashboard -t dev
```

### 6. Service Principal Permissions

The SP token (stored in your secret scope) needs these permissions:

| Resource | Permissions Needed |
|---|---|
| **Metadata catalog + schema** | `USAGE`, `CREATE TABLE`, `SELECT`, `INSERT`, `DELETE` |
| **Data catalogs/schemas** | `USAGE`, `SELECT` |
| **SQL Warehouse** | `CAN_USE` |

## Data Migration

If you have existing YAML data (workspaces, presets) and want to migrate to Delta:

```bash
curl -X POST http://localhost:8000/api/admin/migrate-yaml-to-delta
```

This reads local YAML files and inserts them into the Delta tables. Safe to run multiple times.

## Multi-Team Isolation

Each team gets its own set of metadata tables by using a unique `APP_METADATA_SCHEMA`:

```
development.team_alpha_app.workspaces     ← Team Alpha
development.team_alpha_app.presets

development.team_beta_app.workspaces      ← Team Beta
development.team_beta_app.presets
```

Teams share the same codebase but deploy independently. No team can see or modify another team's workspaces or presets.

## Features

| Feature | Description |
|---|---|
| **Workspaces** | Named configurations pointing to a data source with capabilities and column settings |
| **Data & Filters** | Browse catalogs/schemas/tables, select columns, apply filters, preview data |
| **KPI Cards** | Configurable metric cards with aggregation and formatting |
| **Charts** | ECharts-powered visualizations (bar, line, pie, scatter, area, heatmap, etc.) |
| **Pivot Table** | Drag-and-drop pivot with AG Grid output (SUM, AVG, COUNT, MIN, MAX) |
| **Presets** | Save/load dashboard configurations per workspace |
| **AI Insights** | Optional LLM-powered data analysis |
| **Themes** | Multiple color schemes including dark mode, Nike, Nord, Corporate |
| **RBAC** | Admin/consumer roles based on group membership |

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | UI framework |
| Charts | Apache ECharts | Visualizations |
| Pivot Table | AG Grid Community | Sortable/filterable pivot output |
| Layout | react-grid-layout | Dashboard grid |
| Drag & Drop | @dnd-kit | Field/chart drag interactions |
| State | Zustand | State management |
| Backend | FastAPI (Python) | REST API |
| DB Connector | databricks-sql-connector | SQL warehouse queries |
| Storage | Delta tables (Unity Catalog) | Workspace/preset persistence |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/me` | Current user info + role |
| GET | `/api/config` | Non-sensitive app config |
| GET | `/api/catalogs` | List Unity Catalog catalogs |
| GET | `/api/catalogs/{c}/schemas` | List schemas in a catalog |
| GET | `/api/catalogs/{c}/schemas/{s}/tables` | List tables |
| GET | `/api/catalogs/{c}/schemas/{s}/tables/{t}/columns` | Describe columns |
| POST | `/api/query` | Execute SQL `{ sql, limit }` |
| GET | `/api/workspaces` | List all workspaces |
| POST | `/api/workspaces` | Create a workspace |
| PUT | `/api/workspaces/{id}` | Update a workspace |
| DELETE | `/api/workspaces/{id}` | Delete workspace + its presets |
| GET | `/api/workspaces/{id}/presets` | List presets for a workspace |
| POST | `/api/workspaces/{id}/presets` | Create a preset |
| PUT | `/api/workspaces/{id}/presets/{pid}` | Update a preset |
| DELETE | `/api/workspaces/{id}/presets/{pid}` | Delete a preset |
| POST | `/api/admin/migrate-yaml-to-delta` | One-time YAML to Delta migration |

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABRICKS_HOST` | Yes | — | Workspace URL |
| `DATABRICKS_TOKEN` | Local only | — | Personal access token |
| `DATABRICKS_WAREHOUSE_ID` | Yes | — | SQL warehouse ID |
| `DEFAULT_CATALOG` | Yes | `main` | Default data catalog |
| `DEFAULT_SCHEMA` | Yes | `default` | Default data schema |
| `ALLOWED_CATALOGS` | No | _(all)_ | Comma-separated catalog allowlist |
| `AUTH_MODE` | Yes | `pat` | `pat` (local) or `oauth` (deployed) |
| `STORAGE_BACKEND` | Yes | `yaml` | `delta` (recommended) or `yaml` |
| `APP_METADATA_CATALOG` | If delta | `development` | Catalog for metadata tables |
| `APP_METADATA_SCHEMA` | If delta | `bi_app_metadata` | Schema for metadata tables |
| `DEFAULT_SECRET_SCOPE` | Deployed | `none` | Databricks secret scope for SP token |
| `DEFAULT_SECRET_KEY` | Deployed | `sp-token` | Key within the secret scope |
| `ADMIN_ROLE_SUFFIXES` | No | _(all admin)_ | Group suffixes granting admin role |
| `DEFAULT_ROW_LIMIT` | No | `0` | Default query row limit (0 = no limit) |
| `MAX_ROW_LIMIT` | No | `0` | Max query row limit (0 = no limit) |
| `QUERY_TIMEOUT_SECONDS` | No | `300` | SQL query timeout |
