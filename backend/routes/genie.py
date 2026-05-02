"""Proxy route for the Databricks Genie Conversation API.

Handles auth, polling, and returns structured results to the frontend.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import load_config

router = APIRouter(prefix="/api/genie", tags=["genie"])
logger = logging.getLogger(__name__)

_MAX_POLL_SECONDS = 120
_POLL_INTERVAL = 2


class GenieAskRequest(BaseModel):
    space_id: str
    question: str
    context: str | None = None
    conversation_id: str | None = None


class GenieAskResponse(BaseModel):
    conversation_id: str
    message_id: str
    status: str
    text: str | None = None
    sql: str | None = None
    columns: list[str] | None = None
    rows: list[list[Any]] | None = None
    error: str | None = None


def _get_workspace_client():
    """Create a Databricks WorkspaceClient using the app's auth config."""
    from databricks.sdk import WorkspaceClient

    cfg = load_config()
    kwargs: dict[str, str] = {}
    host = cfg.datasource.host
    if host:
        kwargs["host"] = host if host.startswith("https://") else f"https://{host}"
    if cfg.auth.token:
        kwargs["token"] = cfg.auth.token
    elif cfg.auth.client_id and cfg.auth.client_secret:
        kwargs["client_id"] = cfg.auth.client_id
        kwargs["client_secret"] = cfg.auth.client_secret

    return WorkspaceClient(**kwargs)


def _build_prompt(question: str, context: str | None) -> str:
    if not context:
        return question
    return f"{context}\n\nQuestion: {question}"


def _resolve_attachment_id(att: object) -> str | None:
    """Try every known attribute name the SDK might use for the attachment ID."""
    for attr in ("id", "attachment_id", "ID"):
        val = getattr(att, attr, None)
        if val:
            return str(val)
    query = getattr(att, "query", None)
    if query:
        for attr in ("id", "attachment_id", "query_result_id"):
            val = getattr(query, attr, None)
            if val:
                return str(val)
    return None


def _fetch_query_result(
    w: object, space_id: str, conversation_id: str, message_id: str, att_id: str,
) -> tuple[list[str] | None, list[list[Any]] | None]:
    """Fetch query results using the attachment-based API."""
    columns: list[str] | None = None
    rows: list[list[Any]] | None = None
    try:
        qr = w.genie.get_message_attachment_query_result(
            space_id=space_id,
            conversation_id=conversation_id,
            message_id=message_id,
            attachment_id=att_id,
        )
        logger.info(
            "Query result type=%s, has_columns=%s, has_data=%s",
            type(qr).__name__,
            bool(getattr(qr, "columns", None)),
            bool(getattr(qr, "data_array", None)),
        )
        if qr.columns:
            columns = [c.name for c in qr.columns]
        if qr.data_array:
            rows = qr.data_array
    except Exception:
        logger.warning("get_message_attachment_query_result failed for %s", att_id, exc_info=True)
    return columns, rows


def _fetch_via_statement(
    w: object, statement_id: str,
) -> tuple[list[str] | None, list[list[Any]] | None]:
    """Fallback: fetch query results via the SQL Statement Execution API."""
    columns: list[str] | None = None
    rows: list[list[Any]] | None = None
    try:
        stmt = w.statement_execution.get_statement(statement_id)
        if stmt.manifest and stmt.manifest.schema and stmt.manifest.schema.columns:
            columns = [c.name for c in stmt.manifest.schema.columns]
        if stmt.result and stmt.result.data_array:
            rows = stmt.result.data_array
        logger.info("Statement fallback: cols=%s, rows=%d", columns, len(rows) if rows else 0)
    except Exception:
        logger.warning("statement_execution.get_statement failed for %s", statement_id, exc_info=True)
    return columns, rows


@router.post("/ask", response_model=GenieAskResponse)
def genie_ask(req: GenieAskRequest) -> GenieAskResponse:
    cfg = load_config()
    if cfg.is_mock_mode:
        return _mock_response(req)

    try:
        w = _get_workspace_client()
    except Exception as exc:
        logger.exception("Failed to create WorkspaceClient")
        raise HTTPException(status_code=500, detail=f"Auth error: {exc}") from exc

    prompt = _build_prompt(req.question, req.context)

    try:
        if req.conversation_id:
            resp = w.genie.create_message(
                space_id=req.space_id,
                conversation_id=req.conversation_id,
                content=prompt,
            )
            conversation_id = req.conversation_id
        else:
            resp = w.genie.start_conversation(
                space_id=req.space_id,
                content=prompt,
            )
            conversation_id = resp.conversation_id

        message_id = resp.message_id

        text = None
        sql = None
        columns = None
        rows = None
        status = "SUBMITTED"

        deadline = time.time() + _MAX_POLL_SECONDS
        while time.time() < deadline:
            msg = w.genie.get_message(
                space_id=req.space_id,
                conversation_id=conversation_id,
                message_id=message_id,
            )
            status = msg.status.value if msg.status else "UNKNOWN"

            if status in ("COMPLETED", "FAILED"):
                break
            time.sleep(_POLL_INTERVAL)

        if status == "COMPLETED" and msg.attachments:
            for att in msg.attachments:
                logger.info(
                    "Genie attachment type=%s, attrs=%s",
                    type(att).__name__,
                    {k: repr(v)[:120] for k, v in vars(att).items()} if hasattr(att, "__dict__") else repr(att)[:300],
                )

                if att.text and att.text.content:
                    text = att.text.content

                if att.query and att.query.query:
                    sql = att.query.query

                    query_obj = att.query
                    logger.info(
                        "Genie query attachment attrs=%s",
                        {k: repr(v)[:120] for k, v in vars(query_obj).items()} if hasattr(query_obj, "__dict__") else repr(query_obj)[:300],
                    )

                    att_id = _resolve_attachment_id(att)
                    logger.info("Resolved attachment_id=%s", att_id)

                    if att_id:
                        columns, rows = _fetch_query_result(
                            w, req.space_id, conversation_id, message_id, att_id,
                        )

                    if columns is None and rows is None:
                        stmt_id = getattr(query_obj, "statement_id", None)
                        if stmt_id:
                            logger.info("Falling back to statement_execution with id=%s", stmt_id)
                            columns, rows = _fetch_via_statement(w, stmt_id)

        if not text and msg.content:
            text = msg.content

        return GenieAskResponse(
            conversation_id=conversation_id,
            message_id=message_id,
            status=status,
            text=text,
            sql=sql,
            columns=columns,
            rows=rows,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Genie API call failed")
        raise HTTPException(status_code=502, detail=f"Genie API error: {exc}") from exc


def _mock_response(req: GenieAskRequest) -> GenieAskResponse:
    """Return a plausible mock response for local testing."""
    return GenieAskResponse(
        conversation_id=f"mock-conv-{int(time.time())}",
        message_id=f"mock-msg-{int(time.time())}",
        status="COMPLETED",
        text=f"Here are the results for your question: **{req.question}**\n\nI analyzed the data and found the following insights.",
        sql="SELECT category, SUM(revenue) AS total\nFROM main.analytics.sales\nGROUP BY category\nORDER BY total DESC\nLIMIT 5;",
        columns=["Category", "Total Revenue"],
        rows=[
            ["Electronics", "$2.4M"],
            ["Apparel", "$1.8M"],
            ["Home & Garden", "$1.2M"],
            ["Sports", "$680K"],
            ["Books", "$320K"],
        ],
    )
