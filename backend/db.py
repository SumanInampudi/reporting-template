from __future__ import annotations

import base64
import logging
import os as _os
import time
from contextvars import ContextVar
from contextlib import contextmanager
from typing import Any, Generator

from databricks import sql as databricks_sql
from databricks.sql.client import Connection

from .config import AppConfig

logger = logging.getLogger(__name__)

_user_token: ContextVar[str | None] = ContextVar("_user_token", default=None)

def _env(key: str, default: str = "") -> str:
    val = _os.environ.get(key, default).strip()
    return "" if val.lower() == "none" else val

_DEFAULT_SECRET_SCOPE = _env("DEFAULT_SECRET_SCOPE")
_DEFAULT_SECRET_KEY = _env("DEFAULT_SECRET_KEY", "sp-token")


def _log_sp_config() -> None:
    """Log SP fallback config once logging is configured (called from main)."""
    logger.info(
        "SP fallback config — DEFAULT_SECRET_SCOPE=%r, DEFAULT_SECRET_KEY=%r",
        _DEFAULT_SECRET_SCOPE or "(empty)",
        _DEFAULT_SECRET_KEY or "(empty)",
    )


def set_user_token(token: str | None) -> None:
    _user_token.set(token)


_sp_token_cache: dict[tuple[str, str], tuple[str | None, float]] = {}
_SP_CACHE_TTL = 300  # 5 minutes — retry after failures


def _fetch_sp_token(scope: str, key: str) -> str | None:
    """Retrieve a service-principal token from Databricks Secrets.

    Results are cached for 5 minutes so transient failures can be retried.
    """
    cache_key = (scope, key)
    cached = _sp_token_cache.get(cache_key)
    if cached:
        token, ts = cached
        if token is not None and (time.time() - ts) < _SP_CACHE_TTL:
            return token
        if token is None and (time.time() - ts) < 30:
            return None

    logger.info("Fetching SP token from secret %s/%s …", scope, key)
    try:
        from databricks.sdk import WorkspaceClient

        client = WorkspaceClient()
        resp = client.secrets.get_secret(scope=scope, key=key)
        if resp.value is not None:
            token = base64.b64decode(resp.value).decode("utf-8")
            logger.info("Successfully fetched SP token from %s/%s", scope, key)
            _sp_token_cache[cache_key] = (token, time.time())
            return token
        logger.warning("Secret %s/%s returned empty value", scope, key)
    except Exception:
        logger.warning("Failed to fetch secret %s/%s", scope, key, exc_info=True)

    _sp_token_cache[cache_key] = (None, time.time())
    return None


def get_fallback_token(
    secret_scope: str | None = None,
    secret_key: str | None = None,
) -> str | None:
    """Resolve the SP fallback token from workspace config or env defaults."""
    scope = secret_scope or _DEFAULT_SECRET_SCOPE
    key = secret_key or _DEFAULT_SECRET_KEY
    if not scope:
        logger.debug("No secret scope configured (ws=%r, env=%r)", secret_scope, _DEFAULT_SECRET_SCOPE)
        return None
    return _fetch_sp_token(scope, key)


_RETRYABLE_AUTH_MARKERS = (
    "PERMISSION_DENIED",
    "not authorized",
    "Access denied",
    "Credential was not sent",
    "unsupported type for this API",
)


def _token_preview(token: str) -> str:
    """Return first 6 and last 4 chars of a token for safe logging."""
    if len(token) <= 12:
        return "***"
    return f"{token[:6]}…{token[-4:]}"


def _connect(
    cfg: AppConfig,
    access_token: str | None = None,
    *,
    _auth_label: str = "unknown",
) -> Connection:
    host = cfg.datasource.host
    if host.startswith("https://"):
        host = host[len("https://"):]
    elif host.startswith("http://"):
        host = host[len("http://"):]
    host = host.rstrip("/")

    kwargs: dict[str, Any] = {
        "server_hostname": host,
        "http_path": cfg.datasource.http_path,
    }

    if access_token:
        kwargs["access_token"] = access_token
        auth_method = _auth_label
        auth_detail = _token_preview(access_token)
    elif cfg.auth.method == "pat":
        kwargs["access_token"] = cfg.auth.token
        auth_method = "PAT (config)"
        auth_detail = _token_preview(cfg.auth.token) if cfg.auth.token else "empty"
    elif cfg.auth.method == "oauth":
        from databricks.sdk.core import Config as SdkConfig
        from databricks.sdk.core import oauth_service_principal

        sdk_cfg = SdkConfig(
            host=f"https://{host}",
            client_id=cfg.auth.client_id,
            client_secret=cfg.auth.client_secret,
        )
        header_factory = oauth_service_principal(sdk_cfg)
        kwargs["credentials_provider"] = lambda: header_factory
        auth_method = "OAuth SP (config)"
        auth_detail = f"client_id={cfg.auth.client_id}"
    else:
        auth_method = f"config ({cfg.auth.method})"
        auth_detail = "no credentials"

    logger.info(
        "CONNECT → host=%s, auth=%s, token=%s",
        host, auth_method, auth_detail,
    )

    return databricks_sql.connect(**kwargs)


