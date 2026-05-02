"""Abbreviation dictionary CRUD routes."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..storage import load_abbreviations, save_abbreviations

router = APIRouter(prefix="/api", tags=["abbreviations"])


class AbbreviationEntry(BaseModel):
    word: str
    abbr: str


class AbbreviationsPayload(BaseModel):
    entries: list[AbbreviationEntry]


@router.get("/abbreviations")
def list_abbreviations() -> list[dict[str, Any]]:
    return load_abbreviations()


@router.put("/abbreviations")
def update_abbreviations(req: AbbreviationsPayload) -> list[dict[str, Any]]:
    entries = [e.model_dump() for e in req.entries]
    save_abbreviations(entries)
    return entries
