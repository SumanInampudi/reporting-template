import { useState, useRef, useEffect, useCallback } from "react";
import { Palette, Paintbrush, Save, Trash2, Loader2, Check } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import {
  fetchCustomThemes,
  createCustomTheme as apiCreateCustomTheme,
  updateCustomTheme as apiUpdateCustomTheme,
  deleteCustomTheme as apiDeleteCustomTheme,
} from "@/lib/api";
import type { ColorScheme, CustomThemeColors, Density, SavedCustomTheme } from "@/types/dashboard";

const COLOR_SCHEMES: { id: ColorScheme; label: string; preview: [string, string, string] }[] = [
  { id: "dark",       label: "Dark",       preview: ["#09090b", "#18181b", "#3b82f6"] },
  { id: "light",      label: "Light",      preview: ["#f4f4f5", "#ffffff", "#2563eb"] },
  { id: "nike",       label: "Nike",       preview: ["#0a0a0a", "#1c1c1c", "#FA5400"] },
  { id: "midnight",   label: "Midnight",   preview: ["#0c0f1a", "#161d35", "#818cf8"] },
  { id: "slate",      label: "Slate",      preview: ["#f8fafc", "#f1f5f9", "#7c3aed"] },
  { id: "minimal",    label: "Minimal",    preview: ["#fafafa", "#ffffff", "#2563eb"] },
  { id: "nord",       label: "Nord",       preview: ["#2e3440", "#434c5e", "#88c0d0"] },
  { id: "corporate",  label: "Corporate",  preview: ["#0f0f0f", "#212121", "#e04332"] },
];