def _is_retryable_auth_error(exc: Exception) -> bool:
    msg = str(exc)
    return any(marker in msg for marker in _RETRYABLE_AUTH_MARKERS)


def _open_connection(
    cfg: AppConfig,
    secret_scope: str | None = None,
    secret_key: str | None = None,
) -> Connection:
    """Open a SQL connection with automatic SP fallback.

    Strategy:
      1. Use the logged-in user's forwarded token (Databricks Apps).
      2. If that fails for *any* reason and an SP fallback secret is
         configured, retry with the SP token.  Databricks may return a
         bare HTTP 403 with no descriptive message, so we cannot rely
         on pattern-matching the error string.
      3. If no user token, try SP fallback first, then config auth.
    """
    forwarded_token = _user_token.get()

    if forwarded_token:
        try:
            return _connect(cfg, access_token=forwarded_token, _auth_label="User (forwarded token)")
        except Exception as first_err:
            logger.warning(
                "User token failed: %s (scope_param=%r, env_scope=%r)",
                first_err, secret_scope, _DEFAULT_SECRET_SCOPE,
            )
            fb_token = get_fallback_token(secret_scope, secret_key)
            if not fb_token:
                logger.error(
                    "No SP fallback token available — scope=%r resolved "
                    "from (ws=%r, env=%r).  Re-raising original error.",
                    secret_scope or _DEFAULT_SECRET_SCOPE,
                    secret_scope,
                    _DEFAULT_SECRET_SCOPE,
                )
                raise
            logger.info("Retrying connection with SP fallback token")
            try:
                return _connect(cfg, access_token=fb_token, _auth_label="SP fallback (secret)")
            except Exception:
                logger.warning("SP fallback also failed — re-raising original user-token error")
                raise first_err

    fb_token = get_fallback_token(secret_scope, secret_key)
    if fb_token:
        return _connect(cfg, access_token=fb_token, _auth_label="SP fallback (no user token)")
    return _connect(cfg, _auth_label=f"Config ({cfg.auth.method})")


@contextmanager
def get_connection(
    cfg: AppConfig,
    secret_scope: str | None = None,
    secret_key: str | None = None,
) -> Generator[Connection, None, None]:
    conn = _open_connection(cfg, secret_scope, secret_key)
    try:
        yield conn
    finally:
        conn.close()


def _run_with_fallback(
    cfg: AppConfig,
    fn: Any,
    *,
    secret_scope: str | None = None,
    secret_key: str | None = None,
) -> Any:
    """Execute *fn(connection)* with automatic SP-token retry.

    If a user token is active and the query fails, retry with the SP
    fallback token when one is configured.
    """
    try:
        with get_connection(cfg, secret_scope, secret_key) as conn:
            return fn(conn)
    except Exception as first_err:
        forwarded_token = _user_token.get()
        if not forwarded_token:
            raise
        fb_token = get_fallback_token(secret_scope, secret_key)
        if not fb_token:
            raise
        logger.info("Query failed (%s), retrying with SP fallback token", first_err)
        conn = _connect(cfg, access_token=fb_token, _auth_label="SP fallback (query retry)")
        try:
            return fn(conn)
        finally:
            conn.close()


def list_catalogs(cfg: AppConfig) -> list[str]:
    def _exec(conn: Connection) -> list[str]:
        cursor = conn.cursor()
        cursor.execute("SHOW CATALOGS")
        rows = cursor.fetchall()
        cursor.close()
        return [row[0] for row in rows]
    return _run_with_fallback(cfg, _exec)


def list_schemas(cfg: AppConfig, catalog: str) -> list[str]:
    def _exec(conn: Connection) -> list[str]:
        cursor = conn.cursor()
        cursor.execute(f"SHOW SCHEMAS IN `{catalog}`")
        rows = cursor.fetchall()
        cursor.close()
        return [row[0] for row in rows]
    return _run_with_fallback(cfg, _exec)


