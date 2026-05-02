import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Home, FastForward, Database, AlertCircle } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useConnectionSetup } from "@/hooks/useConnectionSetup";
import { createWorkspace, updateWorkspace } from "@/lib/api";
import SecurityStep from "@/components/wizard/SecurityStep";
import ConnectionStep from "@/components/wizard/ConnectionStep";
import AliasStep from "@/components/wizard/AliasStep";
import CapabilitiesStep from "@/components/wizard/CapabilitiesStep";
import SaveStep from "@/components/wizard/SaveStep";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SELF_SERVICE_FEATURES, DASHBOARDING_FEATURES, AI_OPTIONS } from "@/lib/wizardConfig";
import HomeNav, { useNikeLight } from "@/components/ui/HomeNav";
import type { AiInsightsOption, Capability, ColumnAggregation, ColumnGroupConfig, DashboardingFeature, SelfServiceFeature, Workspace } from "@/types/dashboard";

export default function SetupWizard() {
  const {
    setCurrentPage, openWorkspace, workspaces, setWorkspaces,
    editingWorkspace, clearEditing, currentUser,
  } = useStore();

  const isEditing = !!editingWorkspace;
  const [step, setStep] = useState(0);
  const nikeLight = useNikeLight();

  /* ── Step 0: Security ──────────────────────────── */
  const [secretScope, setSecretScope] = useState("");
  const [secretKey, setSecretKey] = useState("sp-token");

  /* ── Step 1: Connection ────────────────────────── */
  const conn = useConnectionSetup(
    editingWorkspace?.datasource?.catalog ?? "",
    editingWorkspace?.datasource?.schema ?? "",
    editingWorkspace?.datasource?.default_table ?? "",
  );

  /* ── Step 2: Column Aliases, Aggregations & Grouping */
  const [columnAliases, setColumnAliases] = useState<Record<string, string>>({});
  const [columnAggregations, setColumnAggregations] = useState<Record<string, ColumnAggregation>>({});
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const [columnGroups, setColumnGroups] = useState<ColumnGroupConfig>({ mode: "measures_dimensions" });

  /* ── Step 3: Capabilities ──────────────────────── */
  const [selectedCaps, setSelectedCaps] = useState<Set<Capability>>(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState<Set<SelfServiceFeature>>(
    new Set(["download_data", "custom_columns"]),
  );
  const [selectedDashFeatures, setSelectedDashFeatures] = useState<Set<DashboardingFeature>>(
    new Set(["kpi_metrics", "charts"]),
  );
  const [selectedAiOptions, setSelectedAiOptions] = useState<Set<AiInsightsOption>>(new Set());
  const [aiEndpoints, setAiEndpoints] = useState<Record<AiInsightsOption, string>>({
    llm_connection: "",
    zenie_space: "",
    root_cause_analysis: "",
  });

  const toggleCap = (cap: Capability) => {
    setSelectedCaps((prev) => {
      const next = new Set(prev);
      const selecting = !next.has(cap);
      if (selecting) next.add(cap); else next.delete(cap);

      if (selecting && cap === "self_service") {
        setSelectedFeatures(new Set(
          SELF_SERVICE_FEATURES.filter((f) => !f.disabled).map((f) => f.id),
        ));
      }
      if (selecting && cap === "dashboarding") {
        setSelectedDashFeatures(new Set(
          DASHBOARDING_FEATURES.filter((f) => !f.disabled).map((f) => f.id),
        ));
      }
      if (selecting && cap === "ai_insights") {
        setSelectedAiOptions(new Set(AI_OPTIONS.map((o) => o.id)));
      }

      return next;
    });
  };

  const toggleFeature = (f: SelfServiceFeature) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const toggleDashFeature = (f: DashboardingFeature) => {
    setSelectedDashFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const toggleAiOption = (opt: AiInsightsOption) => {
    setSelectedAiOptions((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt); else next.add(opt);
      return next;
    });
  };

  const setAiEndpoint = (opt: AiInsightsOption, value: string) => {
    setAiEndpoints((prev) => ({ ...prev, [opt]: value }));
  };

  /* ── Row Limit ─────────────────────────────────── */
  const [rowLimit, setRowLimit] = useState(0);

  /* ── Step 3: Name & Save ───────────────────────── */
  const [wsName, setWsName] = useState("");
  const [wsDesc, setWsDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  /* ── Pre-fill when editing ─────────────────────── */
  useEffect(() => {
    if (!editingWorkspace) return;
    setWsName(editingWorkspace.name);
    setWsDesc(editingWorkspace.description ?? "");
    setSecretScope(editingWorkspace.secret_scope ?? "");
    setSecretKey(editingWorkspace.secret_key ?? "sp-token");
    setSelectedCaps(new Set((editingWorkspace.capabilities ?? []) as Capability[]));
    setSelectedFeatures(
      new Set((editingWorkspace.features ?? ["download_data", "custom_columns"]) as SelfServiceFeature[]),
    );
    if (editingWorkspace.dashboard_features) {
      setSelectedDashFeatures(new Set(editingWorkspace.dashboard_features));
    }
    if (editingWorkspace.settings?.row_limit != null) {
      setRowLimit(editingWorkspace.settings.row_limit);
    }
    if (editingWorkspace.column_aliases) {
      setColumnAliases(editingWorkspace.column_aliases);
    }
    if (editingWorkspace.column_aggregations) {
      setColumnAggregations(editingWorkspace.column_aggregations);
    }
    if (editingWorkspace.excluded_columns) {
      setExcludedColumns(editingWorkspace.excluded_columns);
    }
    if (editingWorkspace.column_groups) {
      setColumnGroups(editingWorkspace.column_groups);
    }
    if (editingWorkspace.ai_settings) {
      setSelectedAiOptions(new Set(editingWorkspace.ai_settings.options ?? []));
      setAiEndpoints({
        llm_connection: editingWorkspace.ai_settings.llmEndpoint ?? "",
        zenie_space: editingWorkspace.ai_settings.zenieEndpoint ?? "",
        root_cause_analysis: editingWorkspace.ai_settings.rcaEndpoint ?? "",
      });
    }
  }, [editingWorkspace]);

  /* ── Validation ────────────────────────────────── */
  const canProceedStep0 = true; // Security step — scope is optional
  const canProceedStep1 = conn.connStatus?.ok && conn.selectedCatalog && conn.selectedSchema && conn.selectedTable;

  const aiEndpointsValid =
    !selectedCaps.has("ai_insights") ||
    (selectedAiOptions.size > 0 &&
      (!selectedAiOptions.has("llm_connection") || aiEndpoints.llm_connection.trim().length > 0) &&
      (!selectedAiOptions.has("zenie_space") || aiEndpoints.zenie_space.trim().length > 0) &&
      (!selectedAiOptions.has("root_cause_analysis") || aiEndpoints.root_cause_analysis.trim().length > 0));
  const canProceedStep2 = true;
  const canProceedStep3 = selectedCaps.size > 0 && aiEndpointsValid;
  const canSave = wsName.trim().length > 0;

  /* ── Save handler (with double-click guard) ───── */
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const aiSettings = selectedCaps.has("ai_insights")
        ? {
            options: Array.from(selectedAiOptions),
            llmEndpoint: selectedAiOptions.has("llm_connection") ? aiEndpoints.llm_connection.trim() : undefined,
            zenieEndpoint: selectedAiOptions.has("zenie_space") ? aiEndpoints.zenie_space.trim() : undefined,
            rcaEndpoint: selectedAiOptions.has("root_cause_analysis") ? aiEndpoints.root_cause_analysis.trim() : undefined,
          }
        : undefined;

      const payload = {
        name: wsName.trim(),
        description: wsDesc.trim(),
        catalog: conn.selectedCatalog || null,
        schema_name: conn.selectedSchema || null,
        default_table: conn.selectedTable || null,
        capabilities: Array.from(selectedCaps),
        features: Array.from(selectedFeatures),
        dashboard_features: selectedCaps.has("dashboarding") ? Array.from(selectedDashFeatures) : undefined,
        ai_settings: aiSettings,
        column_aliases: Object.keys(columnAliases).length > 0 ? columnAliases : undefined,
        column_aggregations: Object.keys(columnAggregations).length > 0 ? columnAggregations : undefined,
        excluded_columns: excludedColumns.length > 0 ? excludedColumns : undefined,
        column_groups: columnGroups.mode !== "measures_dimensions" ? columnGroups : undefined,
        secret_scope: secretScope.trim() || null,
        secret_key: secretKey.trim() || null,
        row_limit: rowLimit,
      };

      let ws: Workspace;
      if (isEditing && editingWorkspace) {
        ws = await updateWorkspace(editingWorkspace.id, payload);
        setWorkspaces(workspaces.map((w) => w.id === ws.id ? ws : w));
      } else {
        ws = await createWorkspace(payload);
        setWorkspaces([...workspaces, ws]);
      }

      if (aiSettings) ws = { ...ws, ai_settings: aiSettings };
      clearEditing();
      openWorkspace(ws);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    wsName, wsDesc, conn.selectedCatalog, conn.selectedSchema, conn.selectedTable,
    selectedCaps, selectedFeatures, selectedDashFeatures, selectedAiOptions, aiEndpoints, columnAliases, columnAggregations, excludedColumns, columnGroups,
    secretScope, secretKey, rowLimit,
    workspaces, setWorkspaces, openWorkspace, isEditing, editingWorkspace, clearEditing,
  ]);

  /* ── Unsaved changes guard ─────────────────────── */
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pendingLeaveAction = useRef<(() => void) | null>(null);

  const hasTouched = step > 0 || wsName.trim().length > 0 || secretScope.trim().length > 0;

  const guardedNavigateHome = () => {
    if (hasTouched) {
      pendingLeaveAction.current = () => { clearEditing(); setCurrentPage("home"); };
      setShowLeaveConfirm(true);
    } else {
      clearEditing();
      setCurrentPage("home");
    }
  };

  /* ── Navigation ────────────────────────────────── */
  const handleBack = () => {
    if (step === 0) guardedNavigateHome();
    else setStep((s) => s - 1);
  };

  const steps = ["Security", "Database", "Columns", "Capabilities", "Save"];
  const stepDescriptions = [
    "Configure service-principal credentials",
    "Select catalog, schema, and table",
    "Configure column aliases and aggregations",
    "Choose capabilities and features",
    "Review and save your workspace",
  ];
  const lastStep = steps.length - 1;

  const stepValid = [
    canProceedStep0,
    !!canProceedStep1,
    canProceedStep2,
    canProceedStep3,
    canSave,
  ];

  const canProceedCurrentStep =
    step === 0 ? canProceedStep0 :
    step === 1 ? canProceedStep1 :
    step === 2 ? canProceedStep2 :
    step === 3 ? canProceedStep3 :
    true;

  /* ── Render ────────────────────────────────────── */
  const progressPct = ((step + 1) / steps.length) * 100;

  return (
    <div className="wizard-page" data-theme={nikeLight ? "nike-light" : "nike"}>
      <HomeNav
        links={[
          { label: "Workspaces", onClick: guardedNavigateHome },
          { label: "Documentation" },
          { label: "Settings", active: true },
        ]}
      />

      {/* ── Wizard content ── */}
      <div className="wizard-content">
        <div className="wizard-card">
          {/* Progress bar */}
          <div className="wizard-progress-track">
            <div className="wizard-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>

          {/* Context banner when editing */}
          {isEditing && editingWorkspace && (
            <div className="wizard-context-banner">
              <Database size={14} />
              <span className="wizard-context-name">{editingWorkspace.name}</span>
              {editingWorkspace.datasource?.catalog && (
                <span className="wizard-context-meta">
                  {editingWorkspace.datasource.catalog}
                  {editingWorkspace.datasource.schema ? `.${editingWorkspace.datasource.schema}` : ""}
                </span>
              )}
            </div>
          )}

          {/* Progress header */}
          <div className="wizard-header">
            <div className="wizard-header-left">
              <button className="wizard-back" onClick={handleBack} disabled={saving}>
                <ArrowLeft size={16} /> {step === 0 ? "Home" : "Back"}
              </button>
              {step > 0 && (
                <button className="wizard-home-link" onClick={guardedNavigateHome} disabled={saving}>
                  <Home size={14} /> Home
                </button>
              )}
            </div>
            <span className="wizard-mode-badge">
              {isEditing ? "Edit Workspace" : "New Workspace"}
            </span>
            <div className="wizard-steps">
              {steps.map((label, i) => {
                const isDone = i < step;
                const isActive = i === step;
                const isClickable = isDone && !saving;
                const showWarning = isDone && !stepValid[i];
                return (
                  <div
                    key={label}
                    className={`wizard-step${isActive ? " wizard-step--active" : ""}${isDone ? " wizard-step--done" : ""}${isClickable ? " wizard-step--clickable" : ""}`}
                    onClick={isClickable ? () => setStep(i) : undefined}
                    title={isClickable ? `Go back to ${label}` : undefined}
                  >
                    <span className="wizard-step-num">
                      {showWarning ? <AlertCircle size={12} /> : isDone ? <Check size={12} /> : i + 1}
                    </span>
                    <span className="wizard-step-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step subtitle */}
          <div className="wizard-step-subtitle">
            <span>Step {step + 1} of {steps.length}</span>
            <span className="wizard-step-subtitle-desc">{stepDescriptions[step]}</span>
          </div>

          {/* Step content */}
          <div className="wizard-body">
            {step === 0 && (
              <SecurityStep
                secretScope={secretScope}
                secretKey={secretKey}
                onScopeChange={setSecretScope}
                onKeyChange={setSecretKey}
              />
            )}
            {step === 1 && <ConnectionStep conn={conn} rowLimit={rowLimit} onRowLimitChange={setRowLimit} />}
            {step === 2 && (
              <AliasStep
                catalog={conn.selectedCatalog}
                schema={conn.selectedSchema}
                table={conn.selectedTable}
                aliases={columnAliases}
                onAliasesChange={setColumnAliases}
                excludedColumns={excludedColumns}
                onExcludedColumnsChange={setExcludedColumns}
                columnGroups={columnGroups}
                onColumnGroupsChange={setColumnGroups}
                columnAggregations={columnAggregations}
                onColumnAggregationsChange={setColumnAggregations}
              />
            )}
            {step === 3 && (
              <CapabilitiesStep
                selectedCaps={selectedCaps} toggleCap={toggleCap}
                selectedFeatures={selectedFeatures} toggleFeature={toggleFeature}
                selectedDashFeatures={selectedDashFeatures} toggleDashFeature={toggleDashFeature}
                selectedAiOptions={selectedAiOptions} toggleAiOption={toggleAiOption}
                aiEndpoints={aiEndpoints} setAiEndpoint={setAiEndpoint}
              />
            )}
            {step === 4 && (
              <SaveStep
                isEditing={isEditing}
                wsName={wsName} setWsName={setWsName}
                wsDesc={wsDesc} setWsDesc={setWsDesc}
                rowLimit={rowLimit}
                selectedCatalog={conn.selectedCatalog}
                selectedSchema={conn.selectedSchema}
                selectedTable={conn.selectedTable}
                selectedCaps={selectedCaps}
                selectedFeatures={selectedFeatures}
                selectedAiOptions={selectedAiOptions}
                aiEndpoints={aiEndpoints}
                saveError={saveError}
              />
            )}
          </div>

          {/* Footer */}
          <div className="wizard-footer">
            {step >= 1 && step < lastStep && canProceedStep1 && (
              <button
                className="wizard-skip-btn"
                onClick={() => setStep(lastStep)}
                disabled={saving}
              >
                <FastForward size={14} /> Skip to Save
              </button>
            )}
            {step < lastStep ? (
              <button
                className="wizard-next-btn"
                disabled={!canProceedCurrentStep}
                onClick={() => setStep((s) => s + 1)}
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="wizard-save-btn"
                disabled={!canSave || saving}
                onClick={handleSave}
              >
                {saving
                  ? <><Loader2 size={14} className="spin" /> Saving...</>
                  : <><Check size={14} /> {isEditing ? "Update & Launch" : "Save & Launch"}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {showLeaveConfirm && (
        <ConfirmDialog
          title="Unsaved Changes"
          message="You have unsaved changes. Are you sure you want to leave? All progress will be lost."
          confirmLabel="Leave"
          cancelLabel="Stay"
          variant="danger"
          onConfirm={() => {
            setShowLeaveConfirm(false);
            pendingLeaveAction.current?.();
            pendingLeaveAction.current = null;
          }}
          onCancel={() => {
            setShowLeaveConfirm(false);
            pendingLeaveAction.current = null;
          }}
        />
      )}
    </div>
  );
}
