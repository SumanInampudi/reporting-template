import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Save, BookOpen, Loader2 } from "lucide-react";
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

  const [showSave, setShowSave] = useState(false);
  const [showList, setShowList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const wsId = activeWorkspace?.id;

  const autoLoadedRef = useRef(false);

  useEffect(() => {
    if (!wsId) return;
    autoLoadedRef.current = false;
    fetchPresets(wsId).then((list) => {
      setPresets(list);
      if (autoLoadedRef.current) return;
      autoLoadedRef.current = true;
      const defaultId = localStorage.getItem(`default-preset-${wsId}`);
      if (defaultId) {
        const preset = list.find((p) => p.id === defaultId);
        if (preset) handleLoad(preset);
      }
    }).catch(() => {});
  }, [wsId, setPresets]);

  const flash = (msg: string, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  };

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

  const handleLoad = useCallback(async (preset: Preset) => {
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

      const PREVIEW_ROWS = 50;
      const s = useStore.getState();
      if (!s.metadataReady()) return;

      const cat = s.selectedCatalog;
      const schema = s.selectedSchema;
      const table = s.selectedTable;
      const fqTable = cat && schema && table ? `${cat}.${schema}.${table}` : null;
      if (fqTable && s.selectedOutputColumns.length > 0) {
        s.applyFilters();
        const state = useStore.getState();
        const limit = state.effectiveRowLimit();

        s.clearBaseDataset();
        s.setBaseDatasetLoading(true);

        const aggs = useStore.getState().activeWorkspace?.column_aggregations;
        const t0 = performance.now();
        let tStep = t0;

        s.setLoadPhase("counting");
        try {
          const countSql = buildCountSql(fqTable, state.filters, state.dynamicFilters, state.selectedOutputColumns, aggs);
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
        const fullSql = buildLoadSql(fqTable, state.selectedOutputColumns, allFc, state.filters, state.dynamicFilters, limit, aggs);
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
      }
    } finally {
      setLoadingId(null);
    }
  }, [loadSnapshot, setActivePresetId]);

  const activePreset = presets.find((p) => p.id === activePresetId);

  return (
    <div className="sb-presets">
      <h3 className="sidebar-heading"><Bookmark size={14} /> Presets</h3>

      <div className="sb-presets-active">
        {activePreset ? (
          <span className="sb-presets-name" title={activePreset.name}>{activePreset.name}</span>
        ) : (
          <span className="sb-presets-none">No preset loaded</span>
        )}
      </div>

      <div className="sb-presets-actions">
        {activePresetId && (
          <button className="sb-presets-btn" onClick={handleOverwrite} disabled={saving} title="Save">
            {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
            Save
          </button>
        )}
        <button className="sb-presets-btn" onClick={() => setShowSave(true)} disabled={saving} title="Save As">
          <Save size={12} /> Save As
        </button>
        <button className="sb-presets-btn sb-presets-btn--manage" onClick={() => setShowList(true)} title="Manage Presets">
          <BookOpen size={12} /> Presets{presets.length > 0 ? ` (${presets.length})` : ""}
        </button>
      </div>

      {toast && <div className="sb-presets-toast">{toast}</div>}

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
