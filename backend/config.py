from __future__ import annotations

import base64
import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_ENV_VAR_RE = re.compile(r"\$\{(\w+)\}")
_SECRET_RE = re.compile(r"\$\{secrets:([^/]+)/([^}]+)\}")


def _get_secrets_client(host: str | None = None, token: str | None = None):
    """Lazily create a Databricks WorkspaceClient for secret retrieval."""
    from databricks.sdk import WorkspaceClient

    kwargs: dict[str, str] = {}
    if host:
        kwargs["host"] = host if host.startswith("https://") else f"https://{host}"
    if token:
        kwargs["token"] = token

    return WorkspaceClient(**kwargs)


@lru_cache(maxsize=128)
def _fetch_secret(host: str | None, bootstrap_token: str | None, scope: str, key: str) -> str:
    """Fetch a single secret from Databricks Secrets API. Results are cached for the process lifetime."""
    client = _get_secrets_client(host, bootstrap_token)
    resp = client.secrets.get_secret(scope=scope, key=key)

    if resp.value is not None:
        return base64.b64decode(resp.value).decode("utf-8")

    raise ValueError(f"Secret '{scope}/{key}' returned empty value")


def _resolve_env_vars(value: str) -> str:
    """Replace ${VAR} placeholders with environment variable values."""
    def _replacer(match: re.Match) -> str:
        var = match.group(1)
        return os.environ.get(var, match.group(0))
    return _ENV_VAR_RE.sub(_replacer, value)


def _resolve_secrets(value: str, host: str | None, bootstrap_token: str | None) -> str:
    """Replace ${secrets:scope/key} placeholders with Databricks secret values."""
    def _replacer(match: re.Match) -> str:
        scope, key = match.group(1), match.group(2)
        try:
            return _fetch_secret(host, bootstrap_token, scope, key)
        except Exception as exc:
            logger.error("Failed to fetch secret %s/%s: %s", scope, key, exc)
            return match.group(0)
    return _SECRET_RE.sub(_replacer, value)


def _coerce_primitives(value: str) -> str | bool | int:
    """Coerce env-resolved strings to native types where unambiguous."""
    lower = value.lower()
    if lower == "true":
        return True
    if lower == "false":
        return False
    if value.isdigit():
        return int(value)
    return value


def _walk_and_resolve(obj: Any, host: str | None = None, bootstrap_token: str | None = None) -> Any:
    if isinstance(obj, dict):
        return {k: _walk_and_resolve(v, host, bootstrap_token) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_walk_and_resolve(v, host, bootstrap_token) for v in obj]
    if isinstance(obj, str):
        resolved = _resolve_env_vars(obj)
        if _SECRET_RE.search(resolved):
            resolved = _resolve_secrets(resolved, host, bootstrap_token)
        return _coerce_primitives(resolved) if isinstance(resolved, str) else resolved
    return obj


class DatasourceConfig(BaseModel):
    model_config = {"populate_by_name": True}

    type: str = "databricks"
    host: str
    http_path: str
    catalog: str = "main"
    schema_name: str = Field(default="default", alias="schema")


class SecretsConfig(BaseModel):
    """Optional bootstrap credentials used to authenticate with the Databricks
    Secrets API *before* the main auth.token is resolved.  Only needed when
    auth values themselves come from Databricks secrets."""
    host: str | None = None
    bootstrap_token: str | None = None


class AuthConfig(BaseModel):
    method: str = "pat"
    token: str | None = None
    client_id: str | None = None
    client_secret: str | None = None


class ServerConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]


class SettingsConfig(BaseModel):
    local_test_mode: bool = False
    debug: bool = False
    log_level: str = "INFO"
    default_row_limit: int = 0
    max_row_limit: int = 0
    query_timeout_seconds: int = 300


class FeaturesConfig(BaseModel):
    enable_charts: bool = True
    enable_presets: bool = True
    enable_sql_preview: bool = True
    enable_csv_export: bool = True


class CacheConfig(BaseModel):
    enabled: bool = True
    ttl_seconds: int = 300


class AppConfig(BaseModel):
    datasource: DatasourceConfig
    auth: AuthConfig
    secrets: SecretsConfig = SecretsConfig()
    server: ServerConfig = ServerConfig()
    settings: SettingsConfig = SettingsConfig()
    features: FeaturesConfig = FeaturesConfig()
    cache: CacheConfig = CacheConfig()

    @property
    def is_mock_mode(self) -> bool:
        return self.settings.local_test_mode


def load_config(path: str | Path | None = None) -> AppConfig:
    from dotenv import load_dotenv

    if path is None:
        path = Path(__file__).resolve().parent.parent / "config.yaml"
    path = Path(path)
    env_path = path.parent / ".env"

    load_dotenv(env_path, override=False)

    with open(path) as f:
        raw = yaml.safe_load(f)

    # Pass 1: resolve ${ENV_VAR} placeholders only (no secrets yet)
    env_resolved = _walk_and_resolve(raw)

    # Extract bootstrap info for the Secrets API client.
    # The host falls back to datasource.host so you don't have to repeat it.
    secrets_cfg = env_resolved.get("secrets") or {}
    bootstrap_host = secrets_cfg.get("host") or env_resolved.get("datasource", {}).get("host")
    bootstrap_token = secrets_cfg.get("bootstrap_token")

    # Pass 2: resolve any remaining ${secrets:scope/key} placeholders
    has_secrets = any(
        isinstance(v, str) and "${secrets:" in v
        for v in _flatten_strings(env_resolved)
    )
    if has_secrets:
        env_resolved = _walk_and_resolve(raw, host=bootstrap_host, bootstrap_token=bootstrap_token)

    return AppConfig(**env_resolved)


def _flatten_strings(obj: Any) -> list[str]:
    """Collect all string leaf values from a nested dict/list."""
    out: list[str] = []
    if isinstance(obj, dict):
        for v in obj.values():
            out.extend(_flatten_strings(v))
    elif isinstance(obj, list):
        for v in obj:
            out.extend(_flatten_strings(v))
    elif isinstance(obj, str):
        out.append(obj)
    return out
