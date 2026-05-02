import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Save, BookOpen, Loader2, Shield } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { createPreset, fetchPresets, runQuery, updatePreset } from "@/lib/api";
import { buildLoadSql, buildCountSql } from "@/lib/sqlBuilder";
import { buildPresetSql } from "@/lib/presetSqlHelper";
import PresetSaveDialog from "./PresetSaveDialog";
import PresetListPanel from "./PresetListPanel";
import type { Preset } from "@/types/dashboard";

export default function PresetBar() {
  const {
    activeWorkspace, presets, setPresets, activePresetId, setActivePresetId,
    captureSnapshot, loadSnapshot, currentUser,
  } = useStore();

  const metaReady = useStore((s) => s.metadataReady());

  const [showSave, setShowSave] = useState(false);
  const [showList, setShowList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const wsId = activeWorkspace?.id;

  const pendingPresetRef = useRef<Preset | null>(null);
  const autoLoadedRef = useRef(false);
  const presetsLoadedRef = useRef(false);

  const flash = (msg: string, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  };

  const executeDataLoad = useCallback(async () => {
    const PREVIEW_ROWS = 50;
    const s = useStore.getState();
    if (!s.metadataReady()) return;

    const fqTable = s.effectiveTableRef();
    if (!fqTable || s.selectedOutputColumns.length === 0) return;

    s.applyFilters();
    const state = useStore.getState();
    const limit = state.effectiveRowLimit();

    s.clearBaseDataset();
    s.setBaseDatasetLoading(true);

    const aggs = useStore.getState().resolvedAggregations();
    const t0 = performance.now();
    let tStep = t0;

    s.setLoadPhase("counting");
    try {
      const bf = useStore.getState().activeWorkspace?.datasource?.base_filters;
      const countSql = buildCountSql(fqTable, state.filters, state.dynamicFilters, state.selectedOutputColumns, aggs, undefined, bf);
      const countResult = await runQuery(countSql, undefined, undefined, true);
      const rowCount = Number(countResult.rows?.[0]?.[0] ?? 0);
      s.setLoadStepTiming("counting", Math.round(performance.now() - tStep));
      useStore.getState().setEstimatedRowCount(rowCount);
      if (limit > 0 && rowCount > limit) {
        useStore.getState().setBaseDatasetError(
          `Query would return ${rowCount.toLocaleString()} rows, which exceeds the limit of ${limit.toLocaleString()}. Please refine your filters.`,
        );
        return;
      }
    } catch (err) {
      useStore.getState().setBaseDatasetError(err instanceof Error ? err.message : "Row count check failed");
      return;
    }

    tStep = performance.now();
    s.setLoadPhase("fetching");
    const sfAsFc = state.sharedFormulas.map((sf) => ({
      id: sf.id, alias: sf.alias, expression: sf.expression, dataType: sf.data_type,
    }));
    const allFc = [...state.formulaColumns, ...sfAsFc];
    const bf2 = useStore.getState().activeWorkspace?.datasource?.base_filters;
    const fullSql = buildLoadSql(fqTable, state.selectedOutputColumns, allFc, state.filters, state.dynamicFilters, limit, aggs, undefined, bf2);
    try {
      const data = await runQuery(fullSql, PREVIEW_ROWS, undefined, true);
      s.setLoadStepTiming("fetching", Math.round(performance.now() - tStep));

      tStep = performance.now();
      s.setLoadPhase("rendering");
      useStore.getState().setBaseDataset(data, fullSql);
      useStore.getState().setLastQueryMs(Math.round(performance.now() - t0));

      requestAnimationFrame(() => {
        useStore.getState().setLoadStepTiming("rendering", Math.round(performance.now() - tStep));
        useStore.getState().setLoadPhase("idle");
        useStore.getState().bumpCollapseVersion();
      });
    } catch (err) {
      useStore.getState().setBaseDatasetError(err instanceof Error ? err.message : "Query failed");
    }
  }, []);

  const handleLoad = useCallback(async (preset: Preset) => {
    if (!useStore.getState().metadataReady()) {
      pendingPresetRef.current = preset;
      setActivePresetId(preset.id);
      flash(`"${preset.name}" queued — loading metadata...`);
      return;
    }

    setLoadingId(preset.id);
    try {
      loadSnapshot(preset.snapshot);
      setActivePresetId(preset.id);
      useStore.getState().setLastSavedSnapshot(preset.snapshot);
      setShowList(false);

      const warning = useStore.getState().presetWarning;
      if (warning) {
        flash(warning, 6000);
        setTimeout(() => useStore.setState({ presetWarning: null }), 6000);
      } else {
        flash(`Loaded "${preset.name}"`);
      }

      await executeDataLoad();
    } finally {
      setLoadingId(null);
    }
  }, [loadSnapshot, setActivePresetId, executeDataLoad]);

  // Fetch presets on workspace open — priority: user default > admin default > blank
  useEffect(() => {
    if (!wsId) return;
    autoLoadedRef.current = false;
    presetsLoadedRef.current = false;
    fetchPresets(wsId).then((list) => {
      setPresets(list);
      presetsLoadedRef.current = true;

      if (autoLoadedRef.current) return;

      const userDefaultId = localStorage.getItem(`default-preset-${wsId}`);
      const adminDefaultId = activeWorkspace?.default_preset_id;
      const resolvedId = userDefaultId || adminDefaultId;

      if (resolvedId) {
        const preset = list.find((p) => p.id === resolvedId);
        if (preset) {
          autoLoadedRef.current = true;
          handleLoad(preset);
        }
      }
    }).catch(() => {});
  }, [wsId, setPresets]);

  // When metadata becomes ready, process any pending preset
  useEffect(() => {
    if (!metaReady) return;
    const pending = pendingPresetRef.current;
    if (!pending) return;
    pendingPresetRef.current = null;

    (async () => {
      setLoadingId(pending.id);
      try {
        loadSnapshot(pending.snapshot);
        useStore.getState().setLastSavedSnapshot(pending.snapshot);

        const warning = useStore.getState().presetWarning;
        if (warning) {
          flash(warning, 6000);
          setTimeout(() => useStore.setState({ presetWarning: null }), 6000);
        } else {
          flash(`Loaded "${pending.name}"`);
        }
        await executeDataLoad();
      } finally {
        setLoadingId(null);
      }
    })();
  }, [metaReady, loadSnapshot, executeDataLoad]);

  const handleSave = useCallback(async (name: string, description: string, isPublic: boolean) => {
    if (!wsId) return;
    setSaving(true);
    try {
      const snapshot = captureSnapshot();
      const dataSql = buildPresetSql();
      const owner = currentUser?.username ?? "local_user";
      const created = await createPreset(wsId, { name, description, owner, is_public: isPublic, snapshot, data_sql: dataSql });
      const list = await fetchPresets(wsId);
      setPresets(list);
      setActivePresetId(created.id);
      useStore.getState().setLastSavedSnapshot(snapshot);
      setShowSave(false);
      flash(`Preset "${name}" saved`);
    } catch (err) {
      flash("Failed to save preset");
    } finally {
      setSaving(false);
    }
  }, [wsId, captureSnapshot, setPresets, setActivePresetId]);

  const handleOverwrite = useCallback(async () => {
    if (!wsId || !activePresetId) return;
    setSaving(true);
    try {
      const snapshot = captureSnapshot();
      const dataSql = buildPresetSql();
      await updatePreset(wsId, activePresetId, { snapshot, data_sql: dataSql });
      const list = await fetchPresets(wsId);
      setPresets(list);
      useStore.getState().setLastSavedSnapshot(snapshot);
      flash("Preset updated");
    } catch {
      flash("Failed to update preset");
    } finally {
      setSaving(false);
    }
  }, [wsId, activePresetId, captureSnapshot, setPresets]);

  const registerShortcut = useStore((s) => s.registerShortcut);

  const handleSaveShortcut = useCallback(() => {
    if (activePresetId) {
      handleOverwrite();
    } else {
      setShowSave(true);
    }
  }, [activePresetId, handleOverwrite]);

  useEffect(() => {
    registerShortcut("save-preset", handleSaveShortcut);
    return () => { registerShortcut("save-preset", undefined); };
  }, [handleSaveShortcut, registerShortcut]);

  const activePreset = presets.find((p) => p.id === activePresetId);
  const pendingLoad = !!pendingPresetRef.current;

  return (
    <div className={`preset-strip${!metaReady ? " preset-strip--loading" : ""}`}>
      <div className="preset-strip-tabs">
        {presets.map((p) => {
          const isAdminDefault = p.id === activeWorkspace?.default_preset_id;
          return (
            <button
              key={p.id}
              className={`preset-strip-tab${p.id === activePresetId ? " preset-strip-tab--active" : ""}${isAdminDefault ? " preset-strip-tab--ws-default" : ""}`}
              onClick={() => { if (p.id !== activePresetId) handleLoad(p); }}
              title={!metaReady ? `${p.name} (loading metadata...)` : `${p.name}${isAdminDefault ? " (workspace default)" : ""}`}
              disabled={loadingId === p.id || !metaReady}
            >
              {loadingId === p.id ? <Loader2 size={10} className="spin" /> : isAdminDefault ? <Shield size={10} /> : <Bookmark size={10} />}
              <span className="preset-strip-tab-name">{p.name}</span>
            </button>
          );
        })}
        {presets.length === 0 && (
          <span className="preset-strip-empty">No presets</span>
        )}
      </div>

      <div className="preset-strip-actions">
        {activePresetId && (
          <button className="preset-strip-btn" onClick={handleOverwrite} disabled={saving || !metaReady} title="Save (Ctrl+S)">
            {saving ? <Loader2 size={11} className="spin" /> : <Save size={11} />}
          </button>
        )}
        <button className="preset-strip-btn" onClick={() => setShowSave(true)} disabled={saving || !metaReady} title="Save As">
          <Save size={11} />
          <span className="preset-strip-btn-label">Save As</span>
        </button>
        <button className="preset-strip-btn" onClick={() => setShowList(true)} title="Manage Presets">
          <BookOpen size={11} />
        </button>
      </div>

      {toast && <div className="preset-strip-toast">{toast}</div>}

      {showSave && (
        <PresetSaveDialog
          onSave={handleSave}
          onCancel={() => setShowSave(false)}
          saving={saving}
        />
      )}

      {showList && (
        <PresetListPanel
          onClose={() => setShowList(false)}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}