def list_tables_in(cfg: AppConfig, catalog: str, schema: str) -> list[dict[str, Any]]:
    def _exec(conn: Connection) -> list[dict[str, Any]]:
        cursor = conn.cursor()
        cursor.execute(f"SHOW TABLES IN `{catalog}`.`{schema}`")
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        cursor.close()
        return [dict(zip(columns, row)) for row in rows]
    return _run_with_fallback(cfg, _exec)


def _parse_describe_result(rows: list[tuple], col_names: list[str]) -> dict[str, Any]:
    """Split DESCRIBE TABLE output into real columns and partition column names.

    Databricks appends partition metadata after a ``# Partition Information``
    separator row.  We stop collecting columns at that marker and extract the
    partition column names from the subsequent rows.
    """
    columns: list[dict[str, Any]] = []
    partition_columns: list[str] = []
    in_partition_section = False

    for row in rows:
        record = dict(zip(col_names, row))
        name = (record.get("col_name") or "").strip()

        if name.startswith("#") or name == "":
            if "partition" in name.lower():
                in_partition_section = True
            continue

        if in_partition_section:
            partition_columns.append(name)
        else:
            columns.append(record)

    return {"columns": columns, "partition_columns": partition_columns}


def describe_table_in(cfg: AppConfig, catalog: str, schema: str, table_name: str) -> dict[str, Any]:
    fqn = f"`{catalog}`.`{schema}`.`{table_name}`"
    def _exec(conn: Connection) -> dict[str, Any]:
        cursor = conn.cursor()
        cursor.execute(f"DESCRIBE TABLE {fqn}")
        rows = cursor.fetchall()
        col_names = [desc[0] for desc in cursor.description]
        cursor.close()
        return _parse_describe_result(rows, col_names)
    return _run_with_fallback(cfg, _exec)


def list_tables(cfg: AppConfig) -> list[dict[str, str]]:
    catalog = cfg.datasource.catalog
    schema = cfg.datasource.schema_name
    query = f"SHOW TABLES IN `{catalog}`.`{schema}`"
    def _exec(conn: Connection) -> list[dict[str, str]]:
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        cursor.close()
        return [dict(zip(columns, row)) for row in rows]
    return _run_with_fallback(cfg, _exec)


def describe_table(cfg: AppConfig, table_name: str) -> dict[str, Any]:
    catalog = cfg.datasource.catalog
    schema = cfg.datasource.schema_name
    fqn = f"`{catalog}`.`{schema}`.`{table_name}`"
    def _exec(conn: Connection) -> dict[str, Any]:
        cursor = conn.cursor()
        cursor.execute(f"DESCRIBE TABLE {fqn}")
        rows = cursor.fetchall()
        col_names = [desc[0] for desc in cursor.description]
        cursor.close()
        return _parse_describe_result(rows, col_names)
    return _run_with_fallback(cfg, _exec)


def _resolve_type_name(desc: tuple) -> str:
    """Extract a human-readable type name from a PEP 249 cursor.description entry."""
    raw = str(desc[1]) if len(desc) > 1 and desc[1] is not None else "STRING"
    upper = raw.upper()
    for kw in ("INT", "LONG", "SHORT", "BYTE", "BIGINT", "SMALLINT", "TINYINT"):
        if kw in upper:
            return kw if kw in ("BIGINT", "SMALLINT", "TINYINT") else "INT"
    for kw in ("DOUBLE", "FLOAT", "DECIMAL", "NUMERIC"):
        if kw in upper:
            return kw if kw in ("DOUBLE", "FLOAT") else "DECIMAL"
    if "BOOL" in upper:
        return "BOOLEAN"
    if "DATE" in upper and "TIME" not in upper:
        return "DATE"
    if "TIMESTAMP" in upper:
        return "TIMESTAMP"
    return "STRING"


def run_query(cfg: AppConfig, sql: str, limit: int = 0) -> dict[str, Any]:
    """Execute a SQL query and return {columns, rows}.

    If *limit* > 0, wraps the query in a LIMIT clause and truncates
    the result to that many rows.  If *limit* is 0, no row cap is applied.
    """
    safe_sql = sql.rstrip(";")
    exec_sql = (
        f"SELECT * FROM ({safe_sql}) AS _q LIMIT {limit}"
        if limit > 0
        else safe_sql
    )

    def _exec(conn: Connection) -> dict[str, Any]:
        cursor = conn.cursor()
        cursor.execute(exec_sql)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        column_types = [_resolve_type_name(desc) for desc in cursor.description]
        cursor.close()

        return {
            "columns": columns,
            "column_types": column_types,
            "rows": [list(row) for row in rows],
        }

    return _run_with_fallback(cfg, _exec)
