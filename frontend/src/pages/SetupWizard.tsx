import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Home, FastForward, Database, AlertCircle } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useConnectionSetup } from "@/hooks/useConnectionSetup";
import { createWorkspace, updateWorkspace } from "@/lib/api";
import { startWizardTour } from "@/lib/tours";
import HelpTip from "@/components/ui/HelpTip";
import ConnectionStep from "@/components/wizard/ConnectionStep";
import AliasStep from "@/components/wizard/AliasStep";
import CapabilitiesStep from "@/components/wizard/CapabilitiesStep";
import SaveStep from "@/components/wizard/SaveStep";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SELF_SERVICE_FEATURES, DASHBOARDING_FEATURES, AI_OPTIONS } from "@/lib/wizardConfig";
import HomeNav, { useNikeLight } from "@/components/ui/HomeNav";
import { getDefaultAbbreviations, type AbbreviationEntry } from "@/lib/aliasUtils";
import type { AiInsightsOption, CascadeRule, Capability, ColumnAggregation, ColumnGroupConfig, ColumnMeta, DashboardingFeature, DatasourceMode, DimensionHierarchy, DimensionSource, FreeTextValidationRule, JoinConfig, SelfServiceFeature, Workspace } from "@/types/dashboard";

export default function SetupWizard() {
  const {
    setCurrentPage, openWorkspace, workspaces, setWorkspaces,
    editingWorkspace, clearEditing, currentUser,
  } = useStore();

  const isEditing = !!editingWorkspace;
  const [step, setStep] = useState(0);
  const nikeLight = useNikeLight();

  /* ── Step 0: Connection ────────────────────────── */
  const [sourceMode, setSourceMode] = useState<DatasourceMode>(
    editingWorkspace?.datasource?.source_mode ?? "table",
  );
  const [customQuery, setCustomQuery] = useState(
    editingWorkspace?.datasource?.custom_query ?? "",
  );
  const [queryValidated, setQueryValidated] = useState(false);
  const [customQueryColumns, setCustomQueryColumns] = useState<ColumnMeta[]>([]);

  const conn = useConnectionSetup(
    editingWorkspace?.datasource?.catalog ?? "",
    editingWorkspace?.datasource?.schema ?? "",
    editingWorkspace?.datasource?.default_table ?? "",
  );

  /* ── Step 2: Column Aliases, Aggregations & Grouping */
  const [columnAliases, setColumnAliases] = useState<Record<string, string>>({});
  const [columnTypeOverrides, setColumnTypeOverrides] = useState<Record<string, string>>({});
  const [columnAggregations, setColumnAggregations] = useState<Record<string, ColumnAggregation>>({});
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const [columnGroups, setColumnGroups] = useState<ColumnGroupConfig>({ mode: "measures_dimensions" });
  const [dimensionSources, setDimensionSources] = useState<DimensionSource[]>([]);
  const [cascadeRules, setCascadeRules] = useState<CascadeRule[]>([]);
  const [abbreviations, setAbbreviations] = useState<AbbreviationEntry[]>(() => getDefaultAbbreviations());
  const [freeTextFilterColumns, setFreeTextFilterColumns] = useState<string[]>([]);
  const [searchSelectColumns, setSearchSelectColumns] = useState<string[]>([]);
  const [singleSelectColumns, setSingleSelectColumns] = useState<string[]>([]);
  const [freeTextValidationRules, setFreeTextValidationRules] = useState<FreeTextValidationRule[]>([]);
  const [hierarchies, setHierarchies] = useState<DimensionHierarchy[]>([]);
  const [joins, setJoins] = useState<JoinConfig[]>([]);
  const [baseFilters, setBaseFilters] = useState<import("@/types/dashboard").BaseFilter[]>([]);

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

  /* ── Row Limit & Upload Limit ─────────────────── */
  const [rowLimit, setRowLimit] = useState(0);
  const [uploadLimitMb, setUploadLimitMb] = useState(2);
  const [accentColor, setAccentColor] = useState("#FA5400");

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
    if (editingWorkspace.settings?.upload_limit_mb != null) {
      setUploadLimitMb(editingWorkspace.settings.upload_limit_mb);
    }
    if (editingWorkspace.settings?.accent_color) {
      setAccentColor(editingWorkspace.settings.accent_color);
    }
    if (editingWorkspace.column_aliases) {
      setColumnAliases(editingWorkspace.column_aliases);
    }
    if (editingWorkspace.column_type_overrides) {
      setColumnTypeOverrides(editingWorkspace.column_type_overrides);
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
    if (editingWorkspace.dimension_sources) {
      setDimensionSources(editingWorkspace.dimension_sources);
    }
    if (editingWorkspace.cascade_rules) {
      setCascadeRules(editingWorkspace.cascade_rules);
    }
    if (editingWorkspace.abbreviations) {
      setAbbreviations(editingWorkspace.abbreviations);
    }
    if (editingWorkspace.free_text_filter_columns) {
      setFreeTextFilterColumns(editingWorkspace.free_text_filter_columns);
    }
    if (editingWorkspace.search_select_columns) {
      setSearchSelectColumns(editingWorkspace.search_select_columns);
    }
    if (editingWorkspace.single_select_columns) {
      setSingleSelectColumns(editingWorkspace.single_select_columns);
    }
    if (editingWorkspace.free_text_validation_rules) {
      setFreeTextValidationRules(editingWorkspace.free_text_validation_rules);
    }
    if (editingWorkspace.hierarchies) {
      setHierarchies(editingWorkspace.hierarchies);
    }
    if (editingWorkspace.joins) {
      setJoins(editingWorkspace.joins);
    }
    if (editingWorkspace.datasource?.base_filters) {
      setBaseFilters(editingWorkspace.datasource.base_filters);
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

  useEffect(() => {
    const timer = setTimeout(() => startWizardTour(), 600);
    return () => clearTimeout(timer);
  }, []);

  /* ── Validation ────────────────────────────────── */
  const canProceedStep0 = sourceMode === "query"
    ? (conn.connStatus?.ok && queryValidated && customQuery.trim().length > 0)
    : (conn.connStatus?.ok && conn.selectedCatalog && conn.selectedSchema && conn.selectedTable);

  const aiEndpointsValid =
    !selectedCaps.has("ai_insights") ||
    (selectedAiOptions.size > 0 &&
      (!selectedAiOptions.has("llm_connection") || aiEndpoints.llm_connection.trim().length > 0) &&
      (!selectedAiOptions.has("zenie_space") || aiEndpoints.zenie_space.trim().length > 0) &&
      (!selectedAiOptions.has("root_cause_analysis") || aiEndpoints.root_cause_analysis.trim().length > 0));
  const canProceedStep1 = true;
  const canProceedStep2 = selectedCaps.size > 0 && aiEndpointsValid;
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

      const orEmpty = <T,>(val: T, hasData: boolean): T | undefined =>
        isEditing ? val : (hasData ? val : undefined);

      const payload = {
        name: wsName.trim(),
        description: wsDesc.trim(),
        catalog: sourceMode === "table" ? (conn.selectedCatalog || null) : null,
        schema_name: sourceMode === "table" ? (conn.selectedSchema || null) : null,
        default_table: sourceMode === "table" ? (conn.selectedTable || null) : null,
        source_mode: sourceMode,
        custom_query: sourceMode === "query" ? customQuery : null,
        base_filters: baseFilters.filter(bf =>
          bf.mode === "query" ? !!bf.queryExpression?.trim() : bf.column && bf.values.some(v => v !== "")
        ),
        capabilities: Array.from(selectedCaps),
        features: Array.from(selectedFeatures),
        dashboard_features: selectedCaps.has("dashboarding") ? Array.from(selectedDashFeatures) : undefined,
        ai_settings: aiSettings,
        column_aliases: orEmpty(columnAliases, Object.keys(columnAliases).length > 0),
        column_type_overrides: orEmpty(columnTypeOverrides, Object.keys(columnTypeOverrides).length > 0),
        column_aggregations: orEmpty(columnAggregations, Object.keys(columnAggregations).length > 0),
        excluded_columns: orEmpty(excludedColumns, excludedColumns.length > 0),
        column_groups: orEmpty(columnGroups,
          columnGroups.mode !== "measures_dimensions"
          || (columnGroups.dimensionGroups ?? []).length > 0
          || (columnGroups.measureGroups ?? []).length > 0,
        ),
        dimension_sources: orEmpty(dimensionSources, dimensionSources.length > 0),
        cascade_rules: orEmpty(cascadeRules, cascadeRules.length > 0),
        hierarchies: orEmpty(hierarchies, hierarchies.length > 0),
        abbreviations: orEmpty(abbreviations, abbreviations.length > 0),
        free_text_filter_columns: orEmpty(freeTextFilterColumns, freeTextFilterColumns.length > 0),
        search_select_columns: orEmpty(searchSelectColumns, searchSelectColumns.length > 0),
        single_select_columns: orEmpty(singleSelectColumns, singleSelectColumns.length > 0),
        free_text_validation_rules: orEmpty(freeTextValidationRules, freeTextValidationRules.length > 0),
        joins: orEmpty(joins, joins.length > 0),
        row_limit: rowLimit,
        upload_limit_mb: selectedFeatures.has("upload_data") ? uploadLimitMb : undefined,
        accent_color: accentColor,
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
      setCurrentPage("home");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    wsName, wsDesc, conn.selectedCatalog, conn.selectedSchema, conn.selectedTable,
    sourceMode, customQuery,
    selectedCaps, selectedFeatures, selectedDashFeatures, selectedAiOptions, aiEndpoints, columnAliases, columnTypeOverrides, columnAggregations, excludedColumns, columnGroups, dimensionSources, cascadeRules, hierarchies, abbreviations, freeTextFilterColumns, searchSelectColumns, singleSelectColumns, freeTextValidationRules, joins, baseFilters,
    rowLimit, uploadLimitMb, accentColor,
    workspaces, setWorkspaces, openWorkspace, isEditing, editingWorkspace, clearEditing,
  ]);

  /* ── Unsaved changes guard ─────────────────────── */
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pendingLeaveAction = useRef<(() => void) | null>(null);

  const hasTouched = step > 0 || wsName.trim().length > 0;

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

  const steps = ["Database", "Columns", "Capabilities", "Save"];
  const stepDescriptions = [
    "Select catalog, schema, table, and optional joins",
    "Configure column aliases and aggregations",
    "Choose capabilities and features",
    "Review and save your workspace",
  ];
  const stepHelp: { title: string; desc: string; tip?: string }[] = [
    {
      title: "Data Connection",
      desc: "Pick the Unity Catalog → Schema → Table that will be the primary data source. Optionally add JOIN tables for enrichment and configure Data Scope filters to restrict rows globally (e.g. region = 'EMEA'). Users cannot override data scope filters — they're always applied.",
      tip: "You can set a row limit here too. If a query exceeds the limit, users will see a warning and need to refine their filters before data loads.",
    },
    {
      title: "Column Configuration",
      desc: "Customize how columns appear and behave: set friendly aliases (e.g. \"cust_id\" → \"Customer ID\"), override data types, exclude internal columns, define default aggregations (SUM, AVG), group related columns together, and set up cascading filters (e.g. Country → City).",
      tip: "Use the Abbreviations section to auto-shorten repetitive prefixes — e.g. replace \"SALES_\" with \"\" so \"SALES_AMOUNT\" displays as \"Amount\".",
    },
    {
      title: "Capabilities & Features",
      desc: "Toggle the main capabilities: Data Explorer (ad-hoc queries with filters and tables), Dashboard (KPI cards and interactive charts), AI Assistant (natural-language analysis). Then pick granular features like CSV download, data upload, preset sharing, and email subscriptions.",
      tip: "Start with Data Explorer + Dashboard — they're the most used. You can enable AI Assistant later without losing any data.",
    },
    {
      title: "Review & Save",
      desc: "Name your workspace, add a description, and pick an accent color that will represent this app on the home screen. The color also tints the workspace header. Review the summary below — everything here can be edited after saving.",
      tip: "Choose a distinctive color for each workspace so they're easy to tell apart on the Launchpad. You can always edit the workspace later by clicking the edit icon on its tile.",
    },
  ];
  const lastStep = steps.length - 1;

  const stepValid = [
    !!canProceedStep0,
    canProceedStep1,
    canProceedStep2,
    canSave,
  ];

  const canProceedCurrentStep =
    step === 0 ? canProceedStep0 :
    step === 1 ? canProceedStep1 :
    step === 2 ? canProceedStep2 :
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
              {editingWorkspace.datasource?.source_mode === "query" ? (
                <span className="wizard-context-meta">Custom Query</span>
              ) : editingWorkspace.datasource?.catalog ? (
                <span className="wizard-context-meta">
                  {editingWorkspace.datasource.catalog}
                  {editingWorkspace.datasource.schema ? `.${editingWorkspace.datasource.schema}` : ""}
                </span>
              ) : null}
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
            <HelpTip
              title={stepHelp[step].title}
              description={stepHelp[step].desc}
              tip={stepHelp[step].tip}
              onTour={() => startWizardTour(true)}
            />
            <div className="wizard-steps">
              {steps.map((label, i) => {
                const isDone = i < step;
                const isActive = i === step;
                const isClickable = (isEditing || isDone) && !isActive && !saving;
                const showWarning = isDone && !stepValid[i];
                return (
                  <div
                    key={label}
                    className={`wizard-step${isActive ? " wizard-step--active" : ""}${isDone ? " wizard-step--done" : ""}${isClickable ? " wizard-step--clickable" : ""}`}
                    onClick={isClickable ? () => setStep(i) : undefined}
                    title={isClickable ? `Jump to ${label}` : undefined}
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
              <ConnectionStep
                conn={conn}
                rowLimit={rowLimit}
                onRowLimitChange={setRowLimit}
                joins={joins}
                onJoinsChange={setJoins}
                baseFilters={baseFilters}
                onBaseFiltersChange={setBaseFilters}
                sourceMode={sourceMode}
                onSourceModeChange={setSourceMode}
                customQuery={customQuery}
                onCustomQueryChange={setCustomQuery}
                queryValidated={queryValidated}
                onQueryValidated={setQueryValidated}
                customQueryColumns={customQueryColumns}
                onCustomQueryColumnsChange={setCustomQueryColumns}
              />
            )}
            {step === 1 && (
              <AliasStep
                catalog={conn.selectedCatalog}
                schema={conn.selectedSchema}
                table={conn.selectedTable}
                sourceMode={sourceMode}
                customQueryColumns={customQueryColumns}
                aliases={columnAliases}
                onAliasesChange={setColumnAliases}
                columnTypeOverrides={columnTypeOverrides}
                onColumnTypeOverridesChange={setColumnTypeOverrides}
                excludedColumns={excludedColumns}
                onExcludedColumnsChange={setExcludedColumns}
                columnGroups={columnGroups}
                onColumnGroupsChange={setColumnGroups}
                columnAggregations={columnAggregations}
                onColumnAggregationsChange={setColumnAggregations}
                dimensionSources={dimensionSources}
                onDimensionSourcesChange={setDimensionSources}
                cascadeRules={cascadeRules}
                onCascadeRulesChange={setCascadeRules}
                abbreviations={abbreviations}
                onAbbreviationsChange={setAbbreviations}
                freeTextFilterColumns={freeTextFilterColumns}
                onFreeTextFilterColumnsChange={setFreeTextFilterColumns}
                searchSelectColumns={searchSelectColumns}
                onSearchSelectColumnsChange={setSearchSelectColumns}
                singleSelectColumns={singleSelectColumns}
                onSingleSelectColumnsChange={setSingleSelectColumns}
                freeTextValidationRules={freeTextValidationRules}
                onFreeTextValidationRulesChange={setFreeTextValidationRules}
                hierarchies={hierarchies}
                onHierarchiesChange={setHierarchies}
                joins={joins}
              />
            )}
            {step === 2 && (
              <CapabilitiesStep
                selectedCaps={selectedCaps} toggleCap={toggleCap}
                selectedFeatures={selectedFeatures} toggleFeature={toggleFeature}
                selectedDashFeatures={selectedDashFeatures} toggleDashFeature={toggleDashFeature}
                selectedAiOptions={selectedAiOptions} toggleAiOption={toggleAiOption}
                aiEndpoints={aiEndpoints} setAiEndpoint={setAiEndpoint}
                uploadLimitMb={uploadLimitMb} onUploadLimitChange={setUploadLimitMb}
              />
            )}
            {step === 3 && (
              <SaveStep
                isEditing={isEditing}
                wsName={wsName} setWsName={setWsName}
                wsDesc={wsDesc} setWsDesc={setWsDesc}
                accentColor={accentColor} setAccentColor={setAccentColor}
                rowLimit={rowLimit}
                selectedCatalog={conn.selectedCatalog}
                selectedSchema={conn.selectedSchema}
                selectedTable={conn.selectedTable}
                sourceMode={sourceMode}
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
            {step >= 1 && step < lastStep && canProceedStep0 && (
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
                  : <><Check size={14} /> {isEditing ? "Update Workspace" : "Save Workspace"}</>
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
