import { useMemo, useState } from "react";
import {
  Plus, Trash2, Link, ArrowRight as ArrowRightIcon, ListFilter, Filter,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { CascadeRule, ColumnMeta, DimensionSource } from "@/types/dashboard";

interface CascadeOption {
  id: string;
  label: string;
  type: "column" | "dimension";
  column: string;
}

interface CascadingSectionProps {
  columns: string[];
  columnMetas: ColumnMeta[];
  aliases: Record<string, string>;
  dimensionSources: DimensionSource[];
  rules: CascadeRule[];
  onChange: (rules: CascadeRule[]) => void;
}

export default function CascadingSection({ columns, columnMetas, aliases, dimensionSources, rules, onChange }: CascadingSectionProps) {
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

  const addRule = () => {
    const id = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...rules, { id, parentId: "", parentType: "column", childId: "", childType: "column" }]);
  };

  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);

  const updateRule = (idx: number, patch: Partial<CascadeRule>) => {
    onChange(rules.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const removeRule = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx));
    setConfirmRemoveIdx(null);
  };

  const handleSelect = (idx: number, role: "parent" | "child", optionId: string) => {
    const opt = allOptions.find((o) => o.id === optionId);
    if (!opt) return;
    if (role === "parent") {
      updateRule(idx, {
        parentId: opt.type === "dimension" ? optionId.replace("dim:", "") : opt.column,
        parentType: opt.type,
      });
    } else {
      updateRule(idx, {
        childId: opt.type === "dimension" ? optionId.replace("dim:", "") : opt.column,
        childType: opt.type,
      });
    }
  };

  const getOptionId = (r: CascadeRule, role: "parent" | "child"): string => {
    const type = role === "parent" ? r.parentType : r.childType;
    const id = role === "parent" ? r.parentId : r.childId;
    if (!id) return "";
    return type === "dimension" ? `dim:${id}` : `col:${id}`;
  };

  const getLabel = (optionId: string): string => {
    const opt = allOptions.find((o) => o.id === optionId);
    return opt?.label ?? optionId;
  };

  const childDimSource = (r: CascadeRule): DimensionSource | undefined => {
    if (r.childType !== "dimension") return undefined;
    return dimensionSources.find((ds) => ds.id === r.childId);
  };

  const childNeedsLinkColumn = (r: CascadeRule): boolean => {
    const ds = childDimSource(r);
    return !!ds && (ds.sourceType === "table" || ds.sourceType === "query");
  };

  const chains = useMemo(() => {
    const adj = new Map<string, string[]>();
    for (const r of rules) {
      if (!r.parentId || !r.childId) continue;
      const pk = getOptionId(r, "parent");
      const ck = getOptionId(r, "child");
      if (!adj.has(pk)) adj.set(pk, []);
      adj.get(pk)!.push(ck);
    }
    const roots = new Set(adj.keys());
    for (const children of adj.values()) {
      for (const c of children) roots.delete(c);
    }
    const result: string[][] = [];
    for (const root of roots) {
      const chain: string[] = [root];
      let current = root;
      const visited = new Set<string>([root]);
      while (adj.has(current)) {
        const next = adj.get(current)![0];
        if (visited.has(next)) break;
        visited.add(next);
        chain.push(next);
        current = next;
      }
      if (chain.length > 1) result.push(chain);
    }
    return result;
  }, [rules, allOptions]);

  return (
    <div className="cascade-section">
      <div className="dim-info-banner">
        <Link size={14} />
        <div>
          <strong>Filter Cascading</strong> — Define parent-child relationships between filters.
          When a user selects values in a parent filter, child filter options are automatically
          narrowed down. Works with both table columns and custom dimensions.
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="dim-empty">
          <Link size={24} />
          <p>No cascade rules configured.</p>
          <p className="dim-empty-hint">
            Add rules to define how filters depend on each other.
            For example: Country → State → City.
          </p>
          <button className="dim-add-btn" onClick={addRule}>
            <Plus size={14} /> Add Cascade Rule
          </button>
        </div>
      ) : (
        <>
          {rules.map((rule, idx) => {
            const parentOpt = getOptionId(rule, "parent");
            const childOpt = getOptionId(rule, "child");
            const needsLink = childNeedsLinkColumn(rule);
            const ds = childDimSource(rule);
            return (
              <div key={rule.id} className="cascade-rule-card">
                <div className="cascade-rule-header">
                  <span className="cascade-rule-index">#{idx + 1}</span>
                  {parentOpt && childOpt ? (
                    <span className="cascade-rule-summary">
                      {getLabel(parentOpt)} <ArrowRightIcon size={12} /> {getLabel(childOpt)}
                    </span>
                  ) : (
                    <span className="cascade-rule-summary cascade-rule-summary--empty">
                      Configure parent → child
                    </span>
                  )}
                  <button className="dim-card-remove" onClick={() => setConfirmRemoveIdx(idx)} title="Remove rule">
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="cascade-rule-body">
                  <div className="cascade-rule-pair">
                    <div className="cascade-rule-field">
                      <label className="dim-label">
                        <ListFilter size={12} /> Parent Filter
                      </label>
                      <select
                        className="dim-select"
                        value={parentOpt}
                        onChange={(e) => handleSelect(idx, "parent", e.target.value)}
                      >
                        <option value="">Select parent...</option>
                        {dimensionSources.length > 0 && (
                          <optgroup label="Custom Filters">
                            {allOptions.filter((o) => o.type === "dimension").map((o) => (
                              <option key={o.id} value={o.id} disabled={o.id === childOpt}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Table Columns">
                          {allOptions.filter((o) => o.type === "column").map((o) => (
                            <option key={o.id} value={o.id} disabled={o.id === childOpt}>
                              {o.label} ({o.column})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="cascade-rule-arrow">
                      <ArrowRightIcon size={18} />
                    </div>

                    <div className="cascade-rule-field">
                      <label className="dim-label">
                        <Filter size={12} /> Child Filter
                      </label>
                      <select
                        className="dim-select"
                        value={childOpt}
                        onChange={(e) => handleSelect(idx, "child", e.target.value)}
                      >
                        <option value="">Select child...</option>
                        {dimensionSources.length > 0 && (
                          <optgroup label="Custom Filters">
                            {allOptions.filter((o) => o.type === "dimension").map((o) => (
                              <option key={o.id} value={o.id} disabled={o.id === parentOpt}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Table Columns">
                          {allOptions.filter((o) => o.type === "column").map((o) => (
                            <option key={o.id} value={o.id} disabled={o.id === parentOpt}>
                              {o.label} ({o.column})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {needsLink && ds && (
                    <div className="cascade-link-field">
                      <label className="dim-label">
                        <Link size={12} /> Link Column
                        <span className="dim-optional">
                          (column in {ds.sourceType === "table" ? "lookup table" : "query result"} that maps to parent&apos;s value)
                        </span>
                      </label>
                      <input
                        className="dim-input"
                        placeholder={`e.g. parent_${rule.parentId || "column"}`}
                        value={rule.linkColumn ?? ""}
                        onChange={(e) => updateRule(idx, { linkColumn: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button className="dim-add-btn dim-add-btn--bottom" onClick={addRule}>
            <Plus size={14} /> Add Cascade Rule
          </button>
        </>
      )}

      {chains.length > 0 && (
        <div className="cascade-preview">
          <h4 className="cascade-preview-title">
            <Link size={13} /> Cascade Chains
          </h4>
          {chains.map((chain, ci) => (
            <div key={ci} className="cascade-chain">
              {chain.map((optId, oi) => (
                <span key={optId} className="cascade-chain-item">
                  {oi > 0 && <ArrowRightIcon size={12} className="cascade-chain-arrow" />}
                  <span className={`cascade-chain-badge cascade-chain-badge--${
                    allOptions.find((o) => o.id === optId)?.type ?? "column"
                  }`}>
                    {getLabel(optId)}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {confirmRemoveIdx !== null && (
        <ConfirmDialog
          title="Remove Cascade Rule"
          message="Are you sure you want to remove this cascade rule? The parent-child filter relationship will no longer apply."
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => removeRule(confirmRemoveIdx)}
          onCancel={() => setConfirmRemoveIdx(null)}
        />
      )}
    </div>
  );
}
