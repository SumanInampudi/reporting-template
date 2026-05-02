"""Role-based access control helpers.

ADMIN_ROLE_SUFFIXES: comma-separated list of group name suffixes that
grant "admin" role.  If empty, everyone is admin (no restriction).
Example: "DataAdmin,ClusterAdmin"

Resolved from: app_settings DB -> ADMIN_ROLE_SUFFIXES env var -> everyone is admin.
"""
from __future__ import annotations

import logging
import os as _os

from cachetools import TTLCache

logger = logging.getLogger(__name__)


def _env(key: str, default: str = "") -> str:
    val = _os.environ.get(key, default).strip()
    return "" if val.lower() == "none" else val


def _resolve_admin_suffixes() -> list[str]:
    """Read admin role suffixes from app_settings (DB), fall back to env var."""
    try:
        from .storage import get_app_settings
        app_s = get_app_settings() or {}
        db_val = (app_s.get("admin_role_suffixes") or "").strip()
        if db_val and db_val.lower() != "none":
            return [s.strip() for s in db_val.split(",") if s.strip()]
    except Exception:
        pass
    raw = _env("ADMIN_ROLE_SUFFIXES")
    return [s.strip() for s in raw.split(",") if s.strip()]


_suffixes_cache: TTLCache = TTLCache(maxsize=1, ttl=60)


def get_admin_suffixes() -> list[str]:
    cached = _suffixes_cache.get("suffixes")
    if cached is not None:
        return cached
    result = _resolve_admin_suffixes()
    _suffixes_cache["suffixes"] = result
    return result

_groups_cache: TTLCache = TTLCache(maxsize=512, ttl=300)


def resolve_role(email: str) -> tuple[str, list[str]]:
    """Look up user groups from Databricks and resolve admin/consumer role.

    Returns (role, groups).  Results are cached for 5 minutes.
    """
    suffixes = get_admin_suffixes()
    if not suffixes:
        return "admin", []

    cache_key = f"groups:{email}"
    cached = _groups_cache.get(cache_key)
    if cached is not None:
        return cached

    groups: list[str] = []
    try:
        from databricks.sdk import WorkspaceClient

        client = WorkspaceClient()
        safe_email = email.replace('"', '').replace("'", "")
        users = client.users.list(filter=f'userName eq "{safe_email}"')
        user = next(users, None)
        if user and user.groups:
            groups = [g.display for g in user.groups if g.display]
    except Exception:
        logger.warning("Failed to look up groups for %s", email, exc_info=True)

    role = "consumer"
    for group_name in groups:
        if any(group_name.endswith(f".{suffix}") for suffix in suffixes):
            role = "admin"
            break

    result = (role, groups)
    _groups_cache[cache_key] = result
    return result
