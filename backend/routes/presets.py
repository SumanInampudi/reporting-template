"""Preset CRUD routes."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..storage import (
    delete_preset_by_id,
    delete_subscriptions_by_preset,
    get_preset,
    load_presets_by_workspace,
    upsert_preset,
    workspace_exists,
)

router = APIRouter(prefix="/api/workspaces/{workspace_id}/presets", tags=["presets"])


class PresetCreate(BaseModel):
    name: str
    description: str = ""
    owner: str = "local_user"
    is_public: bool = False
    snapshot: dict[str, Any]
    data_sql: str | None = None


class PresetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_public: bool | None = None
    snapshot: dict[str, Any] | None = None
    data_sql: str | None = None


@router.get("")
def list_ps(workspace_id: str) -> list[dict[str, Any]]:
    return load_presets_by_workspace(workspace_id)


@router.get("/{preset_id}")
def get_ps(workspace_id: str, preset_id: str) -> dict[str, Any]:
    p = get_preset(preset_id, workspace_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    return p


@router.post("")
def create_ps(workspace_id: str, req: PresetCreate) -> dict[str, Any]:
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")

    now = datetime.now(timezone.utc).isoformat()
    preset: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "name": req.name.strip(),
        "description": req.description.strip(),
        "owner": req.owner,
        "is_public": req.is_public,
        "snapshot": req.snapshot,
        "data_sql": req.data_sql,
        "created_at": now,
        "updated_at": now,
    }
    upsert_preset(preset)
    return preset


@router.put("/{preset_id}")
def update_ps(workspace_id: str, preset_id: str, req: PresetUpdate) -> dict[str, Any]:
    p = get_preset(preset_id, workspace_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")

    if req.name is not None:
        p["name"] = req.name.strip()
    if req.description is not None:
        p["description"] = req.description.strip()
    if req.is_public is not None:
        p["is_public"] = req.is_public
    if req.snapshot is not None:
        p["snapshot"] = req.snapshot
    if req.data_sql is not None:
        p["data_sql"] = req.data_sql
    p["updated_at"] = datetime.now(timezone.utc).isoformat()

    upsert_preset(p)
    return p


@router.delete("/{preset_id}")
def delete_ps(workspace_id: str, preset_id: str) -> dict[str, str]:
    p = get_preset(preset_id, workspace_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    delete_subscriptions_by_preset(workspace_id, preset_id)
    delete_preset_by_id(preset_id, workspace_id)
    return {"status": "deleted"}


@router.post("/{preset_id}/duplicate")
def duplicate_ps(workspace_id: str, preset_id: str) -> dict[str, Any]:
    source = get_preset(preset_id, workspace_id)
    if not source:
        raise HTTPException(status_code=404, detail="Preset not found")

    now = datetime.now(timezone.utc).isoformat()
    clone: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "name": f"{source['name']} (copy)",
        "description": source.get("description", ""),
        "owner": "local_user",
        "is_public": False,
        "snapshot": json.loads(json.dumps(source["snapshot"])),
        "created_at": now,
        "updated_at": now,
    }
    upsert_preset(clone)
    return clone
