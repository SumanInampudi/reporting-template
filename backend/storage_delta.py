"""Delta-table-backed persistence for workspaces, presets, themes, and abbreviations.

Tables are auto-created on first use via `ensure_tables()`. All functions
mirror the same signatures as `storage.py` (YAML backend) so the switch
is transparent to route modules.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

from databricks.sql.client import Connection

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────

_META_CATALOG = os.environ.get("APP_METADATA_CATALOG", "development")
_META_SCHEMA = os.environ.get("APP_METADATA_SCHEMA", "bi_app_metadata")


def _fqn(table: str) -> str:
    return f"`{_META_CATALOG}`.`{_META_SCHEMA}`.`{table}`"


# ── Connection pool (thread-local, reused across calls) ───────────────

_local = threading.local()


def _get_connection() -> Connection:
    """Return a reusable connection for the current thread.

    The connection is cached in thread-local storage and reused across
    all storage operations within the same request. If the cached
    connection is stale or closed, a fresh one is created.
    """
    conn: Connection | None = getattr(_local, "conn", None)
    if conn is not None:
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return conn
        except Exception:
            logger.debug("Cached connection stale, reconnecting")
            try:
                conn.close()
            except Exception:
                pass
            _local.conn = None

    from .db import _open_connection
    from .config import load_config

    cfg = load_config()
    conn = _open_connection(cfg)
    _local.conn = conn
    return conn


# ── Table DDL ──────────────────────────────────────────────────────────

_DDL = {
    "workspaces": f"""
        CREATE TABLE IF NOT EXISTS {_fqn("workspaces")} (
            id STRING NOT NULL,
            data STRING NOT NULL,
            updated_at TIMESTAMP
        ) USING DELTA
    """,
    "presets": f"""
        CREATE TABLE IF NOT EXISTS {_fqn("presets")} (
            id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            data STRING NOT NULL,
            updated_at TIMESTAMP
        ) USING DELTA
    """,
    "custom_themes": f"""
        CREATE TABLE IF NOT EXISTS {_fqn("custom_themes")} (
            id STRING NOT NULL,
            data STRING NOT NULL,
            updated_at TIMESTAMP
        ) USING DELTA
    """,
    "abbreviations": f"""
        CREATE TABLE IF NOT EXISTS {_fqn("abbreviations")} (
            id STRING NOT NULL,
            data STRING NOT NULL,
            updated_at TIMESTAMP
        ) USING DELTA
    """,
    "subscriptions": f"""
        CREATE TABLE IF NOT EXISTS {_fqn("subscriptions")} (
            id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            preset_id STRING NOT NULL,
            data STRING NOT NULL,
            updated_at TIMESTAMP
        ) USING DELTA
    """,
    "shared_formulas": f"""
        CREATE TABLE IF NOT EXISTS {_fqn("shared_formulas")} (
            id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            data STRING NOT NULL,
            updated_at TIMESTAMP
        ) USING DELTA
    """,
}


def ensure_tables() -> None:
    """Create metadata tables if they don't exist. Safe to call on every startup."""
    logger.info(
        "Ensuring metadata tables in %s.%s …", _META_CATALOG, _META_SCHEMA,
    )
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE SCHEMA IF NOT EXISTS `{_META_CATALOG}`.`{_META_SCHEMA}`"
    )
    for name, ddl in _DDL.items():
        logger.info("  → %s", _fqn(name))
        cursor.execute(ddl)
    cursor.close()
    logger.info("Metadata tables ready.")


# ── Generic helpers ────────────────────────────────────────────────────

def _load_all(table: str) -> list[dict[str, Any]]:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT data FROM {_fqn(table)}")
    rows = cursor.fetchall()
    cursor.close()
    results: list[dict[str, Any]] = []
    for row in rows:
        try:
            results.append(json.loads(row[0]))
        except json.JSONDecodeError:
            results.append(json.loads(row[0], strict=False))
    return results


