from __future__ import annotations

import getpass
import hashlib
import logging
import os as _os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from cachetools import TTLCache
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import AppConfig, load_config
from .db import (
    _log_sp_config,
    describe_table, describe_table_in, get_connection, list_catalogs, list_schemas,
    list_secret_scopes, list_tables, list_tables_in, run_query, set_user_token,
)
from .mock_data import MOCK_COLUMNS, MOCK_TABLES
from .rbac import resolve_role
from .routes.abbreviations import router as abbreviations_router
from .routes.presets import router as presets_router
from .routes.shared_formulas import router as shared_formulas_router
from .routes.subscriptions import router as subscriptions_router
from .routes.themes import router as themes_router
from .routes.workspaces import router as workspaces_router
from .storage import ensure_tables


def _env(key: str, default: str = "") -> str:
    """Read env var, treating 'none' (case-insensitive) as empty string."""
    val = _os.environ.get(key, default).strip()
    return "" if val.lower() == "none" else val


cfg: AppConfig = load_config()

logging.basicConfig(level=getattr(logging, cfg.settings.log_level, logging.INFO))
logger = logging.getLogger(__name__)

_log_sp_config()

if cfg.is_mock_mode:
    logger.info("Running in LOCAL_TEST_MODE — database calls will be skipped")
else:
    try:
        ensure_tables()
    except Exception:
        logger.warning("Failed to ensure metadata tables on startup", exc_info=True)

