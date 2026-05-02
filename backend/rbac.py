"""Role-based access control helpers.

ADMIN_ROLE_SUFFIXES: comma-separated list of group name suffixes that
grant "admin" role.  If empty, everyone is admin (no restriction).
Example: "DataAdmin,ClusterAdmin"

To customise for your team, change this env var in .env / databricks.yml.
"""
from __future__ import annotations

import logging
import os as _os

from cachetools import TTLCache

logger = logging.getLogger(__name__)


def _env(key: str, default: str = "") -> str:
    val = _os.environ.get(key, default).strip()
    return "" if val.lower() == "none" else val


ADMIN_ROLE_SUFFIXES: list[str] = [
    s.strip()
    for s in _env("ADMIN_ROLE_SUFFIXES").split(",")
    if s.strip()
]

_groups_cache: TTLCache = TTLCache(maxsize=512, ttl=300)


def resolve_role(email: str) -> tuple[str, list[str]]:
    """Look up user groups from Databricks and resolve admin/consumer role.

    Returns (role, groups).  Results are cached for 5 minutes.
    """
    if not ADMIN_ROLE_SUFFIXES:
        return "admin", []

    cache_key = f"groups:{email}"
    cached = _groups_cache.get(cache_key)
    if cached is not None:
        return cached

    groups: list[str] = []
    try:
        from databricks.sdk import WorkspaceClient

        client = WorkspaceClient()
        users = client.users.list(filter=f'userName eq "{email}"')
        user = next(users, None)
        if user and user.groups:
            groups = [g.display for g in user.groups if g.display]
    except Exception:
        logger.warning("Failed to look up groups for %s", email, exc_info=True)

    role = "consumer"
    for group_name in groups:
        if any(group_name.endswith(f".{suffix}") for suffix in ADMIN_ROLE_SUFFIXES):
            role = "admin"
            break

    result = (role, groups)
    _groups_cache[cache_key] = result
    return result