def _escape(s: str) -> str:
    """Escape a string for Databricks SQL single-quoted literals."""
    return s.replace("\\", "\\\\").replace("'", "\\'")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _save_all(table: str, items: list[dict[str, Any]], id_key: str = "id") -> None:
    """Full replace: delete all rows and insert fresh ones."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {_fqn(table)}")
    now = _now_iso()
    for item in items:
        item_id = item.get(id_key, "")
        data_json = json.dumps(item, default=str)
        cursor.execute(
            f"INSERT INTO {_fqn(table)} (id, data, updated_at) "
            f"VALUES ('{_escape(item_id)}', '{_escape(data_json)}', '{now}')"
        )
    cursor.close()


def _save_all_presets(items: list[dict[str, Any]]) -> None:
    """Full replace for presets (includes workspace_id column)."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {_fqn('presets')}")
    now = _now_iso()
    for item in items:
        item_id = item.get("id", "")
        ws_id = item.get("workspace_id", "")
        data_json = json.dumps(item, default=str)
        cursor.execute(
            f"INSERT INTO {_fqn('presets')} (id, workspace_id, data, updated_at) "
            f"VALUES ('{_escape(item_id)}', '{_escape(ws_id)}', '{_escape(data_json)}', '{now}')"
        )
    cursor.close()


# ── Targeted single-row helpers ────────────────────────────────────────

def _upsert_row(table: str, item_id: str, data_json: str) -> None:
    """MERGE a single row into a generic (id, data, updated_at) table."""
    conn = _get_connection()
    cursor = conn.cursor()
    now = _now_iso()
    eid = _escape(item_id)
    ed = _escape(data_json)
    cursor.execute(
        f"MERGE INTO {_fqn(table)} AS t "
        f"USING (SELECT '{eid}' AS id) AS s ON t.id = s.id "
        f"WHEN MATCHED THEN UPDATE SET data = '{ed}', updated_at = '{now}' "
        f"WHEN NOT MATCHED THEN INSERT (id, data, updated_at) "
        f"VALUES ('{eid}', '{ed}', '{now}')"
    )
    cursor.close()


def _delete_row(table: str, item_id: str) -> None:
    """DELETE a single row by id."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"DELETE FROM {_fqn(table)} WHERE id = '{_escape(item_id)}'"
    )
    cursor.close()


def _load_filtered(table: str, where_col: str, where_val: str) -> list[dict[str, Any]]:
    """Load rows from a table filtered by a single column."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT data FROM {_fqn(table)} "
        f"WHERE {where_col} = '{_escape(where_val)}'"
    )
    rows = cursor.fetchall()
    cursor.close()
    results: list[dict[str, Any]] = []
    for row in rows:
        try:
            results.append(json.loads(row[0]))
        except json.JSONDecodeError:
            results.append(json.loads(row[0], strict=False))
    return results


