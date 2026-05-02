"""Workspace CRUD routes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..storage import (
    delete_presets_by_workspace,
    delete_shared_formulas_by_workspace,
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
    columns: list[str] | None = None


class ColumnGroupConfig(BaseModel):
    mode: str = "measures_dimensions"
    groups: list[ColumnGroupDef] | None = None
    dimensionGroups: list[ColumnGroupDef] | None = None
    measureGroups: list[ColumnGroupDef] | None = None


class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""
    catalog: str | None = None
    schema_name: str | None = None
    default_table: str | None = None
    base_filters: list[dict[str, Any]] | None = None
    source_mode: str = "table"
    custom_query: str | None = None
    capabilities: list[str] = ["self_service", "dashboarding"]
    features: list[str] = ["download_data", "custom_columns"]
    dashboard_features: list[str] | None = None
    ai_settings: AiSettingsPayload | None = None
    column_aliases: dict[str, str] | None = None
    column_type_overrides: dict[str, str] | None = None
    column_aggregations: dict[str, str] | None = None
    excluded_columns: list[str] | None = None
    column_groups: ColumnGroupConfig | None = None
    dimension_sources: list[dict[str, Any]] | None = None
    cascade_rules: list[dict[str, Any]] | None = None
    hierarchies: list[dict[str, Any]] | None = None
    abbreviations: list[dict[str, str]] | None = None
    free_text_filter_columns: list[str] | None = None
    search_select_columns: list[str] | None = None
    single_select_columns: list[str] | None = None
    free_text_validation_rules: list[dict[str, Any]] | None = None
    joins: list[dict[str, Any]] | None = None
    theme: str = "nike"
    density: str = "spacious"
    row_limit: int = 0
    upload_limit_mb: float | None = None
    accent_color: str = "#FA5400"
    default_preset_id: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    catalog: str | None = None
    schema_name: str | None = None
    default_table: str | None = None
    base_filters: list[dict[str, Any]] | None = None
    source_mode: str | None = None
    custom_query: str | None = None
    capabilities: list[str] | None = None
    features: list[str] | None = None
    dashboard_features: list[str] | None = None
    ai_settings: AiSettingsPayload | None = None
    column_aliases: dict[str, str] | None = None
    column_type_overrides: dict[str, str] | None = None
    column_aggregations: dict[str, str] | None = None
    excluded_columns: list[str] | None = None
    column_groups: ColumnGroupConfig | None = None
    dimension_sources: list[dict[str, Any]] | None = None
    cascade_rules: list[dict[str, Any]] | None = None
    hierarchies: list[dict[str, Any]] | None = None
    abbreviations: list[dict[str, str]] | None = None
    free_text_filter_columns: list[str] | None = None
    search_select_columns: list[str] | None = None
    single_select_columns: list[str] | None = None
    free_text_validation_rules: list[dict[str, Any]] | None = None
    joins: list[dict[str, Any]] | None = None
    theme: str | None = None
    density: str | None = None
    row_limit: int | None = None
    upload_limit_mb: float | None = None
    accent_color: str | None = None
    default_preset_id: str | None = None


class SetDefaultPreset(BaseModel):
    preset_id: str | None = None


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
            **({"base_filters": req.base_filters} if req.base_filters else {}),
            "source_mode": req.source_mode,
            **({"custom_query": req.custom_query} if req.custom_query else {}),
        },
        "capabilities": req.capabilities,
        "features": req.features,
        "settings": {
            "theme": req.theme,
            "density": req.density,
            "row_limit": req.row_limit,
            "accent_color": req.accent_color,
            **({"upload_limit_mb": req.upload_limit_mb} if req.upload_limit_mb is not None else {}),
        },
    }
    if req.dashboard_features:
        ws["dashboard_features"] = req.dashboard_features
    if req.column_aliases:
        ws["column_aliases"] = req.column_aliases
    if req.column_type_overrides:
        ws["column_type_overrides"] = req.column_type_overrides
    if req.column_aggregations:
        ws["column_aggregations"] = req.column_aggregations
    if req.excluded_columns:
        ws["excluded_columns"] = req.excluded_columns
    if req.column_groups and (
        req.column_groups.mode != "measures_dimensions"
        or req.column_groups.dimensionGroups
        or req.column_groups.measureGroups
    ):
        ws["column_groups"] = req.column_groups.model_dump(exclude_none=True)
    if req.dimension_sources:
        ws["dimension_sources"] = req.dimension_sources
    if req.cascade_rules:
        ws["cascade_rules"] = req.cascade_rules
    if req.hierarchies:
        ws["hierarchies"] = req.hierarchies
    if req.abbreviations:
        ws["abbreviations"] = req.abbreviations
    if req.free_text_filter_columns:
        ws["free_text_filter_columns"] = req.free_text_filter_columns
    if req.search_select_columns:
        ws["search_select_columns"] = req.search_select_columns
    if req.single_select_columns:
        ws["single_select_columns"] = req.single_select_columns
    if req.free_text_validation_rules:
        ws["free_text_validation_rules"] = req.free_text_validation_rules
    if req.joins:
        ws["joins"] = req.joins
    if req.ai_settings:
        ws["ai_settings"] = req.ai_settings.model_dump(exclude_none=True)
    if req.default_preset_id:
        ws["default_preset_id"] = req.default_preset_id
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
    if req.base_filters is not None:
        if req.base_filters:
            ds["base_filters"] = req.base_filters
        else:
            ds.pop("base_filters", None)
    if req.source_mode is not None:
        ds["source_mode"] = req.source_mode
    if req.custom_query is not None:
        if req.custom_query:
            ds["custom_query"] = req.custom_query
        else:
            ds.pop("custom_query", None)
    if req.capabilities is not None:
        ws["capabilities"] = req.capabilities
    if req.features is not None:
        ws["features"] = req.features
    if req.dashboard_features is not None:
        if req.dashboard_features:
            ws["dashboard_features"] = req.dashboard_features
        else:
            ws.pop("dashboard_features", None)
    if req.column_aliases is not None:
        if req.column_aliases:
            ws["column_aliases"] = req.column_aliases
        else:
            ws.pop("column_aliases", None)
    if req.column_type_overrides is not None:
        if req.column_type_overrides:
            ws["column_type_overrides"] = req.column_type_overrides
        else:
            ws.pop("column_type_overrides", None)
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
        has_sub = bool(req.column_groups.dimensionGroups or req.column_groups.measureGroups)
        if req.column_groups.mode == "measures_dimensions" and not has_sub:
            ws.pop("column_groups", None)
        else:
            ws["column_groups"] = req.column_groups.model_dump(exclude_none=True)
    if req.dimension_sources is not None:
        if req.dimension_sources:
            ws["dimension_sources"] = req.dimension_sources
        else:
            ws.pop("dimension_sources", None)
    if req.cascade_rules is not None:
        if req.cascade_rules:
            ws["cascade_rules"] = req.cascade_rules
        else:
            ws.pop("cascade_rules", None)
    if req.hierarchies is not None:
        if req.hierarchies:
            ws["hierarchies"] = req.hierarchies
        else:
            ws.pop("hierarchies", None)
    if req.abbreviations is not None:
        if req.abbreviations:
            ws["abbreviations"] = req.abbreviations
        else:
            ws.pop("abbreviations", None)
    if req.free_text_filter_columns is not None:
        if req.free_text_filter_columns:
            ws["free_text_filter_columns"] = req.free_text_filter_columns
        else:
            ws.pop("free_text_filter_columns", None)
    if req.search_select_columns is not None:
        if req.search_select_columns:
            ws["search_select_columns"] = req.search_select_columns
        else:
            ws.pop("search_select_columns", None)
    if req.single_select_columns is not None:
        if req.single_select_columns:
            ws["single_select_columns"] = req.single_select_columns
        else:
            ws.pop("single_select_columns", None)
    if req.free_text_validation_rules is not None:
        if req.free_text_validation_rules:
            ws["free_text_validation_rules"] = req.free_text_validation_rules
        else:
            ws.pop("free_text_validation_rules", None)
    if req.joins is not None:
        if req.joins:
            ws["joins"] = req.joins
        else:
            ws.pop("joins", None)
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
    if req.upload_limit_mb is not None:
        st["upload_limit_mb"] = req.upload_limit_mb
    if req.accent_color is not None:
        st["accent_color"] = req.accent_color
    if req.default_preset_id is not None:
        if req.default_preset_id:
            ws["default_preset_id"] = req.default_preset_id
        else:
            ws.pop("default_preset_id", None)

    upsert_workspace(ws)
    return ws


@router.patch("/{workspace_id}/default-preset")
def set_default_preset(workspace_id: str, req: SetDefaultPreset) -> dict[str, Any]:
    ws = get_workspace(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if req.preset_id:
        ws["default_preset_id"] = req.preset_id
    else:
        ws.pop("default_preset_id", None)
    upsert_workspace(ws)
    return ws


@router.delete("/{workspace_id}")
def delete_ws(workspace_id: str) -> dict[str, str]:
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    delete_workspace_by_id(workspace_id)
    delete_subscriptions_by_workspace(workspace_id)
    delete_presets_by_workspace(workspace_id)
    delete_shared_formulas_by_workspace(workspace_id)
    return {"status": "deleted"}
