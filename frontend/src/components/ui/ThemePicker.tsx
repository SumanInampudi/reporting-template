import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Palette, Paintbrush, Save, Trash2, Loader2, Check, ChevronDown, ChevronRight, Sun, Moon } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import {
  fetchCustomThemes,
  createCustomTheme as apiCreateCustomTheme,
  updateCustomTheme as apiUpdateCustomTheme,
  deleteCustomTheme as apiDeleteCustomTheme,
} from "@/lib/api";
import type { ColorScheme, CustomThemeColors, Density, SavedCustomTheme } from "@/types/dashboard";

const COLOR_SCHEMES: { id: ColorScheme; label: string; preview: [string, string, string]; dark: boolean }[] = [
  { id: "nike",        label: "Nike Dark",   preview: ["#0a0a0a", "#1c1c1c", "#FA5400"], dark: true },
  { id: "nike-light",  label: "Nike Light",  preview: ["#faf8f5", "#ffffff", "#c4540a"], dark: false },
  { id: "dark",        label: "Dark",        preview: ["#09090b", "#18181b", "#3b82f6"], dark: true },
  { id: "light",       label: "Light",       preview: ["#f4f4f5", "#ffffff", "#2563eb"], dark: false },
  { id: "midnight",    label: "Midnight",    preview: ["#0c0f1a", "#161d35", "#818cf8"], dark: true },
  { id: "nord",        label: "Nord",        preview: ["#2e3440", "#434c5e", "#88c0d0"], dark: true },
  { id: "slate",       label: "Slate",       preview: ["#f8fafc", "#f1f5f9", "#7c3aed"], dark: false },
  { id: "minimal",     label: "Minimal",     preview: ["#fafafa", "#ffffff", "#2563eb"], dark: false },
  { id: "corporate",   label: "Corporate",   preview: ["#0f0f0f", "#212121", "#e04332"], dark: true },
];

const DENSITY_OPTIONS: { id: Density; label: string; desc: string }[] = [
  { id: "compact",     label: "Compact",     desc: "Dense layout" },
  { id: "comfortable", label: "Comfortable", desc: "Default spacing" },
  { id: "spacious",    label: "Spacious",    desc: "Relaxed layout" },
];

const DARK_DEFAULTS: CustomThemeColors = {
  bgApp: "#09090b", bgSidebar: "#111113", bgCard: "#18181b", bgCardHover: "#27272a",
  bgInput: "#09090b", border: "#27272a", borderFocus: "#3b82f6",
  textPrimary: "#fafafa", textSecondary: "#a1a1aa", textMuted: "#52525b",
  accent: "#3b82f6", accentHover: "#60a5fa", accentSubtle: "rgba(59,130,246,0.10)",
  danger: "#ef4444", success: "#22c55e", warning: "#eab308",
  radius: "8px", shadow: "0 2px 8px rgba(0,0,0,0.4)",
};

const LIGHT_DEFAULTS: CustomThemeColors = {
  bgApp: "#f4f4f5", bgSidebar: "#fafafa", bgCard: "#ffffff", bgCardHover: "#f4f4f5",
  bgInput: "#ececed", border: "#d4d4d8", borderFocus: "#2563eb",
  textPrimary: "#18181b", textSecondary: "#3f3f46", textMuted: "#71717a",
  accent: "#2563eb", accentHover: "#1d4ed8", accentSubtle: "rgba(37,99,235,0.07)",
  danger: "#dc2626", success: "#16a34a", warning: "#ca8a04",
  radius: "8px", shadow: "0 1px 6px rgba(0,0,0,0.1)",
};

interface ColorField {
  key: keyof CustomThemeColors;
  label: string;
  hint: string;
}

const CORE_FIELDS: ColorField[] = [
  { key: "bgApp",       label: "App Background",    hint: "Main page background" },
  { key: "bgSidebar",   label: "Sidebar & Header",  hint: "Side panel, top bar, status bar" },
  { key: "bgCard",      label: "Cards & Panels",     hint: "Content containers, dropdowns" },
  { key: "bgInput",     label: "Input Fields",       hint: "Text inputs, search boxes" },
  { key: "accent",      label: "Accent Color",       hint: "Buttons, links, active states" },
  { key: "textPrimary", label: "Primary Text",       hint: "Headings, main content" },
  { key: "textSecondary", label: "Secondary Text",   hint: "Descriptions, labels" },
  { key: "textMuted",   label: "Muted Text",         hint: "Hints, placeholders, disabled" },
  { key: "border",      label: "Borders",            hint: "Dividers, card edges" },
];

