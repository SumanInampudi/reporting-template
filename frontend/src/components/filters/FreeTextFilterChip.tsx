import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Type, HelpCircle, CaseSensitive, AlertTriangle } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import { usePopover } from "./usePopover";
import FilterChipShell from "./FilterChipShell";
import type { FilterItem, FreeTextValidationRule } from "@/types/dashboard";

interface Props {
  filter: FilterItem;
}

function parseEntries(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function transformValue(val: string, rule: FreeTextValidationRule | undefined): string {
  if (!rule) return val;
  let v = val;
  if (rule.trim) v = v.trim();
  if (rule.strip_special) v = v.replace(/[^\w\s\-]/g, "");
  if (rule.uppercase) v = v.toUpperCase();
  else if (rule.lowercase) v = v.toLowerCase();
  if (rule.lpad_length && v.length < rule.lpad_length) {
    v = v.padStart(rule.lpad_length, rule.lpad_char || "0");
  }
  return v;
}

const ALLOWED_CHARS_REGEX: Record<string, RegExp> = {
  digits: /^[0-9]+$/,
  alphanumeric: /^[A-Za-z0-9]+$/,
  alphanumeric_dash: /^[A-Za-z0-9\-_]+$/,
};

function validateValue(val: string, rule: FreeTextValidationRule | undefined): string | null {
  if (!rule) return null;
  if (val.includes("*")) return null;

  if (rule.allowed_chars && rule.allowed_chars !== "any") {
    if (rule.allowed_chars === "custom" && rule.allowed_chars_custom) {
      try {
        if (!new RegExp(rule.allowed_chars_custom).test(val)) {
          return rule.error_message ?? "Contains invalid characters";
        }
      } catch { /* skip bad regex */ }
    } else {
      const re = ALLOWED_CHARS_REGEX[rule.allowed_chars];
      if (re && !re.test(val)) {
        const label = rule.allowed_chars === "digits" ? "digits (0-9)"
          : rule.allowed_chars === "alphanumeric" ? "letters and numbers"
          : "letters, numbers, dashes, underscores";
        return rule.error_message ?? `Only ${label} allowed`;
      }
    }
  }

  if (rule.starts_with && !val.startsWith(rule.starts_with)) {
    return rule.error_message ?? `Must start with "${rule.starts_with}"`;
  }
  if (rule.ends_with && !val.endsWith(rule.ends_with)) {
    return rule.error_message ?? `Must end with "${rule.ends_with}"`;
  }

  if (rule.exact_length && val.length !== rule.exact_length) {
    return rule.error_message ?? `Must be exactly ${rule.exact_length} characters (got ${val.length})`;
  }
  if (rule.min_length && val.length < rule.min_length) {
    return rule.error_message ?? `Minimum ${rule.min_length} characters (got ${val.length})`;
  }
  if (rule.max_length && val.length > rule.max_length) {
    return rule.error_message ?? `Maximum ${rule.max_length} characters (got ${val.length})`;
  }

  if (rule.pattern) {
    try {
      if (!new RegExp(rule.pattern).test(val)) {
        return rule.error_message ?? `Must match format${rule.pattern_label ? `: ${rule.pattern_label}` : ""}`;
      }
    } catch { /* skip invalid regex */ }
  }
  return null;
}

export default function FreeTextFilterChip({ filter }: Props) {
  const { removeFilter, setFilterFreeText, activeWorkspace } = useStore();
  const alias = useColumnAlias();
  const columnLabel = alias(filter.column);
  const { open, setOpen, chipRef, popoverRef, getPosition, portalTarget } = usePopover(380, 420);

  const rule = useMemo(() => {
    const rules = activeWorkspace?.free_text_validation_rules ?? [];
    return rules.find((r) => r.column === filter.column);
  }, [activeWorkspace, filter.column]);

  const [localText, setLocalText] = useState("");
  const [localCaseSensitive, setLocalCaseSensitive] = useState(filter.freeTextCaseSensitive ?? false);
  const [showHelp, setShowHelp] = useState(false);
  const [errors, setErrors] = useState<Map<number, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      const vals = filter.freeTextValues ?? [];
      setLocalText(vals.join("\n"));
      setLocalCaseSensitive(filter.freeTextCaseSensitive ?? false);
      setErrors(new Map());
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, filter.freeTextValues, filter.freeTextCaseSensitive]);

  const handleApply = () => {
    const raw = parseEntries(localText);
    let transformed = raw.map((v) => transformValue(v, rule));

    if (rule?.deduplicate) {
      transformed = [...new Set(transformed)];
    }

    const errs = new Map<number, string>();
    transformed.forEach((v, i) => {
      const err = validateValue(v, rule);
      if (err) errs.set(i, err);
    });

    if (errs.size > 0) {
      setErrors(errs);
      setLocalText(transformed.join("\n"));
      return;
    }

    setErrors(new Map());
    setFilterFreeText(filter.id, transformed, localCaseSensitive);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalText("");
    setErrors(new Map());
    setFilterFreeText(filter.id, [], localCaseSensitive);
  };

  const entryCount = (filter.freeTextValues ?? []).length;
  const hasWildcard = (filter.freeTextValues ?? []).some((v) => v.includes("*"));
  const isActive = entryCount > 0;

  const displayLabel = entryCount === 0
    ? "Any"
    : entryCount === 1
      ? (filter.freeTextValues![0].length > 18
          ? filter.freeTextValues![0].slice(0, 16) + "…"
          : filter.freeTextValues![0])
      : `${entryCount} values`;

  const secondaryLabel = [
    hasWildcard ? "wildcard" : null,
    localCaseSensitive ? "Aa" : null,
  ].filter(Boolean).join(" · ") || undefined;

  return (
    <FilterChipShell
      ref={chipRef}
      icon={Type}
      name={columnLabel}
      label={displayLabel}
      open={open}
      variant="text"
      isActive={isActive}
      secondaryLabel={secondaryLabel}
      onToggle={() => setOpen((v) => !v)}
      onRemove={() => removeFilter(filter.id)}
    >
      {open && createPortal(
        <div className="flt-popover-portal" style={getPosition()} ref={popoverRef}>
          <div className="flt-popover flt-popover--freetext">
            {/* Header */}
            <div className="flt-popover-header">
              <span className="flt-popover-title">
                <Type size={14} /> {columnLabel}
              </span>
              <div className="ft-header-actions">
                <button
                  className={`ft-case-btn${localCaseSensitive ? " ft-case-btn--active" : ""}`}
                  onClick={() => setLocalCaseSensitive((v) => !v)}
                  title={localCaseSensitive ? "Case-sensitive (click to toggle)" : "Case-insensitive (click to toggle)"}
                >
                  <CaseSensitive size={16} />
                </button>
                <button
                  className={`ft-help-btn${showHelp ? " ft-help-btn--active" : ""}`}
                  onClick={() => setShowHelp((v) => !v)}
                  title="Wildcard help"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
            </div>

            {/* Help panel */}
            {showHelp && (
              <div className="ft-help-panel">
                <p><strong>How wildcards work:</strong></p>
                <ul>
                  <li><code>ABC*</code> — starts with "ABC"</li>
                  <li><code>*XYZ</code> — ends with "XYZ"</li>
                  <li><code>*MID*</code> — contains "MID"</li>
                  <li>No <code>*</code> — exact match</li>
                </ul>
                <p>Enter one value per line, or separate with commas.</p>
              </div>
            )}

            {/* Format hint */}
            {rule?.pattern_label && (
              <div className="ft-format-hint">
                Expected format: <strong>{rule.pattern_label}</strong>
                {rule.lpad_length ? ` · Auto-pads to ${rule.lpad_length} chars` : ""}
                {rule.uppercase ? " · Uppercased" : ""}
              </div>
            )}
            {!rule?.pattern_label && rule?.lpad_length && (
              <div className="ft-format-hint">
                Auto-pads with '{rule.lpad_char || "0"}' to {rule.lpad_length} characters
                {rule.uppercase ? " · Uppercased" : ""}
              </div>
            )}

            {/* Textarea input */}
            <div className="ft-input-area">
              <textarea
                ref={textareaRef}
                className={`ft-textarea${errors.size > 0 ? " ft-textarea--error" : ""}`}
                placeholder={rule?.pattern_label
                  ? `Enter values (format: ${rule.pattern_label})\nOne per line or comma-separated`
                  : "Enter values (one per line or comma-separated)\nUse * as wildcard, e.g. ABC* or *XYZ"}
                value={localText}
                onChange={(e) => { setLocalText(e.target.value); if (errors.size > 0) setErrors(new Map()); }}
                rows={8}
                spellCheck={false}
              />
              <span className="ft-entry-hint">
                {parseEntries(localText).length} value(s) entered
              </span>
            </div>

            {/* Validation errors */}
            {errors.size > 0 && (
              <div className="ft-errors">
                <AlertTriangle size={12} />
                <div className="ft-errors-list">
                  {Array.from(errors.entries()).slice(0, 5).map(([idx, msg]) => {
                    const vals = parseEntries(localText);
                    return (
                      <span key={idx} className="ft-error-item">
                        <strong>{vals[idx] ?? `#${idx + 1}`}</strong>: {msg}
                      </span>
                    );
                  })}
                  {errors.size > 5 && <span className="ft-error-item">…and {errors.size - 5} more</span>}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flt-popover-footer">
              <span className="flt-popover-count">
                {errors.size > 0
                  ? <span style={{ color: "var(--danger)" }}>{errors.size} invalid</span>
                  : isActive
                    ? <><strong>{entryCount}</strong> value(s) applied</>
                    : "No filter applied"}
              </span>
              <div className="flt-popover-actions">
                <button className="flt-popover-btn" onClick={handleClear}>Clear</button>
                <button
                  className="flt-popover-btn flt-popover-btn--done"
                  onClick={handleApply}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </FilterChipShell>
  );
}
