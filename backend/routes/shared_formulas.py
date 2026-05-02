"""Shared formula columns — workspace-level public calculated columns."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..storage import (
    delete_shared_formula_by_id,
    get_shared_formula,
    load_shared_formulas_by_workspace,
    upsert_shared_formula,
    workspace_exists,
)

router = APIRouter(
    prefix="/api/workspaces/{workspace_id}/shared-formulas",
    tags=["shared_formulas"],
)


class SharedFormulaCreate(BaseModel):
    alias: str
    expression: str
    data_type: str = "DOUBLE"


class SharedFormulaUpdate(BaseModel):
    alias: str | None = None
    expression: str | None = None
    data_type: str | None = None


@router.get("")
def list_shared(workspace_id: str) -> list[dict[str, Any]]:
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return load_shared_formulas_by_workspace(workspace_id)


@router.post("")
def create_shared(workspace_id: str, req: SharedFormulaCreate) -> dict[str, Any]:
    if not workspace_exists(workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")

    now = datetime.now(timezone.utc).isoformat()
    formula: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "alias": req.alias.strip(),
        "expression": req.expression.strip(),
        "data_type": req.data_type,
        "owner": "local_user",
        "created_at": now,
        "updated_at": now,
    }
    upsert_shared_formula(formula)
    return formula


@router.put("/{formula_id}")
def update_shared(workspace_id: str, formula_id: str, req: SharedFormulaUpdate) -> dict[str, Any]:
    formula = get_shared_formula(formula_id)
    if not formula or formula.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=404, detail="Shared formula not found")

    if req.alias is not None:
        formula["alias"] = req.alias.strip()
    if req.expression is not None:
        formula["expression"] = req.expression.strip()
    if req.data_type is not None:
        formula["data_type"] = req.data_type
    formula["updated_at"] = datetime.now(timezone.utc).isoformat()

    upsert_shared_formula(formula)
    return formula


@router.delete("/{formula_id}")
def delete_shared(workspace_id: str, formula_id: str) -> dict[str, str]:
    formula = get_shared_formula(formula_id)
    if not formula or formula.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=404, detail="Shared formula not found")
    delete_shared_formula_by_id(formula_id)
    return {"status": "deleted"}
