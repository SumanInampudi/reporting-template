"""
Local entry point that mirrors the Databricks Apps runtime behaviour.

In Databricks Apps the startup command lives in app.yaml.  This file
lets you start the full stack locally with:

    cd tools/dashboarding-template
    python app.py

It assumes the frontend has already been built (frontend/dist/ exists).
For local development with hot-reload, use the Vite dev server instead.
"""
from __future__ import annotations

import os

import uvicorn

from backend.main import app  # noqa: F401 — re-export for uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", os.environ.get("PORT", "8000")))
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