def _load_one(table: str, item_id: str) -> dict[str, Any] | None:
    """Load a single row by id."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT data FROM {_fqn(table)} "
        f"WHERE id = '{_escape(item_id)}' LIMIT 1"
    )
    row = cursor.fetchone()
    cursor.close()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except json.JSONDecodeError:
        return json.loads(row[0], strict=False)


# ── Public API ─────────────────────────────────────────────────────────
# Bulk functions (kept for migration / full-replace scenarios)

def load_workspaces() -> list[dict[str, Any]]:
    return _load_all("workspaces")


def save_workspaces(workspaces: list[dict[str, Any]]) -> None:
    _save_all("workspaces", workspaces)


def load_presets() -> list[dict[str, Any]]:
    return _load_all("presets")


def save_presets(presets: list[dict[str, Any]]) -> None:
    _save_all_presets(presets)


def load_custom_themes() -> list[dict[str, Any]]:
    return _load_all("custom_themes")


def save_custom_themes(themes: list[dict[str, Any]]) -> None:
    _save_all("custom_themes", themes)


def load_abbreviations() -> list[dict[str, Any]]:
    return _load_all("abbreviations")


def save_abbreviations(entries: list[dict[str, Any]]) -> None:
    _save_all("abbreviations", entries)


# ── Targeted single-row operations ────────────────────────────────────
# Workspaces

def get_workspace(workspace_id: str) -> dict[str, Any] | None:
    return _load_one("workspaces", workspace_id)


def upsert_workspace(ws: dict[str, Any]) -> None:
    _upsert_row("workspaces", ws.get("id", ""), json.dumps(ws, default=str))


def delete_workspace_by_id(workspace_id: str) -> None:
    _delete_row("workspaces", workspace_id)


def workspace_exists(workspace_id: str) -> bool:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT 1 FROM {_fqn('workspaces')} "
        f"WHERE id = '{_escape(workspace_id)}' LIMIT 1"
    )
    found = cursor.fetchone() is not None
    cursor.close()
    return found


# Presets

def get_preset(preset_id: str, workspace_id: str) -> dict[str, Any] | None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT data FROM {_fqn('presets')} "
        f"WHERE id = '{_escape(preset_id)}' "
        f"AND workspace_id = '{_escape(workspace_id)}' LIMIT 1"
    )
    row = cursor.fetchone()
    cursor.close()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except json.JSONDecodeError:
        return json.loads(row[0], strict=False)


def load_presets_by_workspace(workspace_id: str) -> list[dict[str, Any]]:
    return _load_filtered("presets", "workspace_id", workspace_id)


def upsert_preset(preset: dict[str, Any]) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    now = _now_iso()
    pid = _escape(preset.get("id", ""))
    ws_id = _escape(preset.get("workspace_id", ""))
    data = _escape(json.dumps(preset, default=str))
    cursor.execute(
        f"MERGE INTO {_fqn('presets')} AS t "
        f"USING (SELECT '{pid}' AS id) AS s ON t.id = s.id "
        f"WHEN MATCHED THEN UPDATE SET "
        f"workspace_id = '{ws_id}', data = '{data}', updated_at = '{now}' "
        f"WHEN NOT MATCHED THEN INSERT (id, workspace_id, data, updated_at) "
        f"VALUES ('{pid}', '{ws_id}', '{data}', '{now}')"
    )
    cursor.close()


def delete_preset_by_id(preset_id: str, workspace_id: str) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"DELETE FROM {_fqn('presets')} "
        f"WHERE id = '{_escape(preset_id)}' "
        f"AND workspace_id = '{_escape(workspace_id)}'"
    )
    cursor.close()


def delete_presets_by_workspace(workspace_id: str) -> None:
    """Cascade-delete all presets belonging to a workspace."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"DELETE FROM {_fqn('presets')} "
        f"WHERE workspace_id = '{_escape(workspace_id)}'"
    )
    cursor.close()


# Custom themes

def upsert_custom_theme(theme: dict[str, Any]) -> None:
    _upsert_row("custom_themes", theme.get("id", ""), json.dumps(theme, default=str))


def delete_custom_theme_by_id(theme_id: str) -> None:
    _delete_row("custom_themes", theme_id)


# Subscriptions

def load_subscriptions_by_preset(workspace_id: str, preset_id: str) -> list[dict[str, Any]]:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT data FROM {_fqn('subscriptions')} "
        f"WHERE workspace_id = '{_escape(workspace_id)}' "
        f"AND preset_id = '{_escape(preset_id)}'"
    )
    rows = cursor.fetchall()
    cursor.close()
    results: list[dict[str, Any]] = []
    for row in rows:
        try:
            results.append(json.loads(row[0]))
        except json.JSONDecodeError:
            results.append(json.loads(row[0], strict=False))
    return results


def get_subscription(sub_id: str) -> dict[str, Any] | None:
    return _load_one("subscriptions", sub_id)