app = FastAPI(title="BI Excellence Suite API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register route modules ────────────────────────────────────────────
app.include_router(workspaces_router)
app.include_router(presets_router)
app.include_router(subscriptions_router)
app.include_router(shared_formulas_router)
app.include_router(themes_router)
app.include_router(abbreviations_router)


# ── YAML → Delta migration (one-time) ─────────────────────────────────

@app.post("/api/admin/migrate-yaml-to-delta")
def migrate_yaml_to_delta() -> dict[str, Any]:
    """Migrate data from YAML files into Delta tables. Safe to run multiple
    times — it overwrites existing Delta data with the YAML content."""
    from .storage_yaml import (
        load_workspaces as yaml_ws,
        load_presets as yaml_ps,
        load_custom_themes as yaml_th,
        load_abbreviations as yaml_ab,
    )
    from .storage_delta import (
        save_workspaces as delta_ws,
        save_presets as delta_ps,
        save_custom_themes as delta_th,
        save_abbreviations as delta_ab,
    )

    counts: dict[str, int] = {}

    ws = yaml_ws()
    delta_ws(ws)
    counts["workspaces"] = len(ws)

    ps = yaml_ps()
    delta_ps(ps)
    counts["presets"] = len(ps)

    th = yaml_th()
    delta_th(th)
    counts["custom_themes"] = len(th)

    ab = yaml_ab()
    delta_ab(ab)
    counts["abbreviations"] = len(ab)

    logger.info("YAML → Delta migration complete: %s", counts)
    return {"status": "migrated", "counts": counts}


# ── Middleware ─────────────────────────────────────────────────────────

@app.middleware("http")
async def inject_user_token(request: Request, call_next):
    """Extract the Databricks Apps user token and store it in a context var
    so that db.py uses the logged-in user's permissions for SQL queries."""
    token = request.headers.get("x-forwarded-access-token")
    set_user_token(token)
    return await call_next(request)


# ── Caching ───────────────────────────────────────────────────────────

_cache: TTLCache = TTLCache(maxsize=256, ttl=cfg.cache.ttl_seconds)


def _cache_key(prefix: str, *parts: str) -> str:
    raw = f"{prefix}:{'|'.join(parts)}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Health ────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Current User ──────────────────────────────────────────────────────

@app.get("/api/me")
def get_current_user(request: Request) -> dict[str, Any]:
    username = (
        request.headers.get("x-forwarded-preferred-username")
        or request.headers.get("x-forwarded-user")
        or _os.environ.get("BI_USER_NAME", "")
    )
    email = (
        request.headers.get("x-forwarded-email")
        or _os.environ.get("BI_USER_EMAIL", "")
    )
    display_name = _os.environ.get("BI_USER_DISPLAY_NAME", "")

    if not display_name and username:
        display_name = username.split("@")[0].replace(".", " ").title()

    if not display_name:
        try:
            display_name = getpass.getuser().replace(".", " ").title()
        except Exception:
            display_name = "Local User"

    if not username:
        try:
            username = getpass.getuser()
        except Exception:
            username = "local_user"

    lookup_email = email or username
    role, groups = resolve_role(lookup_email) if not cfg.is_mock_mode else ("admin", [])

    return {
        "username": username,
        "display_name": display_name,
        "email": email,
        "avatar_url": None,
        "role": role,
        "groups": groups,
    }


# ── Catalog / Schema / Table metadata ─────────────────────────────────

_ALLOWED_CATALOGS: list[str] = [
    c.strip() for c in _env("ALLOWED_CATALOGS").split(",") if c.strip()
]


def _filter_catalogs(catalogs: list[str]) -> list[str]:
    if not _ALLOWED_CATALOGS:
        return catalogs
    return [c for c in catalogs if c in _ALLOWED_CATALOGS]


@app.get("/api/catalogs")
def get_catalogs() -> list[str]:
    if cfg.is_mock_mode:
        return _filter_catalogs(["samples"])
    key = _cache_key("catalogs")
    if cfg.cache.enabled and key in _cache:
        return _filter_catalogs(_cache[key])
    try:
        result = list_catalogs(cfg)
        if cfg.cache.enabled:
            _cache[key] = result
        return _filter_catalogs(result)
    except Exception as exc:
        logger.exception("Failed to list catalogs")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/catalogs/{catalog}/schemas")
def get_schemas(catalog: str) -> list[str]:
    if cfg.is_mock_mode:
        return ["nyctaxi", "bakehouse"]
    key = _cache_key("schemas", catalog)
    if cfg.cache.enabled and key in _cache:
        return _cache[key]
    try:
        result = list_schemas(cfg, catalog)
        if cfg.cache.enabled:
            _cache[key] = result
        return result
    except Exception as exc:
        logger.exception("Failed to list schemas in %s", catalog)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/catalogs/{catalog}/schemas/{schema}/tables")
def get_tables_in(catalog: str, schema: str) -> list[dict[str, Any]]:
    if cfg.is_mock_mode:
        return MOCK_TABLES
    key = _cache_key("tables_in", catalog, schema)
    if cfg.cache.enabled and key in _cache:
        return _cache[key]
    try:
        result = list_tables_in(cfg, catalog, schema)
        if cfg.cache.enabled:
            _cache[key] = result
        return result
    except Exception as exc:
        logger.exception("Failed to list tables in %s.%s", catalog, schema)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/catalogs/{catalog}/schemas/{schema}/tables/{table_name}/columns")
def get_columns_in(catalog: str, schema: str, table_name: str) -> list[dict[str, Any]]:
    if cfg.is_mock_mode:
        return MOCK_COLUMNS.get(table_name, [])
    key = _cache_key("columns_in", catalog, schema, table_name)
    if cfg.cache.enabled and key in _cache:
        return _cache[key]
    try:
        result = describe_table_in(cfg, catalog, schema, table_name)
        if cfg.cache.enabled:
            _cache[key] = result
        return result
    except Exception as exc:
        logger.exception("Failed to describe %s.%s.%s", catalog, schema, table_name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/tables")
def get_tables() -> list[dict[str, Any]]:
    if cfg.is_mock_mode:
        return MOCK_TABLES
    key = _cache_key("tables")
    if cfg.cache.enabled and key in _cache:
        return _cache[key]
    try:
        result = list_tables(cfg)
        if cfg.cache.enabled:
            _cache[key] = result
        return result
    except Exception as exc:
        logger.exception("Failed to list tables")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/tables/{table_name}/columns")
def get_columns(table_name: str) -> list[dict[str, Any]]:
    if cfg.is_mock_mode:
        return MOCK_COLUMNS.get(table_name, [])
    key = _cache_key("columns", table_name)
    if cfg.cache.enabled and key in _cache:
        return _cache[key]
    try:
        result = describe_table(cfg, table_name)
        if cfg.cache.enabled:
            _cache[key] = result
        return result
    except Exception as exc:
        logger.exception("Failed to describe table %s", table_name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Query ─────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    sql: str
    limit: int | None = None


@app.post("/api/query")
def execute_query(req: QueryRequest) -> dict[str, Any]:
    requested = req.limit if req.limit is not None else cfg.settings.default_row_limit
    if requested > 0 and cfg.settings.max_row_limit > 0:
        limit = min(requested, cfg.settings.max_row_limit)
    else:
        limit = requested if requested and requested > 0 else 0
    key = _cache_key("query", req.sql, str(limit))
    if cfg.cache.enabled and key in _cache:
        return _cache[key]
    try:
        result = run_query(cfg, req.sql, limit)
        if cfg.cache.enabled:
            _cache[key] = result
        return result
    except Exception as exc:
        logger.exception("Query execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── CSV Export (streaming) ────────────────────────────────────────────

class ExportRequest(BaseModel):
    sql: str
    filename: str = "export.csv"


@app.post("/api/export-csv")
def export_csv(req: ExportRequest) -> StreamingResponse:
    """Execute query and return results as a CSV download."""
    import csv
    import io

    safe_sql = req.sql.rstrip(";")

    try:
        with get_connection(cfg) as conn:
            cursor = conn.cursor()
            cursor.execute(safe_sql)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            cursor.close()
    except Exception as exc:
        logger.exception("CSV export query failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info("CSV export: %d rows x %d cols", len(rows), len(columns))

    def _generate():
        buf = io.StringIO()
        buf.write("\ufeff")
        writer = csv.writer(buf)
        writer.writerow(columns)

        chunk_size = 5000
        for i, row in enumerate(rows):
            writer.writerow(list(row))
            if (i + 1) % chunk_size == 0:
                yield buf.getvalue()
                buf.seek(0)
                buf.truncate(0)

        remainder = buf.getvalue()
        if remainder:
            yield remainder

    filename = req.filename if req.filename.endswith(".csv") else f"{req.filename}.csv"
    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Config info (non-sensitive) ───────────────────────────────────────

@app.get("/api/config")
def get_config_info() -> dict:
    from .db import _DEFAULT_SECRET_SCOPE, _DEFAULT_SECRET_KEY

    return {
        "type": cfg.datasource.type,
        "host": cfg.datasource.host,
        "catalog": cfg.datasource.catalog,
        "schema": cfg.datasource.schema_name,
        "local_test_mode": cfg.is_mock_mode,
        "features": cfg.features.model_dump(),
        "limits": {
            "default_row_limit": cfg.settings.default_row_limit,
            "max_row_limit": cfg.settings.max_row_limit,
            "query_timeout_seconds": cfg.settings.query_timeout_seconds,
        },
        "security": {
            "default_secret_scope": _DEFAULT_SECRET_SCOPE,
            "default_secret_key": _DEFAULT_SECRET_KEY,
        },
    }


# ── Secret Scopes ─────────────────────────────────────────────────────

@app.get("/api/secret-scopes")
def get_secret_scopes() -> list[str]:
    if cfg.is_mock_mode:
        return ["mock-scope-dev", "mock-scope-prod"]
    try:
        return list_secret_scopes()
    except Exception as exc:
        logger.exception("Failed to list secret scopes")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Test Connection ───────────────────────────────────────────────────

@app.post("/api/test-connection")
def test_connection() -> dict[str, Any]:
    if cfg.is_mock_mode:
        return {"ok": True, "message": "Mock mode — connection simulated"}
    try:
        with get_connection(cfg) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
        return {"ok": True, "message": "Connected successfully"}
    except Exception as exc:
        logger.exception("Connection test failed")
        return {"ok": False, "message": str(exc)}


# ── Static SPA serving (production) ──────────────────────────────────

_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if _DIST_DIR.is_dir():
    _assets = _DIST_DIR / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="static-assets")

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        file = _DIST_DIR / path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_DIST_DIR / "index.html")
