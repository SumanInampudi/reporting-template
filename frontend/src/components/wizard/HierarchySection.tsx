import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  ArrowDown, ArrowUp, Layers, Link, ArrowRight, ListFilter, Filter,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { runQuery } from "@/lib/api";
import { generateCascadeRulesFromHierarchies } from "@/lib/hierarchyUtils";
import type { CascadeRule, ColumnMeta, DimensionHierarchy, DimensionSource, HierarchyLevel } from "@/types/dashboard";

interface Props {
  columns: string[];
  columnMetas: ColumnMeta[];
  aliases: Record<string, string>;
  catalog: string;
  schema: string;
  table: string;
  hierarchies: DimensionHierarchy[];
  onChange: (hierarchies: DimensionHierarchy[]) => void;
  cascadeRules?: CascadeRule[];
  onCascadeRulesChange?: (rules: CascadeRule[]) => void;
  dimensionSources?: DimensionSource[];
}

function uid(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function levelUid(): string {
  return `lv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function HierarchySection({
  columns, columnMetas, aliases, catalog, schema, table, hierarchies, onChange,
  cascadeRules, onCascadeRulesChange, dimensionSources = [],
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string[]>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const usedColumns = useMemo(() => {
    const s = new Set<string>();
    for (const h of hierarchies) {
      for (const lv of h.levels) s.add(lv.column);
    }
    return s;
  }, [hierarchies]);

  /* ── Auto-cascade generation ─────────────────── */
  const prevHierKeyRef = useRef("");

  useEffect(() => {
    if (!onCascadeRulesChange) return;
    const autoCascadeHiers = hierarchies.filter(
      (h) => h.autoCascade !== false && h.levels.length >= 2 && h.levels.every((lv) => lv.column),
    );
    const key = autoCascadeHiers
      .map((h) => h.levels.map((lv) => lv.column).join(">"))
      .sort()
      .join("|");
    if (key === prevHierKeyRef.current) return;
    prevHierKeyRef.current = key;

    if (autoCascadeHiers.length === 0) return;
    const updated = generateCascadeRulesFromHierarchies(autoCascadeHiers, cascadeRules ?? []);
    if (updated.length !== (cascadeRules ?? []).length) {
      onCascadeRulesChange(updated);
    }
  }, [hierarchies, cascadeRules, onCascadeRulesChange]);

  const addHierarchy = () => {
    const h: DimensionHierarchy = { id: uid(), name: "", levels: [], autoCascade: true };
    onChange([...hierarchies, h]);
    setExpandedId(h.id);
  };

  const removeHierarchy = (id: string) => {
    onChange(hierarchies.filter((h) => h.id !== id));
    if (expandedId === id) setExpandedId(null);
    setConfirmRemoveId(null);
  };

  const updateHierarchy = (id: string, patch: Partial<DimensionHierarchy>) => {
    onChange(hierarchies.map((h) => h.id === id ? { ...h, ...patch } : h));
  };

  const addLevel = (hId: string) => {
    const h = hierarchies.find((x) => x.id === hId);
    if (!h) return;
    const lv: HierarchyLevel = { id: levelUid(), column: "" };
    updateHierarchy(hId, { levels: [...h.levels, lv] });
  };

  const updateLevel = (hId: string, lvId: string, patch: Partial<HierarchyLevel>) => {
    const h = hierarchies.find((x) => x.id === hId);
    if (!h) return;
    updateHierarchy(hId, {
      levels: h.levels.map((lv) => lv.id === lvId ? { ...lv, ...patch } : lv),
    });
  };

  const removeLevel = (hId: string, lvId: string) => {
    const h = hierarchies.find((x) => x.id === hId);
    if (!h) return;
    updateHierarchy(hId, { levels: h.levels.filter((lv) => lv.id !== lvId) });
  };

  const moveLevel = (hId: string, lvId: string, dir: -1 | 1) => {
    const h = hierarchies.find((x) => x.id === hId);
    if (!h) return;
    const idx = h.levels.findIndex((lv) => lv.id === lvId);
    const target = idx + dir;
    if (target < 0 || target >= h.levels.length) return;
    const next = [...h.levels];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateHierarchy(hId, { levels: next });
  };

  const previewHierarchy = useCallback(async (hId: string) => {
    const h = hierarchies.find((x) => x.id === hId);
    if (!h || h.levels.length === 0 || !catalog || !schema || !table) return;

    setPreviewLoading(hId);
    try {
      const fqTable = `\`${catalog}\`.\`${schema}\`.\`${table}\``;
      const data: Record<string, string[]> = {};

      const topCol = h.levels[0].column;
      const topSql = `SELECT DISTINCT \`${topCol}\` FROM ${fqTable} WHERE \`${topCol}\` IS NOT NULL ORDER BY \`${topCol}\` LIMIT 5`;
      const topResult = await runQuery(topSql, 5);
      data[topCol] = topResult.rows.map((r) => String(r[0] ?? ""));

      if (h.levels.length > 1 && data[topCol].length > 0) {
        const firstVal = data[topCol][0];
        const nextCol = h.levels[1].column;
        const nextSql = `SELECT DISTINCT \`${nextCol}\` FROM ${fqTable} WHERE \`${topCol}\` = '${firstVal.replace(/'/g, "''")}' AND \`${nextCol}\` IS NOT NULL ORDER BY \`${nextCol}\` LIMIT 5`;
        const nextResult = await runQuery(nextSql, 5);
        data[nextCol] = nextResult.rows.map((r) => String(r[0] ?? ""));

        if (h.levels.length > 2 && data[nextCol].length > 0) {
          const secondVal = data[nextCol][0];
          const thirdCol = h.levels[2].column;
          const thirdSql = `SELECT DISTINCT \`${thirdCol}\` FROM ${fqTable} WHERE \`${topCol}\` = '${firstVal.replace(/'/g, "''")}' AND \`${nextCol}\` = '${secondVal.replace(/'/g, "''")}' AND \`${thirdCol}\` IS NOT NULL ORDER BY \`${thirdCol}\` LIMIT 5`;
          const thirdResult = await runQuery(thirdSql, 5);
          data[thirdCol] = thirdResult.rows.map((r) => String(r[0] ?? ""));
        }
      }

      setPreviewData((prev) => ({ ...prev, [hId]: [] }));
      setPreviewData((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`${hId}:${k}`, v])) }));
    } catch (err) {
      console.error("Hierarchy preview failed", err);
    } finally {
      setPreviewLoading(null);
    }
  }, [hierarchies, catalog, schema, table]);

  const colLabel = (col: string) => aliases[col] || col;

  const cascadeNote = (h: DimensionHierarchy) => {
    if (h.autoCascade === false) return null;
    const validLevels = h.levels.filter((lv) => lv.column);
    if (validLevels.length < 2) return null;
    const pairs: string[] = [];
    for (let i = 0; i < validLevels.length - 1; i++) {
      pairs.push(`${colLabel(validLevels[i].column)} → ${colLabel(validLevels[i + 1].column)}`);
    }
    return pairs;
  };

  return (
    <div className="hier-section">
      <p className="alias-step-desc">
        Define drill-down hierarchies for your dimensions. Each hierarchy is an ordered chain of columns
        from broadest to most specific (e.g., Country → Region → City).
      </p>

      <div className="hier-actions">
        <button className="hier-add-btn" onClick={addHierarchy}>
          <Plus size={13} /> Add Hierarchy
        </button>
      </div>

      {hierarchies.length === 0 && (
        <div className="hier-empty">
          <Layers size={32} strokeWidth={1} />
          <p>No hierarchies configured yet. Add one to enable drill-down in charts and pivot tables.</p>
        </div>
      )}

      <div className="hier-list">
        {hierarchies.map((h) => {
          const isOpen = expandedId === h.id;
          const cascadePairs = cascadeNote(h);
          return (
            <div key={h.id} className={`hier-card ${isOpen ? "hier-card--open" : ""}`}>
              <div className="hier-card-header" onClick={() => setExpandedId(isOpen ? null : h.id)}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <input
                  className="hier-name-input"
                  type="text"
                  placeholder="Hierarchy name (e.g., Geography)"
                  value={h.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateHierarchy(h.id, { name: e.target.value })}
                />
                <span className="hier-card-count">{h.levels.length} levels</span>
                {cascadePairs && (
                  <span className="hier-cascade-badge" title="Cascade rules auto-generated">
                    <Link size={10} /> cascading
                  </span>
                )}
                <button
                  className="hier-remove-btn"
                  onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(h.id); }}
                  title="Remove hierarchy"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {isOpen && (
                <div className="hier-card-body">
                  {h.levels.length === 0 && (
                    <div className="hier-level-empty">
                      Add levels from broadest (top) to most specific (bottom).
                    </div>
                  )}

                  {h.levels.map((lv, idx) => (
                    <div key={lv.id} className="hier-level">
                      <div className="hier-level-grip">
                        <GripVertical size={12} />
                        <span className="hier-level-num">{idx + 1}</span>
                      </div>

                      <select
                        className="hier-level-col"
                        value={lv.column}
                        onChange={(e) => updateLevel(h.id, lv.id, { column: e.target.value })}
                      >
                        <option value="">Select column...</option>
                        {columns.map((c) => (
                          <option key={c} value={c} disabled={usedColumns.has(c) && lv.column !== c}>
                            {colLabel(c)}
                          </option>
                        ))}
                      </select>

                      <input
                        className="hier-level-label"
                        type="text"
                        placeholder={lv.column ? colLabel(lv.column) : "Label"}
                        value={lv.label ?? ""}
                        onChange={(e) => updateLevel(h.id, lv.id, { label: e.target.value || undefined })}
                      />

                      <div className="hier-level-actions">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveLevel(h.id, lv.id, -1)}
                          title="Move up"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          disabled={idx === h.levels.length - 1}
                          onClick={() => moveLevel(h.id, lv.id, 1)}
                          title="Move down"
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button onClick={() => removeLevel(h.id, lv.id)} title="Remove level">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="hier-level-footer">
                    <button className="hier-add-level-btn" onClick={() => addLevel(h.id)}>
                      <Plus size={12} /> Add Level
                    </button>
                    {h.levels.length >= 2 && h.levels.every((lv) => lv.column) && (
                      <button
                        className="hier-preview-btn"
                        onClick={() => previewHierarchy(h.id)}
                        disabled={previewLoading === h.id}
                      >
                        {previewLoading === h.id ? "Loading..." : "Preview"}
                      </button>
                    )}
                  </div>

                  {/* Auto-cascade opt-out */}
                  {onCascadeRulesChange && (
                    <label className="hier-auto-cascade">
                      <input
                        type="checkbox"
                        checked={h.autoCascade !== false}
                        onChange={(e) => updateHierarchy(h.id, { autoCascade: e.target.checked })}
                      />
                      Auto-generate cascade filter rules
                    </label>
                  )}

                  {/* Cascade chain note */}
                  {cascadePairs && (
                    <div className="hier-cascade-note">
                      <Link size={11} />
                      <span>Cascade rules:</span>
                      {cascadePairs.map((pair, i) => (
                        <span key={i} className="hier-cascade-pair">
                          {i > 0 && <span className="hier-cascade-sep">,</span>}
                          {pair}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tree preview */}
                  {h.levels.some((lv) => previewData[`${h.id}:${lv.column}`]) && (
                    <div className="hier-preview">
                      <div className="hier-preview-title">Sample hierarchy tree</div>
                      <div className="hier-preview-tree">
                        {h.levels.map((lv, lvIdx) => {
                          const vals = previewData[`${h.id}:${lv.column}`] ?? [];
                          if (vals.length === 0) return null;
                          return (
                            <div key={lv.id} className="hier-preview-level" style={{ paddingLeft: lvIdx * 16 }}>
                              <span className="hier-preview-label">{lv.label || colLabel(lv.column)}</span>
                              <div className="hier-preview-values">
                                {vals.map((v, vi) => (
                                  <span key={vi} className="hier-preview-val">{v}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cascade Rules Section ──────────────────── */}
      {onCascadeRulesChange && (
        <CascadeRulesInline
          columns={columns}
          aliases={aliases}
          dimensionSources={dimensionSources}
          rules={cascadeRules ?? []}
          hierarchies={hierarchies}
          onChange={onCascadeRulesChange}
        />
      )}

      {confirmRemoveId && (
        <ConfirmDialog
          title="Remove Hierarchy"
          message="Are you sure you want to remove this hierarchy? This cannot be undone."
          onConfirm={() => removeHierarchy(confirmRemoveId)}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}
    </div>
  );
}

/* ── Inline Cascade Rules ───────────────────────── */

interface CascadeOption {
  id: string;
  label: string;
  type: "column" | "dimension";
  column: string;
}

function CascadeRulesInline({
  columns, aliases, dimensionSources, rules, hierarchies, onChange,
}: {
  columns: string[];
  aliases: Record<string, string>;
  dimensionSources: DimensionSource[];
  rules: CascadeRule[];
  hierarchies: DimensionHierarchy[];
  onChange: (rules: CascadeRule[]) => void;
}) {
  const [showSection, setShowSection] = useState(false);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);

  const ruleKey = (r: CascadeRule) => `${r.parentId}|${r.childId}`;

  const autoGeneratedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const h of hierarchies) {
      if (h.autoCascade === false) continue;
      for (let i = 0; i < h.levels.length - 1; i++) {
        const parent = h.levels[i];
        const child = h.levels[i + 1];
        if (parent.column && child.column) {
          keys.add(`col:${parent.column}|col:${child.column}`);
        }
      }
    }
    return keys;
  }, [hierarchies]);

  const manualRules = useMemo(
    () => rules.filter((r) => !autoGeneratedKeys.has(ruleKey(r))),
    [rules, autoGeneratedKeys],
  );

  const autoRules = useMemo(
    () => rules.filter((r) => autoGeneratedKeys.has(ruleKey(r))),
    [rules, autoGeneratedKeys],
  );

  const allOptions: CascadeOption[] = useMemo(() => {
    const dimOpts: CascadeOption[] = dimensionSources.map((ds) => ({
      id: `dim:${ds.id}`,
      label: ds.label || aliases[ds.column] || ds.column,
      type: "dimension" as const,
      column: ds.column,
    }));
    const colOpts: CascadeOption[] = columns.map((c) => ({
      id: `col:${c}`,
      label: aliases[c] || c,
      type: "column" as const,
      column: c,
    }));
    return [...dimOpts, ...colOpts];
  }, [columns, dimensionSources, aliases]);

  const getOptionId = (r: CascadeRule, role: "parent" | "child"): string => {
    const id = role === "parent" ? r.parentId : r.childId;
    if (!id) return "";
    if (id.startsWith("col:") || id.startsWith("dim:")) return id;
    const type = role === "parent" ? r.parentType : r.childType;
    return type === "dimension" ? `dim:${id}` : `col:${id}`;
  };

  const getLabel = (optionId: string): string =>
    allOptions.find((o) => o.id === optionId)?.label ?? optionId;

  const addManualRule = () => {
    const id = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...rules, { id, parentId: "", parentType: "column", childId: "", childType: "column" }]);
  };

  const updateRule = (ruleId: string, patch: Partial<CascadeRule>) => {
    onChange(rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r));
  };

  const removeRule = (ruleId: string) => {
    onChange(rules.filter((r) => r.id !== ruleId));
    setConfirmRemoveIdx(null);
  };

  const handleSelect = (ruleId: string, role: "parent" | "child", optionId: string) => {
    const opt = allOptions.find((o) => o.id === optionId);
    if (!opt) return;
    if (role === "parent") {
      updateRule(ruleId, { parentId: optionId, parentType: opt.type });
    } else {
      updateRule(ruleId, { childId: optionId, childType: opt.type });
    }
  };

  const nonEmptyManualRules = manualRules.filter((r) => r.parentId || r.childId);
  const totalRules = autoRules.length + nonEmptyManualRules.length;
  const hasManual = manualRules.length > 0;
  const hasAuto = autoRules.length > 0;

  if (totalRules === 0 && hierarchies.length === 0) {
    return null;
  }

  return (
    <div className="hier-cascade-section">
      <button
        className="hier-cascade-toggle"
        onClick={() => setShowSection(!showSection)}
      >
        {showSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Link size={13} />
        <span>Cascade Rules</span>
        {totalRules > 0 && <span className="hier-cascade-count">{totalRules}</span>}
      </button>

      {showSection && (
        <div className="hier-cascade-body">
          <p className="hier-cascade-desc">
            Cascade rules define parent-child relationships between filters. When a user selects values in a parent filter, child filter options are automatically narrowed down.
          </p>

          {hasAuto && (
            <div className="hier-cascade-auto">
              <div className="hier-cascade-auto-label">
                <Link size={11} /> Auto-generated from hierarchies
              </div>
              {autoRules.map((r) => (
                <div key={r.id} className="hier-cascade-auto-rule">
                  <span>{getLabel(getOptionId(r, "parent"))}</span>
                  <ArrowRight size={12} />
                  <span>{getLabel(getOptionId(r, "child"))}</span>
                </div>
              ))}
            </div>
          )}

          {hasManual && (
            <div className="hier-cascade-manual-list">
              <div className="hier-cascade-auto-label">
                <Filter size={11} /> Additional rules
              </div>
              {manualRules.map((rule, idx) => {
                const parentOpt = getOptionId(rule, "parent");
                const childOpt = getOptionId(rule, "child");
                return (
                  <div key={rule.id} className="hier-cascade-manual-rule">
                    <select
                      className="hier-cascade-select"
                      value={parentOpt}
                      onChange={(e) => handleSelect(rule.id, "parent", e.target.value)}
                    >
                      <option value="">Parent...</option>
                      {dimensionSources.length > 0 && (
                        <optgroup label="Custom Filters">
                          {allOptions.filter((o) => o.type === "dimension").map((o) => (
                            <option key={o.id} value={o.id} disabled={o.id === childOpt}>{o.label}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Columns">
                        {allOptions.filter((o) => o.type === "column").map((o) => (
                          <option key={o.id} value={o.id} disabled={o.id === childOpt}>{o.label}</option>
                        ))}
                      </optgroup>
                    </select>

                    <ArrowRight size={14} className="hier-cascade-arrow" />

                    <select
                      className="hier-cascade-select"
                      value={childOpt}
                      onChange={(e) => handleSelect(rule.id, "child", e.target.value)}
                    >
                      <option value="">Child...</option>
                      {dimensionSources.length > 0 && (
                        <optgroup label="Custom Filters">
                          {allOptions.filter((o) => o.type === "dimension").map((o) => (
                            <option key={o.id} value={o.id} disabled={o.id === parentOpt}>{o.label}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Columns">
                        {allOptions.filter((o) => o.type === "column").map((o) => (
                          <option key={o.id} value={o.id} disabled={o.id === parentOpt}>{o.label}</option>
                        ))}
                      </optgroup>
                    </select>

                    <button
                      className="hier-cascade-remove"
                      onClick={() => setConfirmRemoveIdx(idx)}
                      title="Remove rule"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button className="hier-cascade-add" onClick={addManualRule}>
            <Plus size={12} /> Add Cascade Rule
          </button>
        </div>
      )}

      {confirmRemoveIdx !== null && (
        <ConfirmDialog
          title="Remove Cascade Rule"
          message="Are you sure you want to remove this cascade rule?"
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => {
            const rule = manualRules[confirmRemoveIdx];
            if (rule) removeRule(rule.id);
          }}
          onCancel={() => setConfirmRemoveIdx(null)}
        />
      )}
    </div>
  );
}
