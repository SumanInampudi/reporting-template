"""Workspace CRUD routes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..storage import (
    delete_presets_by_workspace,
    delete_subscriptions_by_workspace,
    delete_workspace_by_id,
    get_workspace,
    load_workspaces,
    upsert_workspace,
    workspace_exists,
)

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class AiSettingsPayload(BaseModel):
    options: list[str] = []
    llmEndpoint: str | None = None
    zenieEndpoint: str | None = None
    rcaEndpoint: str | None = None


class ColumnGroupDef(BaseModel):
    name: str
    patterns: list[str] = []


class ColumnGroupConfig(BaseModel):
    mode: str = "measures_dimensions"
    groups: list[ColumnGroupDef] | None = None


class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""
    catalog: str | None = None
    schema_name: str | None = None
    default_table: str | None = None
    capabilities: list[str] = ["self_service", "dashboarding"]
    features: list[str] = ["download_data", "custom_columns"]
    dashboard_features: list[str] | None = None
    ai_settings: AiSettingsPayload | None = None
    column_aliases: dict[str, str] | None = None
    column_aggregations: dict[str, str] | None = None
    excluded_columns: list[str] | None = None
    column_groups: ColumnGroupConfig | None = None
    secret_scope: str | None = None
    secret_key: str | None = None
    theme: str = "nike"
    density: str = "spacious"
    row_limit: int = 0


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    catalog: str | None = None
    schema_name: str | None = None
    default_table: str | None = None
    capabilities: list[str] | None = None
    features: list[str] | None = None
    dashboard_features: list[str] | None = None
    ai_settings: AiSettingsPayload | None = None
    column_aliases: dict[str, str] | None = None
    column_aggregations: dict[str, str] | None = None
    excluded_columns: list[str] | None = None
    column_groups: ColumnGroupConfig | None = None
    secret_scope: str | None = None
    secret_key: str | None = None
    theme: str | None = None
    density: str | None = None
    row_limit: int | None = None


@router.get("")
def list_ws() -> list[dict[str, Any]]:
    return load_workspaces()


@router.get("/{workspace_id}")
def get_ws(workspace_id: str) -> dict[str, Any]:
    ws = get_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.post("")
def create_ws(req: WorkspaceCreate) -> dict[str, Any]:
    slug = req.name.lower().strip().replace(" ", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    if workspace_exists(slug):
        workspaces = load_workspaces()
        slug = f"{slug}-{len(workspaces) + 1}"

    ws: dict[str, Any] = {
        "id": slug,
        "name": req.name.strip(),
        "description": req.description.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "datasource": {
            "catalog": req.catalog,
            "schema": req.schema_name,
            "default_table": req.default_table,
        },
        "capabilities": req.capabilities,
        "features": req.features,
        "settings": {
            "theme": req.theme,
            "density": req.density,
            "row_limit": req.row_limit,
        },
    }
    if req.dashboard_features:
        ws["dashboard_features"] = req.dashboard_features
    if req.secret_scope:
        ws["secret_scope"] = req.secret_scope
    if req.secret_key:
        ws["secret_key"] = req.secret_key
    if req.column_aliases:
        ws["column_aliases"] = req.column_aliases
    if req.column_aggregations:
        ws["column_aggregations"] = req.column_aggregations
    if req.excluded_columns:
        ws["excluded_columns"] = req.excluded_columns
    if req.column_groups and req.column_groups.mode != "measures_dimensions":
        ws["column_groups"] = req.column_groups.model_dump(exclude_none=True)
    if req.ai_settings:
        ws["ai_settings"] = req.ai_settings.model_dump(exclude_none=True)
    upsert_workspace(ws)
    return ws


@router.put("/{workspace_id}")
def update_ws(workspace_id: str, req: WorkspaceUpdate) -> dict[str, Any]:
    ws = get_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if req.name is not None:
        ws["name"] = req.name.strip()
    if req.description is not None:
        ws["description"] = req.description.strip()
    ds = ws.setdefault("datasource", {})
    if req.catalog is not None:
        ds["catalog"] = req.catalog
    if req.schema_name is not None:
        ds["schema"] = req.schema_name
    if req.default_table is not None:
        ds["default_table"] = req.default_table
    if req.capabilities is not None:
        ws["capabilities"] = req.capabilities
    if req.features is not None:
        ws["features"] = req.features
    if req.dashboard_features is not None:
        if req.dashboard_features:
            ws["dashboard_features"] = req.dashboard_features
        else:
            ws.pop("dashboard_features", None)
    if req.secret_scope is not None:
        ws["secret_scope"] = req.secret_scope
    if req.secret_key is not None:
        ws["secret_key"] = req.secret_key
    if req.column_aliases is not None:
        ws["column_aliases"] = req.column_aliases
    if req.column_aggregations is not None:
        if req.column_aggregations:
            ws["column_aggregations"] = req.column_aggregations
        else:
            ws.pop("column_aggregations", None)
    if req.excluded_columns is not None:
        if req.excluded_columns:
            ws["excluded_columns"] = req.excluded_columns
        else:
            ws.pop("excluded_columns", None)
    if req.column_groups is not None:
        if req.column_groups.mode == "measures_dimensions":
            ws.pop("column_groups", None)
        else:
            ws["column_groups"] = req.column_groups.model_dump(exclude_none=True)
    if req.ai_settings is not None:
        ws["ai_settings"] = req.ai_settings.model_dump(exclude_none=True)
    elif req.capabilities is not None and "ai_insights" not in req.capabilities:
        ws.pop("ai_settings", None)
    st = ws.setdefault("settings", {})
    if req.theme is not None:
        st["theme"] = req.theme
    if req.density is not None:
        st["density"] = req.density
    if req.row_limit is not None:
        st["row_limit"] = req.row_limit

    upsert_workspace(ws)
    return ws


@router.delete("/{workspace_id}")
def delete_ws(workspace_id: str) -> dict[str, str]:
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    delete_workspace_by_id(workspace_id)
    delete_subscriptions_by_workspace(workspace_id)
    delete_presets_by_workspace(workspace_id)
    return {"status": "deleted"}