const DENSITY_OPTIONS: { id: Density; label: string }[] = [
  { id: "compact",     label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious",    label: "Spacious" },
];

const DEFAULT_CUSTOM: CustomThemeColors = {
  bgApp: "#09090b",
  bgSidebar: "#111113",
  bgCard: "#18181b",
  bgInput: "#09090b",
  border: "#27272a",
  textPrimary: "#fafafa",
  textSecondary: "#a1a1aa",
  textMuted: "#52525b",
  accent: "#3b82f6",
};

const COLOR_FIELDS: { key: keyof CustomThemeColors; label: string }[] = [
  { key: "bgApp",         label: "Background" },
  { key: "bgSidebar",     label: "Sidebar" },
  { key: "bgCard",        label: "Card" },
  { key: "bgInput",       label: "Input" },
  { key: "border",        label: "Border" },
  { key: "textPrimary",   label: "Text" },
  { key: "textSecondary", label: "Text 2nd" },
  { key: "textMuted",     label: "Text muted" },
  { key: "accent",        label: "Accent" },
];

export default function ThemePicker() {
  const {
    themeConfig, setColorScheme, setDensity, setCustomColors,
    savedCustomThemes, setSavedCustomThemes, currentUser,
  } = useStore();

  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [draft, setDraft] = useState<CustomThemeColors>(themeConfig.customColors ?? DEFAULT_CUSTOM);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadThemes = useCallback(async () => {
    try {
      const themes = await fetchCustomThemes();
      setSavedCustomThemes(themes);
    } catch { /* ignore on failure */ }
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
        setShowCustom(false);
        setEditingId(null);
        setSaveName("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const applyCustom = () => {
    setCustomColors(draft);
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
    setShowCustom(true);
  };

  return (
    <div className="theme-picker-wrap" ref={wrapRef}>
      <button className="header-btn" onClick={() => setOpen((v) => !v)} title="Theme & Display">
        <Palette size={14} />
        <span>Theme</span>
      </button>

      {open && (
        <div className="theme-picker-dropdown">
          {!showCustom ? (
            <>
              <div className="theme-picker-section">
                <div className="theme-picker-label">Color Scheme</div>
                <div className="theme-picker-grid theme-picker-grid--wide">
                  {COLOR_SCHEMES.map((s) => (
                    <button
                      key={s.id}
                      className={`theme-swatch ${themeConfig.colorScheme === s.id ? "theme-swatch--active" : ""}`}
                      onClick={() => setColorScheme(s.id)}
                    >
                      <div className="theme-swatch-preview">
                        {s.preview.map((c, i) => (
                          <span key={i} style={{ background: c }} />
                        ))}
                      </div>
                      <span className="theme-swatch-name">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {savedCustomThemes.length > 0 && (
                <div className="theme-picker-section">
                  <div className="theme-picker-label">My Themes</div>
                  <div className="saved-themes-list">
                    {savedCustomThemes.map((t) => (
                      <div key={t.id} className="saved-theme-row">
                        <button
                          className={`saved-theme-btn ${
                            themeConfig.colorScheme === "custom" &&
                            themeConfig.customColors?.accent === t.colors.accent &&
                            themeConfig.customColors?.bgApp === t.colors.bgApp
                              ? "saved-theme-btn--active" : ""
                          }`}
                          onClick={() => handleLoadSaved(t)}
                        >
                          <span className="saved-theme-preview">
                            <span style={{ background: t.colors.bgApp }} />
                            <span style={{ background: t.colors.bgCard }} />
                            <span style={{ background: t.colors.accent }} />
                          </span>
                          <span className="saved-theme-name">{t.name}</span>
                        </button>
                        <button
                          className="saved-theme-edit"
                          onClick={() => startEdit(t)}
                          title="Edit theme"
                        >
                          <Paintbrush size={11} />
                        </button>
                        <button
                          className="saved-theme-delete"
                          onClick={() => handleDelete(t.id)}
                          title="Delete theme"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="theme-picker-section">
                <div className="theme-picker-label">Density</div>
                <div className="density-btns">
                  {DENSITY_OPTIONS.map((d) => (
                    <button
                      key={d.id}
                      className={`density-btn ${themeConfig.density === d.id ? "density-btn--active" : ""}`}
                      onClick={() => setDensity(d.id)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="theme-picker-section">
                <button
                  className={`custom-theme-link ${themeConfig.colorScheme === "custom" ? "custom-theme-link--active" : ""}`}
                  onClick={() => { setShowCustom(true); setEditingId(null); }}
                >
                  <Paintbrush size={12} /> Create Custom Theme
                </button>
              </div>
            </>
          ) : (
            <div className="custom-theme-editor">
              <div className="theme-picker-label">
                {editingId ? "Edit Custom Theme" : "New Custom Theme"}
              </div>
              <div className="custom-theme-grid">
                {COLOR_FIELDS.map((f) => (
                  <label key={f.key} className="custom-theme-field">
                    <span className="custom-theme-field-label">{f.label}</span>
                    <div className="custom-theme-input-wrap">
                      <input
                        type="color"
                        value={draft[f.key]}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        className="custom-theme-color"
                      />
                      <input
                        type="text"
                        value={draft[f.key]}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        className="custom-theme-hex"
                      />
                    </div>
                  </label>
                ))}
              </div>

              <div className="custom-theme-save-section">
                {editingId ? (
                  <div className="custom-theme-save-row">
                    <button
                      className="data-load-btn"
                      onClick={() => {
                        const t = savedCustomThemes.find((s) => s.id === editingId);
                        if (t) handleOverwrite(t);
                      }}
                      disabled={saving}
                    >
                      {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                      Update
                    </button>
                  </div>
                ) : (
                  <div className="custom-theme-save-row">
                    <input
                      type="text"
                      className="custom-theme-name-input"
                      placeholder="Theme name..."
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveNew(); }}
                    />
                    <button
                      className="data-load-btn"
                      onClick={handleSaveNew}
                      disabled={!saveName.trim() || saving}
                    >
                      {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="custom-theme-actions">
                <button className="colpick-btn" onClick={() => { setShowCustom(false); setEditingId(null); setSaveName(""); }}>
                  Back
                </button>
                <button className="data-load-btn" onClick={applyCustom}>
                  <Check size={12} /> Apply Preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