def upsert_subscription(sub: dict[str, Any]) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    now = _now_iso()
    sid = _escape(sub.get("id", ""))
    ws_id = _escape(sub.get("workspace_id", ""))
    ps_id = _escape(sub.get("preset_id", ""))
    data = _escape(json.dumps(sub, default=str))
    cursor.execute(
        f"MERGE INTO {_fqn('subscriptions')} AS t "
        f"USING (SELECT '{sid}' AS id) AS s ON t.id = s.id "
        f"WHEN MATCHED THEN UPDATE SET "
        f"workspace_id = '{ws_id}', preset_id = '{ps_id}', data = '{data}', updated_at = '{now}' "
        f"WHEN NOT MATCHED THEN INSERT (id, workspace_id, preset_id, data, updated_at) "
        f"VALUES ('{sid}', '{ws_id}', '{ps_id}', '{data}', '{now}')"
    )
    cursor.close()


def delete_subscription_by_id(sub_id: str) -> None:
    _delete_row("subscriptions", sub_id)


def delete_subscriptions_by_preset(workspace_id: str, preset_id: str) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"DELETE FROM {_fqn('subscriptions')} "
        f"WHERE workspace_id = '{_escape(workspace_id)}' "
        f"AND preset_id = '{_escape(preset_id)}'"
    )
    cursor.close()


def delete_subscriptions_by_workspace(workspace_id: str) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"DELETE FROM {_fqn('subscriptions')} "
        f"WHERE workspace_id = '{_escape(workspace_id)}'"
    )
    cursor.close()


def batch_save_subscriptions(
    workspace_id: str,
    preset_id: str,
    items: list[dict[str, Any]],
    delete_ids: list[str],
) -> None:
    """Upsert multiple subscriptions and delete removed ones in a single connection + cursor."""
    conn = _get_connection()
    cursor = conn.cursor()
    now = _now_iso()

    for sub in items:
        sid = _escape(sub.get("id", ""))
        ws_id = _escape(sub.get("workspace_id", workspace_id))
        ps_id = _escape(sub.get("preset_id", preset_id))
        data = _escape(json.dumps(sub, default=str))
        cursor.execute(
            f"MERGE INTO {_fqn('subscriptions')} AS t "
            f"USING (SELECT '{sid}' AS id) AS s ON t.id = s.id "
            f"WHEN MATCHED THEN UPDATE SET "
            f"workspace_id = '{ws_id}', preset_id = '{ps_id}', data = '{data}', updated_at = '{now}' "
            f"WHEN NOT MATCHED THEN INSERT (id, workspace_id, preset_id, data, updated_at) "
            f"VALUES ('{sid}', '{ws_id}', '{ps_id}', '{data}', '{now}')"
        )

    for del_id in delete_ids:
        cursor.execute(
            f"DELETE FROM {_fqn('subscriptions')} WHERE id = '{_escape(del_id)}'"
        )

    cursor.close()


# ── Shared Formula Columns ────────────────────────────────────────────

def load_shared_formulas_by_workspace(workspace_id: str) -> list[dict[str, Any]]:
    return _load_filtered("shared_formulas", "workspace_id", workspace_id)


def get_shared_formula(formula_id: str) -> dict[str, Any] | None:
    return _load_one("shared_formulas", formula_id)


def upsert_shared_formula(formula: dict[str, Any]) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    now = _now_iso()
    fid = _escape(formula.get("id", ""))
    ws_id = _escape(formula.get("workspace_id", ""))
    data = _escape(json.dumps(formula, default=str))
    cursor.execute(
        f"MERGE INTO {_fqn('shared_formulas')} AS t "
        f"USING (SELECT '{fid}' AS id) AS s ON t.id = s.id "
        f"WHEN MATCHED THEN UPDATE SET "
        f"workspace_id = '{ws_id}', data = '{data}', updated_at = '{now}' "
        f"WHEN NOT MATCHED THEN INSERT (id, workspace_id, data, updated_at) "
        f"VALUES ('{fid}', '{ws_id}', '{data}', '{now}')"
    )
    cursor.close()


def delete_shared_formula_by_id(formula_id: str) -> None:
    _delete_row("shared_formulas", formula_id)


def delete_shared_formulas_by_workspace(workspace_id: str) -> None:
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"DELETE FROM {_fqn('shared_formulas')} "
        f"WHERE workspace_id = '{_escape(workspace_id)}'"
    )
    cursor.close()
