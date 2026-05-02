import { CAPABILITIES, SELF_SERVICE_FEATURES, AI_OPTIONS } from "@/lib/wizardConfig";
import type { AiInsightsOption, Capability, SelfServiceFeature } from "@/types/dashboard";

const COLOR_PRESETS = [
  { label: "Orange",  hex: "#FA5400" },
  { label: "Blue",    hex: "#3b82f6" },
  { label: "Green",   hex: "#10b981" },
  { label: "Purple",  hex: "#a855f7" },
  { label: "Rose",    hex: "#f43f5e" },
  { label: "Teal",    hex: "#0891b2" },
  { label: "Amber",   hex: "#d97706" },
  { label: "Indigo",  hex: "#7c3aed" },
];

interface Props {
  isEditing: boolean;

  wsName: string;
  setWsName: (v: string) => void;
  wsDesc: string;
  setWsDesc: (v: string) => void;

  accentColor: string;
  setAccentColor: (v: string) => void;

  rowLimit: number;

  selectedCatalog: string;
  selectedSchema: string;
  selectedTable: string;
  sourceMode?: string;

  selectedCaps: Set<Capability>;
  selectedFeatures: Set<SelfServiceFeature>;
  selectedAiOptions: Set<AiInsightsOption>;
  aiEndpoints: Record<AiInsightsOption, string>;

  saveError: string;
}

export default function SaveStep({
  isEditing,
  wsName, setWsName, wsDesc, setWsDesc,
  accentColor, setAccentColor,
  rowLimit,
  selectedCatalog, selectedSchema, selectedTable, sourceMode,
  selectedCaps, selectedFeatures, selectedAiOptions, aiEndpoints,
  saveError,
}: Props) {
  return (
    <div className="wizard-section">
      <h2 className="wizard-title">{isEditing ? "Update Workspace" : "Name & Save"}</h2>
      <p className="wizard-desc">
        {isEditing
          ? "Review your changes and update the workspace."
          : "Give your workspace a name and launch it."}
      </p>

      <div className="wizard-field">
        <label className="wizard-label">Workspace Name</label>
        <input
          className="wizard-input"
          placeholder="e.g. Sales Analytics"
          value={wsName}
          onChange={(e) => setWsName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">
          Description <span className="wizard-label-opt">(optional)</span>
        </label>
        <textarea
          className="wizard-input wizard-textarea"
          placeholder="Brief description of this workspace..."
          value={wsDesc}
          onChange={(e) => setWsDesc(e.target.value)}
          rows={2}
        />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">App Color</label>
        <div className="wizard-color-picker">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`wizard-color-swatch${accentColor === c.hex ? " wizard-color-swatch--active" : ""}`}
              style={{ background: c.hex }}
              title={c.label}
              onClick={() => setAccentColor(c.hex)}
            />
          ))}
          <label className="wizard-color-custom" title="Custom color">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
            <span
              className={`wizard-color-swatch wizard-color-swatch--custom${!COLOR_PRESETS.some(c => c.hex === accentColor) ? " wizard-color-swatch--active" : ""}`}
              style={{ background: accentColor }}
            />
          </label>
        </div>
      </div>

      <div className="wizard-summary">
        <h3 className="wizard-summary-title">Summary</h3>
        <SummaryRow label="Source Mode" value={sourceMode === "query" ? "Custom Query" : "Table"} />
        {sourceMode !== "query" && (
          <>
            <SummaryRow label="Catalog" value={selectedCatalog || "—"} />
            <SummaryRow label="Schema" value={selectedSchema || "—"} />
            {selectedTable && <SummaryRow label="Default Table" value={selectedTable} />}
          </>
        )}
        <SummaryRow
          label="Max Row Limit"
          value={rowLimit > 0 ? rowLimit.toLocaleString() : "No Limit"}
        />
        <SummaryRow
          label="Capabilities"
          value={Array.from(selectedCaps).map((c) => CAPABILITIES.find((x) => x.id === c)?.label).join(", ")}
        />

        {selectedCaps.has("self_service") && selectedFeatures.size > 0 && (
          <SummaryRow
            label="Features"
            value={Array.from(selectedFeatures).map((f) => SELF_SERVICE_FEATURES.find((x) => x.id === f)?.label).join(", ")}
          />
        )}

        {selectedCaps.has("ai_insights") && selectedAiOptions.size > 0 && (
          <>
            <SummaryRow
              label="AI Options"
              value={Array.from(selectedAiOptions).map((o) => AI_OPTIONS.find((x) => x.id === o)?.label).join(", ")}
            />
            {selectedAiOptions.has("llm_connection") && aiEndpoints.llm_connection && (
              <SummaryRow label="LLM Endpoint" value={aiEndpoints.llm_connection} mono />
            )}
            {selectedAiOptions.has("zenie_space") && aiEndpoints.zenie_space && (
              <SummaryRow label="Genie Space ID" value={aiEndpoints.zenie_space} mono />
            )}
            {selectedAiOptions.has("root_cause_analysis") && aiEndpoints.root_cause_analysis && (
              <SummaryRow label="RCA Endpoint" value={aiEndpoints.root_cause_analysis} mono />
            )}
          </>
        )}
      </div>

      {saveError && <p className="wizard-error">{saveError}</p>}
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="wizard-summary-row">
      <span>{label}</span>
      <span className={mono ? "wizard-summary-mono" : undefined}>{value}</span>
    </div>
  );
}
