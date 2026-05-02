"""Custom theme CRUD routes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..storage import (
    delete_custom_theme_by_id,
    load_custom_themes,
    upsert_custom_theme,
)

router = APIRouter(prefix="/api/custom-themes", tags=["themes"])


class CustomThemeCreate(BaseModel):
    name: str
    colors: dict[str, str]
    owner: str = "local_user"


class CustomThemeUpdate(BaseModel):
    name: str | None = None
    colors: dict[str, str] | None = None


@router.get("")
def list_themes() -> list[dict[str, Any]]:
    return load_custom_themes()


@router.post("")
def create_theme(req: CustomThemeCreate) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    theme: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "colors": req.colors,
        "owner": req.owner,
        "created_at": now,
        "updated_at": now,
    }
    upsert_custom_theme(theme)
    return theme


@router.put("/{theme_id}")
def update_theme(theme_id: str, req: CustomThemeUpdate) -> dict[str, Any]:
    themes = load_custom_themes()
    target = None
    for t in themes:
        if t.get("id") == theme_id:
            target = t
            break
    if not target:
        raise HTTPException(status_code=404, detail="Custom theme not found")

    if req.name is not None:
        target["name"] = req.name.strip()
    if req.colors is not None:
        target["colors"] = req.colors
    target["updated_at"] = datetime.now(timezone.utc).isoformat()

    upsert_custom_theme(target)
    return target


@router.delete("/{theme_id}")
def delete_theme(theme_id: str) -> dict[str, str]:
    themes = load_custom_themes()
    if not any(t.get("id") == theme_id for t in themes):
        raise HTTPException(status_code=404, detail="Custom theme not found")
    delete_custom_theme_by_id(theme_id)
    return {"status": "deleted"}
