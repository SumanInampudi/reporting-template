import { useState } from "react";
import { ShieldCheck, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import type { AllowedCharsPreset, FreeTextValidationRule } from "@/types/dashboard";

interface Props {
  freeTextColumns: string[];
  rules: FreeTextValidationRule[];
  onChange: (rules: FreeTextValidationRule[]) => void;
  aliases: Record<string, string>;
}

function getRule(rules: FreeTextValidationRule[], col: string): FreeTextValidationRule {
  return rules.find((r) => r.column === col) ?? { column: col };
}

function upsertRule(rules: FreeTextValidationRule[], updated: FreeTextValidationRule): FreeTextValidationRule[] {
  const idx = rules.findIndex((r) => r.column === updated.column);
  if (idx >= 0) {
    const next = [...rules];
    next[idx] = updated;
    return next;
  }
  return [...rules, updated];
}

export function hasAnyRule(rule: FreeTextValidationRule): boolean {
  return !!(
    rule.min_length || rule.max_length || rule.exact_length ||
    rule.pattern || rule.lpad_length || rule.uppercase || rule.lowercase ||
    rule.trim || rule.strip_special || rule.deduplicate ||
    (rule.allowed_chars && rule.allowed_chars !== "any") ||
    rule.starts_with || rule.ends_with
  );
}

function testPattern(pattern: string): boolean {
  try { new RegExp(pattern); return true; } catch { return false; }
}

const ALLOWED_CHARS_OPTS: { id: AllowedCharsPreset; label: string; desc: string }[] = [
  { id: "any", label: "Any characters", desc: "No restriction" },
  { id: "digits", label: "Digits only", desc: "0-9" },
  { id: "alphanumeric", label: "Alphanumeric", desc: "A-Z, a-z, 0-9" },
  { id: "alphanumeric_dash", label: "Alphanumeric + dashes", desc: "A-Z, a-z, 0-9, -, _" },
  { id: "custom", label: "Custom regex", desc: "Define your own" },
];

export default function ValidationRulesSection({ freeTextColumns, rules, onChange, aliases }: Props) {
  const [expanded, setExpanded] = useState<string | null>(freeTextColumns[0] ?? null);

  if (freeTextColumns.length === 0) {
    return (
      <div className="vr-empty">
        <ShieldCheck size={32} strokeWidth={1.2} />
        <p>No free-text filter columns configured.</p>
        <p className="vr-empty-hint">
          Go to the <strong>Display Names</strong> tab and mark columns as "Free Text Filter" to configure validation rules here.
        </p>
      </div>
    );
  }

  const update = (col: string, patch: Partial<FreeTextValidationRule>) => {
    const current = getRule(rules, col);
    onChange(upsertRule(rules, { ...current, ...patch }));
  };

  const clearNum = (v: string) => {
    const n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? undefined : n;
  };

  return (
    <div className="vr-section">
      <p className="vr-desc">
        Configure validation and auto-transform rules for free-text filter columns.
        Rules are applied when users submit values — invalid entries are highlighted and blocked.
      </p>

      <div className="vr-list">
        {freeTextColumns.map((col) => {
          const rule = getRule(rules, col);
          const isOpen = expanded === col;
          const configured = hasAnyRule(rule);
          const alias = aliases[col] || col;
          const patternValid = !rule.pattern || testPattern(rule.pattern);

          return (
            <div key={col} className={`vr-card${configured ? " vr-card--configured" : ""}`}>
              <button
                className="vr-card-header"
                onClick={() => setExpanded(isOpen ? null : col)}
                type="button"
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="vr-card-name">{alias}</span>
                <span className="vr-card-col">{col}</span>
                {configured && <ShieldCheck size={13} className="vr-card-check" />}
                {!configured && <span className="vr-card-none">No rules</span>}
              </button>

              {isOpen && (
                <div className="vr-card-body">
                  {/* ── Auto-Transforms ── */}
                  <div className="vr-group">
                    <span className="vr-group-label">Auto-Transforms</span>
                    <div className="vr-row">
                      <label className="vr-checkbox">
                        <input
                          type="checkbox"
                          checked={!!rule.trim}
                          onChange={(e) => update(col, { trim: e.target.checked || undefined })}
                        />
                        Trim whitespace
                      </label>
                      <label className="vr-checkbox">
                        <input
                          type="checkbox"
                          checked={!!rule.strip_special}
                          onChange={(e) => update(col, { strip_special: e.target.checked || undefined })}
                        />
                        Strip special chars
                      </label>
                      <label className="vr-checkbox">
                        <input
                          type="checkbox"
                          checked={!!rule.deduplicate}
                          onChange={(e) => update(col, { deduplicate: e.target.checked || undefined })}
                        />
                        Remove duplicates
                      </label>
                    </div>
                    <div className="vr-row">
                      <label className="vr-checkbox">
                        <input
                          type="checkbox"
                          checked={!!rule.uppercase}
                          onChange={(e) => update(col, { uppercase: e.target.checked || undefined, lowercase: e.target.checked ? undefined : rule.lowercase })}
                        />
                        Force UPPERCASE
                      </label>
                      <label className="vr-checkbox">
                        <input
                          type="checkbox"
                          checked={!!rule.lowercase}
                          onChange={(e) => update(col, { lowercase: e.target.checked || undefined, uppercase: e.target.checked ? undefined : rule.uppercase })}
                        />
                        Force lowercase
                      </label>
                    </div>
                    <div className="vr-row">
                      <label className="vr-checkbox">
                        <input
                          type="checkbox"
                          checked={!!rule.lpad_length}
                          onChange={(e) => {
                            if (e.target.checked) update(col, { lpad_length: 10, lpad_char: rule.lpad_char || "0" });
                            else update(col, { lpad_length: undefined, lpad_char: undefined });
                          }}
                        />
                        Left-pad with
                      </label>
                      {!!rule.lpad_length && (
                        <>
                          <input
                            className="vr-input vr-input--xs"
                            value={rule.lpad_char ?? "0"}
                            onChange={(e) => update(col, { lpad_char: e.target.value.slice(0, 1) || "0" })}
                            maxLength={1}
                            title="Pad character"
                          />
                          <span className="vr-label-inline">to</span>
                          <input
                            type="number"
                            className="vr-input vr-input--sm"
                            value={rule.lpad_length}
                            onChange={(e) => update(col, { lpad_length: clearNum(e.target.value) ?? 10 })}
                            min={1}
                            max={50}
                            title="Target length"
                          />
                          <span className="vr-label-inline">chars</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Allowed Characters ── */}
                  <div className="vr-group">
                    <span className="vr-group-label">Allowed Characters</span>
                    <div className="vr-row vr-row--wrap">
                      {ALLOWED_CHARS_OPTS.map((opt) => (
                        <label key={opt.id} className="vr-radio" title={opt.desc}>
                          <input
                            type="radio"
                            name={`allowed-${col}`}
                            checked={(rule.allowed_chars ?? "any") === opt.id}
                            onChange={() => update(col, {
                              allowed_chars: opt.id === "any" ? undefined : opt.id,
                              allowed_chars_custom: opt.id !== "custom" ? undefined : rule.allowed_chars_custom,
                            })}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    {rule.allowed_chars === "custom" && (
                      <input
                        className="vr-input vr-input--wide"
                        value={rule.allowed_chars_custom ?? ""}
                        onChange={(e) => update(col, { allowed_chars_custom: e.target.value || undefined })}
                        placeholder="Regex character class, e.g. ^[A-Z0-9\-]+$"
                        spellCheck={false}
                      />
                    )}
                  </div>

                  {/* ── Prefix / Suffix ── */}
                  <div className="vr-group">
                    <span className="vr-group-label">Prefix / Suffix</span>
                    <div className="vr-row">
                      <label className="vr-field-label">Starts with</label>
                      <input
                        className="vr-input vr-input--md"
                        value={rule.starts_with ?? ""}
                        onChange={(e) => update(col, { starts_with: e.target.value || undefined })}
                        placeholder="e.g. PO-"
                      />
                      <label className="vr-field-label">Ends with</label>
                      <input
                        className="vr-input vr-input--md"
                        value={rule.ends_with ?? ""}
                        onChange={(e) => update(col, { ends_with: e.target.value || undefined })}
                        placeholder="e.g. -US"
                      />
                    </div>
                  </div>

                  {/* ── Length Validation ── */}
                  <div className="vr-group">
                    <span className="vr-group-label">Length Validation</span>
                    <div className="vr-row">
                      <label className="vr-field-label">Min</label>
                      <input
                        type="number"
                        className="vr-input vr-input--sm"
                        value={rule.min_length ?? ""}
                        onChange={(e) => update(col, { min_length: clearNum(e.target.value) })}
                        placeholder="—"
                        min={1}
                      />
                      <label className="vr-field-label">Max</label>
                      <input
                        type="number"
                        className="vr-input vr-input--sm"
                        value={rule.max_length ?? ""}
                        onChange={(e) => update(col, { max_length: clearNum(e.target.value) })}
                        placeholder="—"
                        min={1}
                      />
                      <label className="vr-field-label">Exact</label>
                      <input
                        type="number"
                        className="vr-input vr-input--sm"
                        value={rule.exact_length ?? ""}
                        onChange={(e) => update(col, { exact_length: clearNum(e.target.value) })}
                        placeholder="—"
                        min={1}
                      />
                    </div>
                  </div>

                  {/* ── Format Pattern ── */}
                  <div className="vr-group">
                    <span className="vr-group-label">Format Pattern (regex)</span>
                    <div className="vr-row vr-row--stack">
                      <input
                        className={`vr-input vr-input--wide${rule.pattern && !patternValid ? " vr-input--error" : ""}`}
                        value={rule.pattern ?? ""}
                        onChange={(e) => update(col, { pattern: e.target.value || undefined })}
                        placeholder="e.g. ^\d{3}-\d{2}-\d{3}$"
                        spellCheck={false}
                      />
                      {rule.pattern && !patternValid && (
                        <span className="vr-error"><AlertTriangle size={11} /> Invalid regex</span>
                      )}
                    </div>
                    <div className="vr-row">
                      <label className="vr-field-label">Display format</label>
                      <input
                        className="vr-input vr-input--wide"
                        value={rule.pattern_label ?? ""}
                        onChange={(e) => update(col, { pattern_label: e.target.value || undefined })}
                        placeholder="e.g. XXX-XX-XXX (shown to users)"
                      />
                    </div>
                  </div>

                  {/* ── Custom Error Message ── */}
                  <div className="vr-group">
                    <span className="vr-group-label">Custom Error Message</span>
                    <input
                      className="vr-input vr-input--wide"
                      value={rule.error_message ?? ""}
                      onChange={(e) => update(col, { error_message: e.target.value || undefined })}
                      placeholder="e.g. Must be 10 digits, left-padded with zeros"
                    />
                  </div>

                  {/* ── Summary ── */}
                  {configured && (
                    <div className="vr-preview">
                      <span className="vr-preview-label">Summary:</span>
                      <span className="vr-preview-text">
                        {[
                          rule.trim && "trim",
                          rule.strip_special && "strip special",
                          rule.deduplicate && "deduplicate",
                          rule.uppercase && "UPPERCASE",
                          rule.lowercase && "lowercase",
                          rule.lpad_length && `lpad '${rule.lpad_char || "0"}' → ${rule.lpad_length}`,
                          rule.allowed_chars === "digits" && "digits only",
                          rule.allowed_chars === "alphanumeric" && "alphanumeric",
                          rule.allowed_chars === "alphanumeric_dash" && "alphanumeric + dashes",
                          rule.allowed_chars === "custom" && "custom chars",
                          rule.starts_with && `starts with "${rule.starts_with}"`,
                          rule.ends_with && `ends with "${rule.ends_with}"`,
                          rule.exact_length && `exactly ${rule.exact_length} chars`,
                          !rule.exact_length && rule.min_length && `min ${rule.min_length}`,
                          !rule.exact_length && rule.max_length && `max ${rule.max_length}`,
                          rule.pattern_label && `format: ${rule.pattern_label}`,
                          rule.pattern && !rule.pattern_label && "regex pattern",
                        ].filter(Boolean).join(" → ") || "—"}
                      </span>
                    </div>
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
