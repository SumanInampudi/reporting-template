"""Unified persistence layer.

Delegates to either YAML files (local dev) or Delta tables (deployed)
based on the STORAGE_BACKEND environment variable.

    STORAGE_BACKEND=yaml   →  storage_yaml.py   (default for local dev)
    STORAGE_BACKEND=delta  →  storage_delta.py   (production / deployed)
"""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_BACKEND = os.environ.get("STORAGE_BACKEND", "yaml").lower().strip()

if _BACKEND == "delta":
    logger.info("Storage backend: DELTA (catalog/schema from env)")
    from .storage_delta import (
        ensure_tables,
        # Bulk ops (kept for migration / listing)
        load_abbreviations,
        load_custom_themes,
        load_presets,
        load_workspaces,
        save_abbreviations,
        save_custom_themes,
        save_presets,
        save_workspaces,
        # Targeted single-row ops
        delete_custom_theme_by_id,
        delete_preset_by_id,
        delete_presets_by_workspace,
        delete_workspace_by_id,
        get_preset,
        get_workspace,
        load_presets_by_workspace,
        upsert_custom_theme,
        upsert_preset,
        upsert_workspace,
        workspace_exists,
        # Subscriptions
        batch_save_subscriptions,
        delete_subscription_by_id,
        delete_subscriptions_by_preset,
        delete_subscriptions_by_workspace,
        get_subscription,
        load_subscriptions_by_preset,
        upsert_subscription,
        # Shared formula columns
        delete_shared_formula_by_id,
        delete_shared_formulas_by_workspace,
        get_shared_formula,
        load_shared_formulas_by_workspace,
        upsert_shared_formula,
    )
else:
    logger.info("Storage backend: YAML (local files)")
    from .storage_yaml import (
        # Bulk ops
        load_abbreviations,
        load_custom_themes,
        load_presets,
        load_workspaces,
        save_abbreviations,
        save_custom_themes,
        save_presets,
        save_workspaces,
        # Targeted single-row ops
        delete_custom_theme_by_id,
        delete_preset_by_id,
        delete_presets_by_workspace,
        delete_workspace_by_id,
        get_preset,
        get_workspace,
        load_presets_by_workspace,
        upsert_custom_theme,
        upsert_preset,
        upsert_workspace,
        workspace_exists,
        # Subscriptions
        batch_save_subscriptions,
        delete_subscription_by_id,
        delete_subscriptions_by_preset,
        delete_subscriptions_by_workspace,
        get_subscription,
        load_subscriptions_by_preset,
        upsert_subscription,
        # Shared formula columns
        delete_shared_formula_by_id,
        delete_shared_formulas_by_workspace,
        get_shared_formula,
        load_shared_formulas_by_workspace,
        upsert_shared_formula,
    )

    def ensure_tables() -> None:
        """No-op for YAML backend."""
        pass
