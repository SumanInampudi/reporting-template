"""Subscription CRUD routes — per-user model.

Each row represents one subscriber (email) for one preset, with their
own schedule, format preference, and delivery tracking fields.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..storage import (
    batch_save_subscriptions,
    delete_subscription_by_id,
    get_preset,
    get_subscription,
    load_subscriptions_by_preset,
    upsert_subscription,
    workspace_exists,
)

router = APIRouter(
    prefix="/api/workspaces/{workspace_id}/presets/{preset_id}/subscriptions",
    tags=["subscriptions"],
)


class SchedulePayload(BaseModel):
    frequency: str  # daily | weekly | monthly
    day_of_week: int | None = None
    day_of_month: int | None = None  # -1 = last day


class SubscriptionCreate(BaseModel):
    email: str
    schedule: SchedulePayload
    format: str = "csv"
    added_by: str = "local_user"


class SubscriptionUpdate(BaseModel):
    schedule: SchedulePayload | None = None
    format: str | None = None
    enabled: bool | None = None


class BatchSubscriptionItem(BaseModel):
    id: str | None = None
    email: str
    schedule: SchedulePayload
    format: str = "csv"
    enabled: bool = True
    added_by: str = "local_user"


class BatchSavePayload(BaseModel):
    subscriptions: list[BatchSubscriptionItem]


@router.get("")
def list_subs(workspace_id: str, preset_id: str) -> list[dict[str, Any]]:
    return load_subscriptions_by_preset(workspace_id, preset_id)


@router.post("")
def create_sub(workspace_id: str, preset_id: str, req: SubscriptionCreate) -> dict[str, Any]:
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not get_preset(preset_id, workspace_id):
        raise HTTPException(status_code=404, detail="Preset not found")

    existing = load_subscriptions_by_preset(workspace_id, preset_id)
    for s in existing:
        if s.get("email", "").lower() == req.email.strip().lower():
            raise HTTPException(status_code=409, detail="This email is already subscribed")

    now = datetime.now(timezone.utc).isoformat()
    sub: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "preset_id": preset_id,
        "email": req.email.strip().lower(),
        "schedule": req.schedule.model_dump(exclude_none=True),
        "format": req.format,
        "enabled": True,
        "added_by": req.added_by,
        "created_at": now,
        "updated_at": now,
    }
    upsert_subscription(sub)
    return sub


@router.put("/{sub_id}")
def update_sub(
    workspace_id: str, preset_id: str, sub_id: str, req: SubscriptionUpdate,
) -> dict[str, Any]:
    sub = get_subscription(sub_id)
    if not sub or sub.get("workspace_id") != workspace_id or sub.get("preset_id") != preset_id:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if req.schedule is not None:
        sub["schedule"] = req.schedule.model_dump(exclude_none=True)
    if req.format is not None:
        sub["format"] = req.format
    if req.enabled is not None:
        sub["enabled"] = req.enabled
    sub["updated_at"] = datetime.now(timezone.utc).isoformat()

    upsert_subscription(sub)
    return sub


@router.delete("/{sub_id}")
def delete_sub(workspace_id: str, preset_id: str, sub_id: str) -> dict[str, str]:
    sub = get_subscription(sub_id)
    if not sub or sub.get("workspace_id") != workspace_id or sub.get("preset_id") != preset_id:
        raise HTTPException(status_code=404, detail="Subscription not found")
    delete_subscription_by_id(sub_id)
    return {"status": "deleted"}


@router.put("")
def batch_save(workspace_id: str, preset_id: str, req: BatchSavePayload) -> list[dict[str, Any]]:
    """Replace the full subscription list for a preset in one call.

    Compares the incoming list with the existing rows, builds the
    upsert/delete sets, then delegates to a single storage call that
    reuses one DB connection for all statements.
    """
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not get_preset(preset_id, workspace_id):
        raise HTTPException(status_code=404, detail="Preset not found")

    existing = load_subscriptions_by_preset(workspace_id, preset_id)
    existing_by_id: dict[str, dict[str, Any]] = {s["id"]: s for s in existing}
    now = datetime.now(timezone.utc).isoformat()

    incoming_ids: set[str] = set()
    upsert_items: list[dict[str, Any]] = []
    result: list[dict[str, Any]] = []

    for item in req.subscriptions:
        if item.id and item.id in existing_by_id:
            sub = existing_by_id[item.id]
            sub["schedule"] = item.schedule.model_dump(exclude_none=True)
            sub["format"] = item.format
            sub["enabled"] = item.enabled
            sub["updated_at"] = now
            incoming_ids.add(item.id)
            upsert_items.append(sub)
            result.append(sub)
        else:
            sub = {
                "id": item.id or str(uuid.uuid4()),
                "workspace_id": workspace_id,
                "preset_id": preset_id,
                "email": item.email.strip().lower(),
                "schedule": item.schedule.model_dump(exclude_none=True),
                "format": item.format,
                "enabled": item.enabled,
                "added_by": item.added_by,
                "created_at": now,
                "updated_at": now,
            }
            incoming_ids.add(sub["id"])
            upsert_items.append(sub)
            result.append(sub)

    delete_ids = [old_id for old_id in existing_by_id if old_id not in incoming_ids]

    batch_save_subscriptions(workspace_id, preset_id, upsert_items, delete_ids)

    return result
