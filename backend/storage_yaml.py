"""YAML-file-based persistence (local development backend)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

_ROOT = Path(__file__).resolve().parent.parent

WORKSPACES_PATH = _ROOT / "workspaces.yaml"
PRESETS_PATH = _ROOT / "presets.yaml"
CUSTOM_THEMES_PATH = _ROOT / "custom_themes.yaml"
ABBREVIATIONS_PATH = _ROOT / "abbreviations.yaml"


def _load_yaml_list(path: Path, key: str) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with open(path) as f:
        data = yaml.safe_load(f)
    return (data or {}).get(key, [])


def _save_yaml_list(path: Path, key: str, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        yaml.dump({key: items}, f, default_flow_style=False, sort_keys=False)


# ── Bulk API ───────────────────────────────────────────────────────────

def load_workspaces() -> list[dict[str, Any]]:
    return _load_yaml_list(WORKSPACES_PATH, "workspaces")


def save_workspaces(workspaces: list[dict[str, Any]]) -> None:
    _save_yaml_list(WORKSPACES_PATH, "workspaces", workspaces)


def load_presets() -> list[dict[str, Any]]:
    return _load_yaml_list(PRESETS_PATH, "presets")


def save_presets(presets: list[dict[str, Any]]) -> None:
    _save_yaml_list(PRESETS_PATH, "presets", presets)


def load_custom_themes() -> list[dict[str, Any]]:
    return _load_yaml_list(CUSTOM_THEMES_PATH, "themes")


def save_custom_themes(themes: list[dict[str, Any]]) -> None:
    _save_yaml_list(CUSTOM_THEMES_PATH, "themes", themes)


def load_abbreviations() -> list[dict[str, Any]]:
    return _load_yaml_list(ABBREVIATIONS_PATH, "abbreviations")


def save_abbreviations(entries: list[dict[str, Any]]) -> None:
    _save_yaml_list(ABBREVIATIONS_PATH, "abbreviations", entries)


# ── Targeted single-row operations ────────────────────────────────────
# For YAML these still rewrite the whole file but expose the same API
# as the Delta backend so routes are backend-agnostic.

# Workspaces

def get_workspace(workspace_id: str) -> dict[str, Any] | None:
    for ws in load_workspaces():
        if ws.get("id") == workspace_id:
            return ws
    return None


def upsert_workspace(ws: dict[str, Any]) -> None:
    all_ws = load_workspaces()
    for i, existing in enumerate(all_ws):
        if existing.get("id") == ws.get("id"):
            all_ws[i] = ws
            save_workspaces(all_ws)
            return
    all_ws.append(ws)
    save_workspaces(all_ws)


def delete_workspace_by_id(workspace_id: str) -> None:
    all_ws = load_workspaces()
    save_workspaces([ws for ws in all_ws if ws.get("id") != workspace_id])


def workspace_exists(workspace_id: str) -> bool:
    return any(ws.get("id") == workspace_id for ws in load_workspaces())


# Presets

def get_preset(preset_id: str, workspace_id: str) -> dict[str, Any] | None:
    for p in load_presets():
        if p.get("id") == preset_id and p.get("workspace_id") == workspace_id:
            return p
    return None


def load_presets_by_workspace(workspace_id: str) -> list[dict[str, Any]]:
    return [p for p in load_presets() if p.get("workspace_id") == workspace_id]


def upsert_preset(preset: dict[str, Any]) -> None:
    all_ps = load_presets()
    for i, existing in enumerate(all_ps):
        if existing.get("id") == preset.get("id"):
            all_ps[i] = preset
            save_presets(all_ps)
            return
    all_ps.append(preset)
    save_presets(all_ps)


def delete_preset_by_id(preset_id: str, workspace_id: str) -> None:
    all_ps = load_presets()
    save_presets([
        p for p in all_ps
        if not (p.get("id") == preset_id and p.get("workspace_id") == workspace_id)
    ])


def delete_presets_by_workspace(workspace_id: str) -> None:
    all_ps = load_presets()
    save_presets([p for p in all_ps if p.get("workspace_id") != workspace_id])


# Custom themes

def upsert_custom_theme(theme: dict[str, Any]) -> None:
    all_th = load_custom_themes()
    for i, existing in enumerate(all_th):
        if existing.get("id") == theme.get("id"):
            all_th[i] = theme
            save_custom_themes(all_th)
            return
    all_th.append(theme)
    save_custom_themes(all_th)


def delete_custom_theme_by_id(theme_id: str) -> None:
    all_th = load_custom_themes()
    save_custom_themes([t for t in all_th if t.get("id") != theme_id])


# Subscriptions

SUBSCRIPTIONS_PATH = _ROOT / "subscriptions.yaml"


def load_subscriptions() -> list[dict[str, Any]]:
    return _load_yaml_list(SUBSCRIPTIONS_PATH, "subscriptions")


def save_subscriptions(subs: list[dict[str, Any]]) -> None:
    _save_yaml_list(SUBSCRIPTIONS_PATH, "subscriptions", subs)


def load_subscriptions_by_preset(workspace_id: str, preset_id: str) -> list[dict[str, Any]]:
    return [
        s for s in load_subscriptions()
        if s.get("workspace_id") == workspace_id and s.get("preset_id") == preset_id
    ]


def get_subscription(sub_id: str) -> dict[str, Any] | None:
    for s in load_subscriptions():
        if s.get("id") == sub_id:
            return s
    return None


def upsert_subscription(sub: dict[str, Any]) -> None:
    all_subs = load_subscriptions()
    for i, existing in enumerate(all_subs):
        if existing.get("id") == sub.get("id"):
            all_subs[i] = sub
            save_subscriptions(all_subs)
            return
    all_subs.append(sub)
    save_subscriptions(all_subs)


def delete_subscription_by_id(sub_id: str) -> None:
    all_subs = load_subscriptions()
    save_subscriptions([s for s in all_subs if s.get("id") != sub_id])


def delete_subscriptions_by_preset(workspace_id: str, preset_id: str) -> None:
    all_subs = load_subscriptions()
    save_subscriptions([
        s for s in all_subs
        if not (s.get("workspace_id") == workspace_id and s.get("preset_id") == preset_id)
    ])


def delete_subscriptions_by_workspace(workspace_id: str) -> None:
    all_subs = load_subscriptions()
    save_subscriptions([s for s in all_subs if s.get("workspace_id") != workspace_id])


# Shared Formula Columns

SHARED_FORMULAS_PATH = _ROOT / "shared_formulas.yaml"


def load_shared_formulas() -> list[dict[str, Any]]:
    return _load_yaml_list(SHARED_FORMULAS_PATH, "shared_formulas")


def save_shared_formulas(items: list[dict[str, Any]]) -> None:
    _save_yaml_list(SHARED_FORMULAS_PATH, "shared_formulas", items)


def load_shared_formulas_by_workspace(workspace_id: str) -> list[dict[str, Any]]:
    return [f for f in load_shared_formulas() if f.get("workspace_id") == workspace_id]


def get_shared_formula(formula_id: str) -> dict[str, Any] | None:
    for f in load_shared_formulas():
        if f.get("id") == formula_id:
            return f
    return None


def upsert_shared_formula(formula: dict[str, Any]) -> None:
    all_f = load_shared_formulas()
    for i, existing in enumerate(all_f):
        if existing.get("id") == formula.get("id"):
            all_f[i] = formula
            save_shared_formulas(all_f)
            return
    all_f.append(formula)
    save_shared_formulas(all_f)


def delete_shared_formula_by_id(formula_id: str) -> None:
    all_f = load_shared_formulas()
    save_shared_formulas([f for f in all_f if f.get("id") != formula_id])


def delete_shared_formulas_by_workspace(workspace_id: str) -> None:
    all_f = load_shared_formulas()
    save_shared_formulas([f for f in all_f if f.get("workspace_id") != workspace_id])


def batch_save_subscriptions(
    workspace_id: str,
    preset_id: str,
    items: list[dict[str, Any]],
    delete_ids: list[str],
) -> None:
    """Upsert multiple subscriptions and delete removed ones in one pass."""
    all_subs = load_subscriptions()
    incoming_ids = {s.get("id") for s in items}
    kept = [
        s for s in all_subs
        if not (s.get("workspace_id") == workspace_id and s.get("preset_id") == preset_id)
        or s.get("id") in incoming_ids
    ]
    kept = [s for s in kept if s.get("id") not in delete_ids]
    by_id = {s.get("id"): i for i, s in enumerate(kept)}
    for item in items:
        idx = by_id.get(item.get("id"))
        if idx is not None:
            kept[idx] = item
        else:
            kept.append(item)
    save_subscriptions(kept)
