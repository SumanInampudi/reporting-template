import { Check, Upload } from "lucide-react";
import {
  CAPABILITIES, SELF_SERVICE_FEATURES, DASHBOARDING_FEATURES, AI_OPTIONS,
} from "@/lib/wizardConfig";
import type { AiInsightsOption, Capability, DashboardingFeature, SelfServiceFeature } from "@/types/dashboard";

interface Props {
  selectedCaps: Set<Capability>;
  toggleCap: (cap: Capability) => void;

  selectedFeatures: Set<SelfServiceFeature>;
  toggleFeature: (f: SelfServiceFeature) => void;

  selectedDashFeatures: Set<DashboardingFeature>;
  toggleDashFeature: (f: DashboardingFeature) => void;

  selectedAiOptions: Set<AiInsightsOption>;
  toggleAiOption: (opt: AiInsightsOption) => void;

  aiEndpoints: Record<AiInsightsOption, string>;
  setAiEndpoint: (opt: AiInsightsOption, value: string) => void;

  uploadLimitMb: number;
  onUploadLimitChange: (mb: number) => void;
}

export default function CapabilitiesStep({
  selectedCaps, toggleCap,
  selectedFeatures, toggleFeature,
  selectedDashFeatures, toggleDashFeature,
  selectedAiOptions, toggleAiOption,
  aiEndpoints, setAiEndpoint,
  uploadLimitMb, onUploadLimitChange,
}: Props) {
  return (
    <div className="wizard-section">
      <h2 className="wizard-title">Choose Capabilities</h2>
      <p className="wizard-desc">
        Select what features you want in this workspace. You can change this later.
      </p>

      <div className="wizard-cap-grid">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          const selected = selectedCaps.has(cap.id);
          return (
            <div
              key={cap.id}
              className={`wizard-cap-card ${selected ? "wizard-cap-card--selected" : ""} ${!cap.available ? "wizard-cap-card--disabled" : ""}`}
            >
              <div
                style={{
                  cursor: cap.available ? "pointer" : "not-allowed",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: "var(--space-2)",
                }}
                onClick={() => cap.available && toggleCap(cap.id)}
              >
                <div className="wizard-cap-icon"><Icon size={28} /></div>
                <h3 className="wizard-cap-label">{cap.label}</h3>
                <p className="wizard-cap-desc">{cap.desc}</p>
              </div>

              {!cap.available && <span className="wizard-cap-badge">Coming Soon</span>}
              {selected && <span className="wizard-cap-check"><Check size={14} /></span>}

              {/* Self-service feature toggles — always visible */}
              {cap.id === "self_service" && (
                <div className={`wizard-cap-features${!selected ? " wizard-cap-features--disabled" : ""}`} onClick={(e) => e.stopPropagation()}>
                  {SELF_SERVICE_FEATURES.map((feat) => {
                    const locked = !selected || feat.disabled;
                    const on = !locked && selectedFeatures.has(feat.id);
                    return (
                      <div key={feat.id}>
                        <div
                          className={`wizard-cap-feature ${locked ? "wizard-cap-feature--disabled" : ""}`}
                        >
                          <span className="wizard-cap-feature-label">
                            {feat.id === "upload_data" && <Upload size={12} />}
                            {feat.label}
                            {feat.disabled && <span className="wizard-coming-soon-badge">Coming Soon</span>}
                          </span>
                          <div
                            className={`toggle-switch ${on ? "toggle-switch--on" : ""} ${locked ? "toggle-switch--disabled" : ""}`}
                            onClick={() => !locked && toggleFeature(feat.id)}
                            role="switch"
                            aria-checked={on}
                          >
                            <div className="toggle-switch-knob" />
                          </div>
                        </div>
                        {feat.id === "upload_data" && on && (
                          <div className="wizard-upload-limit">
                            <label className="wizard-upload-limit-label">
                              Max file size: <strong>{uploadLimitMb} MB</strong>
                            </label>
                            <input
                              type="range"
                              className="wizard-upload-limit-slider"
                              min={1}
                              max={5}
                              step={0.5}
                              value={uploadLimitMb}
                              onChange={(e) => onUploadLimitChange(Number(e.target.value))}
                            />
                            <div className="wizard-upload-limit-range">
                              <span>1 MB</span>
                              <span>5 MB</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dashboarding feature toggles — always visible */}
              {cap.id === "dashboarding" && (
                <div className={`wizard-cap-features${!selected ? " wizard-cap-features--disabled" : ""}`} onClick={(e) => e.stopPropagation()}>
                  {DASHBOARDING_FEATURES.map((feat) => {
                    const locked = !selected || feat.disabled;
                    const on = !locked && selectedDashFeatures.has(feat.id);
                    const FeatIcon = feat.icon;
                    return (
                      <div
                        key={feat.id}
                        className={`wizard-cap-feature ${locked ? "wizard-cap-feature--disabled" : ""}`}
                      >
                        <span className="wizard-cap-feature-label">
                          <FeatIcon size={12} /> {feat.label}
                        </span>
                        <div
                          className={`toggle-switch ${on ? "toggle-switch--on" : ""} ${locked ? "toggle-switch--disabled" : ""}`}
                          onClick={() => !locked && toggleDashFeature(feat.id)}
                          role="switch"
                          aria-checked={on}
                        >
                          <div className="toggle-switch-knob" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI Insights sub-options — always visible */}
              {cap.id === "ai_insights" && (
                <div className={`wizard-ai-options${!selected ? " wizard-ai-options--disabled" : ""}`} onClick={(e) => e.stopPropagation()}>
                  {AI_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const on = selected && selectedAiOptions.has(opt.id);
                    return (
                      <div key={opt.id} className="wizard-ai-option">
                        <div className="wizard-ai-option-header">
                          <div className="wizard-ai-option-info">
                            <OptIcon size={14} />
                            <span className="wizard-ai-option-label">{opt.label}</span>
                          </div>
                          <div
                            className={`toggle-switch ${on ? "toggle-switch--on" : ""} ${!selected ? "toggle-switch--disabled" : ""}`}
                            onClick={() => selected && toggleAiOption(opt.id)}
                            role="switch"
                            aria-checked={on}
                          >
                            <div className="toggle-switch-knob" />
                          </div>
                        </div>
                        {on && (
                          <div className="wizard-ai-endpoint">
                            <label className="wizard-ai-endpoint-label">{opt.endpointLabel}</label>
                            <input
                              className="wizard-input wizard-ai-endpoint-input"
                              placeholder={opt.endpointPlaceholder}
                              value={aiEndpoints[opt.id] ?? ""}
                              onChange={(e) => setAiEndpoint(opt.id, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selected && selectedAiOptions.size === 0 && (
                    <p className="wizard-ai-hint">Select at least one AI option to proceed.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
