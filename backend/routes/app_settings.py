"""Platform-level app settings (team name, branding, etc.)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..storage import get_app_settings, upsert_app_settings

router = APIRouter(prefix="/api/app-settings", tags=["app-settings"])


class AppSettingsPayload(BaseModel):
    team_name: str | None = None
    platform_tagline: str | None = None
    logo_url: str | None = None
    default_catalog: str | None = None
    default_schema: str | None = None
    admin_role_suffixes: str | None = None
    query_timeout_seconds: int | None = None


@router.get("")
def get_settings() -> dict[str, Any]:
    settings = get_app_settings()
    return settings or {}


@router.patch("")
def update_settings(payload: AppSettingsPayload) -> dict[str, Any]:
    current = get_app_settings() or {"id": "default"}
    updates = payload.model_dump(exclude_none=True)
    current.update(updates)
    upsert_app_settings(current)
    return current