const ADVANCED_FIELDS: ColorField[] = [
  { key: "bgCardHover",  label: "Card Hover",      hint: "Card background on hover" },
  { key: "borderFocus",  label: "Focus Border",     hint: "Input border when focused" },
  { key: "accentHover",  label: "Accent Hover",     hint: "Buttons on hover" },
  { key: "accentSubtle", label: "Accent Subtle",    hint: "Soft accent backgrounds" },
  { key: "danger",       label: "Danger / Error",   hint: "Delete buttons, error messages" },
  { key: "success",      label: "Success",          hint: "Success indicators, checkmarks" },
  { key: "warning",      label: "Warning",          hint: "Warning badges, alerts" },
];

function isColorValue(val: string | undefined): boolean {
  if (!val) return false;
  return val.startsWith("#") || val.startsWith("rgb") || val.startsWith("hsl");
}

function MiniPreview({ colors }: { colors: CustomThemeColors }) {
  const bg = colors.bgApp;
  const sb = colors.bgSidebar;
  const card = colors.bgCard;
  const txt = colors.textPrimary;
  const txtM = colors.textMuted;
  const acc = colors.accent;
  const brd = colors.border;

  return (
    <div className="tp-preview" style={{ background: bg, borderColor: brd }}>
      <div className="tp-preview-sidebar" style={{ background: sb, borderColor: brd }}>
        <div className="tp-preview-sidebar-item" style={{ background: acc, opacity: 0.2 }} />
        <div className="tp-preview-sidebar-item" />
        <div className="tp-preview-sidebar-item" />
      </div>
      <div className="tp-preview-main">
        <div className="tp-preview-header" style={{ background: sb, borderColor: brd }}>
          <div className="tp-preview-tab" style={{ background: acc }} />
          <div className="tp-preview-tab" style={{ background: brd }} />
        </div>
        <div className="tp-preview-body">
          <div className="tp-preview-card" style={{ background: card, borderColor: brd }}>
            <div className="tp-preview-text" style={{ background: txt, opacity: 0.7 }} />
            <div className="tp-preview-text tp-preview-text--short" style={{ background: txtM, opacity: 0.4 }} />
          </div>
          <div className="tp-preview-card" style={{ background: card, borderColor: brd }}>
            <div className="tp-preview-bar" style={{ background: acc }} />
            <div className="tp-preview-bar tp-preview-bar--sm" style={{ background: acc, opacity: 0.5 }} />
          </div>
        </div>
        <div className="tp-preview-statusbar" style={{ background: sb, borderColor: brd }} />
      </div>
    </div>
  );
}

function ColorInput({ field, value, onChange }: { field: ColorField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tp-color-field">
      <div className="tp-color-field-info">
        <span className="tp-color-field-label">{field.label}</span>
        <span className="tp-color-field-hint">{field.hint}</span>
      </div>
      <div className="tp-color-field-inputs">
        {isColorValue(value) && (
          <input
            type="color"
            value={value.startsWith("#") ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="tp-color-swatch"
          />
        )}
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="tp-color-hex"
          placeholder={field.key === "radius" ? "8px" : field.key === "shadow" ? "0 2px 8px ..." : "#000000"}
        />
      </div>
    </div>
  );
}

export default function ThemePicker() {
  const {
    themeConfig, setColorScheme, setDensity, setCustomColors,
    savedCustomThemes, setSavedCustomThemes, currentUser,
  } = useStore();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"themes" | "create">("themes");
  const [draft, setDraft] = useState<CustomThemeColors>(themeConfig.customColors ?? DARK_DEFAULTS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadThemes = useCallback(async () => {
    try {
      const themes = await fetchCustomThemes();
      setSavedCustomThemes(themes);
    } catch { /* ignore */ }
    setLoaded(true);
  }, [setSavedCustomThemes]);

  useEffect(() => {
    if (open && !loaded) loadThemes();
  }, [open, loaded, loadThemes]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView("themes");
        setEditingId(null);
        setSaveName("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const updateDraft = useCallback((key: keyof CustomThemeColors, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const applyDraft = () => setCustomColors(draft);

  const startFromBase = (base: "dark" | "light") => {
    const defaults = base === "dark" ? DARK_DEFAULTS : LIGHT_DEFAULTS;
    setDraft({ ...defaults });
    setEditingId(null);
    setView("create");
  };

  const handleSaveNew = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const owner = currentUser?.username ?? "local_user";
      const created = await apiCreateCustomTheme({ name: saveName.trim(), colors: draft, owner });
      setSavedCustomThemes([...savedCustomThemes, created]);
      setSaveName("");
      setCustomColors(draft);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleOverwrite = async (theme: SavedCustomTheme) => {
    setSaving(true);
    try {
      const updated = await apiUpdateCustomTheme(theme.id, { colors: draft });
      setSavedCustomThemes(savedCustomThemes.map((t) => (t.id === theme.id ? updated : t)));
      setEditingId(null);
      setCustomColors(draft);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteCustomTheme(id);
      setSavedCustomThemes(savedCustomThemes.filter((t) => t.id !== id));
    } catch { /* ignore */ }
  };

  const handleLoadSaved = (theme: SavedCustomTheme) => {
    setDraft(theme.colors);
    setCustomColors(theme.colors);
  };

  const startEdit = (theme: SavedCustomTheme) => {
    setDraft(theme.colors);
    setEditingId(theme.id);
    setView("create");
  };

  const darkSchemes = useMemo(() => COLOR_SCHEMES.filter((s) => s.dark), []);
  const lightSchemes = useMemo(() => COLOR_SCHEMES.filter((s) => !s.dark), []);

  return (
    <div className="theme-picker-wrap" ref={wrapRef}>
      <button className="header-btn" onClick={() => setOpen((v) => !v)} title="Theme & Display">
        <Palette size={14} />
        <span>Theme</span>
      </button>

      {open && (
        <div className="theme-picker-dropdown tp-dropdown">
          {view === "themes" ? (
            <div className="tp-themes-view">
              {/* Dark themes */}
              <div className="tp-section">
                <div className="tp-section-label"><Moon size={11} /> Dark Themes</div>
                <div className="tp-scheme-grid">
                  {darkSchemes.map((s) => (
                    <button
                      key={s.id}
                      className={`tp-scheme${themeConfig.colorScheme === s.id ? " tp-scheme--active" : ""}`}
                      onClick={() => setColorScheme(s.id)}
                    >
                      <div className="tp-scheme-colors">
                        {s.preview.map((c, i) => <span key={i} style={{ background: c }} />)}
                      </div>
                      <span className="tp-scheme-name">{s.label}</span>
                      {themeConfig.colorScheme === s.id && <Check size={10} className="tp-scheme-check" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Light themes */}
              <div className="tp-section">
                <div className="tp-section-label"><Sun size={11} /> Light Themes</div>
                <div className="tp-scheme-grid">
                  {lightSchemes.map((s) => (
                    <button
                      key={s.id}
                      className={`tp-scheme${themeConfig.colorScheme === s.id ? " tp-scheme--active" : ""}`}
                      onClick={() => setColorScheme(s.id)}
                    >
                      <div className="tp-scheme-colors">
                        {s.preview.map((c, i) => <span key={i} style={{ background: c }} />)}
                      </div>
                      <span className="tp-scheme-name">{s.label}</span>
                      {themeConfig.colorScheme === s.id && <Check size={10} className="tp-scheme-check" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved custom themes */}
              {savedCustomThemes.length > 0 && (
                <div className="tp-section">
                  <div className="tp-section-label"><Paintbrush size={11} /> My Custom Themes</div>
                  <div className="tp-saved-list">
                    {savedCustomThemes.map((t) => (
                      <div key={t.id} className="tp-saved-row">
                        <button
                          className={`tp-saved-btn${
                            themeConfig.colorScheme === "custom" &&
                            themeConfig.customColors?.accent === t.colors.accent &&
                            themeConfig.customColors?.bgApp === t.colors.bgApp
                              ? " tp-saved-btn--active" : ""
                          }`}
                          onClick={() => handleLoadSaved(t)}
                        >
                          <span className="tp-saved-preview">
                            <span style={{ background: t.colors.bgApp }} />
                            <span style={{ background: t.colors.bgSidebar }} />
                            <span style={{ background: t.colors.accent }} />
                          </span>
                          <span className="tp-saved-name">{t.name}</span>
                        </button>
                        <button className="tp-saved-action" onClick={() => startEdit(t)} title="Edit">
                          <Paintbrush size={10} />
                        </button>
                        <button className="tp-saved-action tp-saved-action--danger" onClick={() => handleDelete(t.id)} title="Delete">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Density */}
              <div className="tp-section">
                <div className="tp-section-label">Spacing</div>
                <div className="tp-density-row">
                  {DENSITY_OPTIONS.map((d) => (
                    <button
                      key={d.id}
                      className={`tp-density${themeConfig.density === d.id ? " tp-density--active" : ""}`}
                      onClick={() => setDensity(d.id)}
                    >
                      <span className="tp-density-label">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Create custom theme */}
              <div className="tp-section tp-section--create">
                <div className="tp-section-label">Create Your Own</div>
                <div className="tp-base-btns">
                  <button className="tp-base-btn" onClick={() => startFromBase("dark")}>
                    <Moon size={12} /> Start from Dark
                  </button>
                  <button className="tp-base-btn" onClick={() => startFromBase("light")}>
                    <Sun size={12} /> Start from Light
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Custom Theme Editor ── */
            <div className="tp-editor-view">
              <div className="tp-editor-header">
                <button className="tp-back-btn" onClick={() => { setView("themes"); setEditingId(null); setSaveName(""); }}>
                  &larr; Back
                </button>
                <span className="tp-editor-title">
                  {editingId ? "Edit Theme" : "Create Theme"}
                </span>
              </div>

              {/* Live preview */}
              <div className="tp-section">
                <div className="tp-section-label">Live Preview</div>
                <MiniPreview colors={draft} />
              </div>

              {/* Core colors */}
              <div className="tp-section">
                <div className="tp-section-label">Core Colors</div>
                <div className="tp-color-list">
                  {CORE_FIELDS.map((f) => (
                    <ColorInput
                      key={f.key}
                      field={f}
                      value={(draft[f.key] as string) ?? ""}
                      onChange={(v) => updateDraft(f.key, v)}
                    />
                  ))}
                </div>
              </div>

              {/* Advanced */}
              <div className="tp-section">
                <button className="tp-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Advanced Options
                  <span className="tp-advanced-hint">(hover states, status colors, radius)</span>
                </button>
                {showAdvanced && (
                  <div className="tp-color-list tp-color-list--advanced">
                    {ADVANCED_FIELDS.map((f) => (
                      <ColorInput
                        key={f.key}
                        field={f}
                        value={(draft[f.key] as string) ?? ""}
                        onChange={(v) => updateDraft(f.key, v)}
                      />
                    ))}
                    <div className="tp-color-field">
                      <div className="tp-color-field-info">
                        <span className="tp-color-field-label">Border Radius</span>
                        <span className="tp-color-field-hint">Roundness of corners (e.g. 8px, 4px, 0)</span>
                      </div>
                      <div className="tp-color-field-inputs">
                        <input
                          type="text"
                          value={draft.radius ?? "8px"}
                          onChange={(e) => updateDraft("radius", e.target.value)}
                          className="tp-color-hex"
                          placeholder="8px"
                        />
                      </div>
                    </div>
                    <div className="tp-color-field">
                      <div className="tp-color-field-info">
                        <span className="tp-color-field-label">Box Shadow</span>
                        <span className="tp-color-field-hint">Shadow depth for cards and panels</span>
                      </div>
                      <div className="tp-color-field-inputs">
                        <input
                          type="text"
                          value={draft.shadow ?? "0 2px 8px rgba(0,0,0,0.4)"}
                          onChange={(e) => updateDraft("shadow", e.target.value)}
                          className="tp-color-hex tp-color-hex--wide"
                          placeholder="0 2px 8px rgba(0,0,0,0.4)"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="tp-editor-actions">
                <button className="tp-apply-btn" onClick={applyDraft}>
                  <Check size={12} /> Apply
                </button>

                {editingId ? (
                  <button
                    className="tp-save-btn"
                    onClick={() => {
                      const t = savedCustomThemes.find((s) => s.id === editingId);
                      if (t) handleOverwrite(t);
                    }}
                    disabled={saving}
                  >
                    {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                    Update
                  </button>
                ) : (
                  <div className="tp-save-row">
                    <input
                      type="text"
                      className="tp-save-input"
                      placeholder="Theme name..."
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveNew(); }}
                    />
                    <button className="tp-save-btn" onClick={handleSaveNew} disabled={!saveName.trim() || saving}>
                      {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
