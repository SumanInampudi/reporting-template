import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Loader2, RotateCcw, Search, BookOpen, X, Type, Wand2, FileText,
  Hash, Layers, ChevronDown, Eye, EyeOff, CircleCheck, Info,
  Sigma, Filter, ListFilter, Network, ShieldCheck,
} from "lucide-react";
import { fetchColumnsIn } from "@/lib/api";
import {
  generateAliases, setAbbreviations,
  type AliasStrategy, type AbbreviationEntry,
} from "@/lib/aliasUtils";
import { NUMERIC_RE } from "@/lib/constants";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AbbreviationModal from "./AbbreviationModal";
import AggregationSection from "./AggregationSection";
import DimensionSourcesSection from "./DimensionSourcesSection";
import GroupingSection from "./GroupingSection";
import HierarchySection from "./HierarchySection";
import ValidationRulesSection from "./ValidationRulesSection";
import type { CascadeRule, ColumnAggregation, ColumnGroupConfig, ColumnMeta, DimensionHierarchy, DimensionSource, FreeTextValidationRule, JoinConfig } from "@/types/dashboard";

interface Props {
  catalog: string;
  schema: string;
  table: string;
  sourceMode?: string;
  customQueryColumns?: ColumnMeta[];
  aliases: Record<string, string>;
  onAliasesChange: (aliases: Record<string, string>) => void;
  columnTypeOverrides: Record<string, string>;
  onColumnTypeOverridesChange: (overrides: Record<string, string>) => void;
  excludedColumns: string[];
  onExcludedColumnsChange: (cols: string[]) => void;
  columnGroups: ColumnGroupConfig;
  onColumnGroupsChange: (cfg: ColumnGroupConfig) => void;
  columnAggregations: Record<string, ColumnAggregation>;
  onColumnAggregationsChange: (aggs: Record<string, ColumnAggregation>) => void;
  dimensionSources: DimensionSource[];
  onDimensionSourcesChange: (sources: DimensionSource[]) => void;
  cascadeRules: CascadeRule[];
  onCascadeRulesChange: (rules: CascadeRule[]) => void;
  abbreviations: AbbreviationEntry[];
  onAbbreviationsChange: (entries: AbbreviationEntry[]) => void;
  freeTextFilterColumns: string[];
  onFreeTextFilterColumnsChange: (cols: string[]) => void;
  searchSelectColumns: string[];
  onSearchSelectColumnsChange: (cols: string[]) => void;
  singleSelectColumns: string[];
  onSingleSelectColumnsChange: (cols: string[]) => void;
  freeTextValidationRules: FreeTextValidationRule[];
  onFreeTextValidationRulesChange: (rules: FreeTextValidationRule[]) => void;
  hierarchies: DimensionHierarchy[];
  onHierarchiesChange: (h: DimensionHierarchy[]) => void;
  joins: JoinConfig[];
}

const DATA_TYPE_OPTIONS = [
  "STRING", "INT", "BIGINT", "DOUBLE", "FLOAT", "DECIMAL",
  "BOOLEAN", "DATE", "TIMESTAMP",
];

type StepTab = "aliases" | "aggregations" | "grouping" | "dimensions" | "hierarchies" | "validation";

const STRATEGY_OPTS: { id: AliasStrategy; label: string; icon: typeof Type; desc: string }[] = [
  { id: "title_case", label: "Title Case", icon: Type, desc: "Remove underscores, capitalize words" },
  { id: "pattern", label: "Smart Abbreviate", icon: Wand2, desc: "Apply abbreviation dictionary" },
  { id: "original", label: "Keep Original", icon: FileText, desc: "Use raw column names" },
];

export default function AliasStep({
  catalog, schema, table, aliases, onAliasesChange,
  columnTypeOverrides, onColumnTypeOverridesChange,
  excludedColumns, onExcludedColumnsChange,
  columnGroups, onColumnGroupsChange,
  columnAggregations, onColumnAggregationsChange,
  dimensionSources, onDimensionSourcesChange,
  cascadeRules, onCascadeRulesChange,
  abbreviations, onAbbreviationsChange,
  freeTextFilterColumns, onFreeTextFilterColumnsChange,
  searchSelectColumns, onSearchSelectColumnsChange,
  singleSelectColumns, onSingleSelectColumnsChange,
  freeTextValidationRules, onFreeTextValidationRulesChange,
  hierarchies, onHierarchiesChange,
  joins,
  sourceMode, customQueryColumns,
}: Props) {
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMetas, setColumnMetas] = useState<ColumnMeta[]>([]);
  const [partitionColumns, setPartitionColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<AliasStrategy>("title_case");
  const [search, setSearch] = useState("");
  const [showAbbrModal, setShowAbbrModal] = useState(false);
  const [activeTab, setActiveTab] = useState<StepTab>("aliases");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());

  const joinsKey = joins.map((j) => j.table).filter(Boolean).sort().join(",");

  const isCustomQueryMode = sourceMode === "query";

  useEffect(() => {
    if (isCustomQueryMode) {
      if (!customQueryColumns || customQueryColumns.length === 0) return;
      const allCols: ColumnMeta[] = customQueryColumns.map((c) => ({
        col_name: c.col_name,
        data_type: c.data_type || "STRING",
      }));
      const names = allCols.map((c) => c.col_name);
      setColumns(names);
      setColumnMetas(allCols);
      setPartitionColumns([]);
      if (Object.keys(aliases).length === 0) {
        onAliasesChange(generateAliases(names, "title_case"));
      }
      if (Object.keys(columnAggregations).length === 0) {
        const noSumRe = /pct|percent|ratio|rate|avg|average|mean/i;
        const defaultAggs: Record<string, ColumnAggregation> = {};
        for (const c of allCols) {
          if (NUMERIC_RE.test(c.data_type)) {
            defaultAggs[c.col_name] = noSumRe.test(c.col_name) ? "NONE" : "SUM";
          }
        }
        if (Object.keys(defaultAggs).length > 0) onColumnAggregationsChange(defaultAggs);
      }
      setLoading(false);
      return;
    }

    if (!catalog || !schema || !table) return;
    setLoading(true);

    const fetchAll = async () => {
      const res = await fetchColumnsIn(catalog, schema, table);
      const primaryCols = res.columns.map((c) => ({ ...c, source_table: table }));
      setPartitionColumns(res.partition_columns);

      const allCols: ColumnMeta[] = [...primaryCols];
      const validJoins = joins.filter((j) => j.table);
      for (const j of validJoins) {
        try {
          const jRes = await fetchColumnsIn(catalog, schema, j.table);
          for (const jc of jRes.columns) {
            if (!allCols.some((c) => c.col_name === jc.col_name)) {
              allCols.push({ ...jc, source_table: j.table });
            }
          }
        } catch { /* skip failed join table fetches */ }
      }

      const names = allCols.map((c) => c.col_name);
      setColumns(names);
      setColumnMetas(allCols);
      if (Object.keys(aliases).length === 0) {
        onAliasesChange(generateAliases(names, "title_case"));
      }
      if (Object.keys(columnAggregations).length === 0) {
        const noSumRe = /pct|percent|ratio|rate|avg|average|mean/i;
        const defaultAggs: Record<string, ColumnAggregation> = {};
        for (const c of allCols) {
          if (NUMERIC_RE.test(c.data_type)) {
            defaultAggs[c.col_name] = noSumRe.test(c.col_name) ? "NONE" : "SUM";
          }
        }
        if (Object.keys(defaultAggs).length > 0) onColumnAggregationsChange(defaultAggs);
      }
    };

    fetchAll().catch(() => {}).finally(() => setLoading(false));
  }, [isCustomQueryMode, customQueryColumns, catalog, schema, table, joinsKey]);

  const applyStrategy = (s: AliasStrategy) => {
    setStrategy(s);
    onAliasesChange(generateAliases(columns, s, abbreviations));
  };

  const updateAlias = (col: string, value: string) => {
    onAliasesChange({ ...aliases, [col]: value });
  };

  const resetAlias = (col: string) => {
    onAliasesChange({ ...aliases, [col]: generateAliases([col], strategy, abbreviations)[col] });
  };

  const excludedSet = new Set(excludedColumns);
  const toggleExclude = (col: string) => {
    if (excludedSet.has(col)) {
      onExcludedColumnsChange(excludedColumns.filter((c) => c !== col));
    } else {
      onExcludedColumnsChange([...excludedColumns, col]);
    }
  };

  const colMetaMap = useMemo(() => {
    const m = new Map<string, ColumnMeta>();
    for (const c of columnMetas) m.set(c.col_name, c);
    return m;
  }, [columnMetas]);

  const getOriginalType = (col: string): string => colMetaMap.get(col)?.data_type ?? "STRING";
  const getEffectiveType = (col: string): string => columnTypeOverrides[col] ?? getOriginalType(col);
  const getSourceTable = (col: string): string | undefined => colMetaMap.get(col)?.source_table;
  const hasJoinedCols = joins.some((j) => j.table);

  const handleTypeOverride = (col: string, newType: string) => {
    const original = getOriginalType(col);
    const next = { ...columnTypeOverrides };
    if (newType === original) {
      delete next[col];
    } else {
      next[col] = newType;
    }
    onColumnTypeOverridesChange(next);

    const wasNumeric = NUMERIC_RE.test(original);
    const isNowNumeric = NUMERIC_RE.test(newType);
    if (!wasNumeric && isNowNumeric && !columnAggregations[col]) {
      onColumnAggregationsChange({ ...columnAggregations, [col]: "SUM" });
    }
    if (wasNumeric && !isNowNumeric && columnAggregations[col]) {
      const nextAggs = { ...columnAggregations };
      delete nextAggs[col];
      onColumnAggregationsChange(nextAggs);
    }
  };

  const freeTextSet = useMemo(() => new Set(freeTextFilterColumns), [freeTextFilterColumns]);
  const toggleFreeText = (col: string) => {
    if (freeTextSet.has(col)) {
      onFreeTextFilterColumnsChange(freeTextFilterColumns.filter((c) => c !== col));
    } else {
      onFreeTextFilterColumnsChange([...freeTextFilterColumns, col]);
    }
  };

  const searchSelectSet = useMemo(() => new Set(searchSelectColumns), [searchSelectColumns]);
  const toggleSearchSelect = (col: string) => {
    if (searchSelectSet.has(col)) {
      onSearchSelectColumnsChange(searchSelectColumns.filter((c) => c !== col));
    } else {
      onSearchSelectColumnsChange([...searchSelectColumns, col]);
    }
  };

  const singleSelectSet = useMemo(() => new Set(singleSelectColumns), [singleSelectColumns]);
  const toggleSingleSelect = (col: string) => {
    if (singleSelectSet.has(col)) {
      onSingleSelectColumnsChange(singleSelectColumns.filter((c) => c !== col));
    } else {
      onSingleSelectColumnsChange([...singleSelectColumns, col]);
    }
  };
  const isStringType = (col: string) => {
    const t = getEffectiveType(col).toUpperCase();
    return t === "STRING" || t === "VARCHAR" || t === "CHAR" || t === "TEXT";
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return columns;
    const q = search.toLowerCase();
    return columns.filter(
      (c) =>
        c.toLowerCase().includes(q) ||
        (aliases[c] ?? "").toLowerCase().includes(q) ||
        (getSourceTable(c) ?? "").toLowerCase().includes(q),
    );
  }, [columns, search, aliases, colMetaMap]);

  const toggleSelectCol = (col: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedCols.size === filtered.length) {
      setSelectedCols(new Set());
    } else {
      setSelectedCols(new Set(filtered));
    }
  };
  const bulkHide = () => {
    const toExclude = [...selectedCols].filter((c) => !excludedSet.has(c));
    if (toExclude.length > 0) onExcludedColumnsChange([...excludedColumns, ...toExclude]);
    setSelectedCols(new Set());
  };
  const bulkShow = () => {
    onExcludedColumnsChange(excludedColumns.filter((c) => !selectedCols.has(c)));
    setSelectedCols(new Set());
  };
  const bulkSetType = (newType: string) => {
    const next = { ...columnTypeOverrides };
    const nextAggs = { ...columnAggregations };
    for (const col of selectedCols) {
      const original = getOriginalType(col);
      if (newType === original) { delete next[col]; } else { next[col] = newType; }
      const wasNumeric = NUMERIC_RE.test(original);
      const isNowNumeric = NUMERIC_RE.test(newType);
      if (!wasNumeric && isNowNumeric && !nextAggs[col]) nextAggs[col] = "SUM";
      if (wasNumeric && !isNowNumeric && nextAggs[col]) delete nextAggs[col];
    }
    onColumnTypeOverridesChange(next);
    onColumnAggregationsChange(nextAggs);
    setSelectedCols(new Set());
  };
  const bulkToggleFreeText = (enable: boolean) => {
    const stringCols = [...selectedCols].filter(isStringType);
    if (enable) {
      const toAdd = stringCols.filter((c) => !freeTextSet.has(c));
      if (toAdd.length > 0) onFreeTextFilterColumnsChange([...freeTextFilterColumns, ...toAdd]);
    } else {
      onFreeTextFilterColumnsChange(freeTextFilterColumns.filter((c) => !selectedCols.has(c)));
    }
    setSelectedCols(new Set());
  };
  const [showBulkType, setShowBulkType] = useState(false);

  if (loading) {
    return (
      <div className="alias-step-loading">
        <Loader2 size={24} className="spin" />
        <p>Loading columns from <strong>{table}</strong>...</p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="alias-step-loading">
        <p>No columns found. Please go back and select a table.</p>
      </div>
    );
  }

  const configuredRuleCount = freeTextValidationRules.filter((r) =>
    r.min_length || r.max_length || r.exact_length || r.pattern || r.lpad_length || r.uppercase || r.trim
  ).length;

  const configured: Record<StepTab, boolean> = {
    aliases: Object.keys(aliases).length > 0,
    aggregations: Object.keys(columnAggregations).length > 0,
    grouping: columnGroups.mode !== "measures_dimensions"
      || (columnGroups.dimensionGroups ?? []).length > 0
      || (columnGroups.measureGroups ?? []).length > 0,
    dimensions: dimensionSources.length > 0,
    hierarchies: hierarchies.length > 0 || cascadeRules.length > 0,
    validation: configuredRuleCount > 0,
  };

  return (
    <div className="alias-step">
      {/* ── Tab bar ── */}
      <div className="astep-tab-bar">
        <button
          className={`astep-tab${activeTab === "aliases" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("aliases")}
        >
          <Type size={14} /> Display Names
          {configured.aliases && <CircleCheck size={12} className="astep-tab-check" />}
        </button>
        <button
          className={`astep-tab${activeTab === "aggregations" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("aggregations")}
        >
          <Sigma size={14} /> Aggregations
          {configured.aggregations && <CircleCheck size={12} className="astep-tab-check" />}
        </button>
        <button
          className={`astep-tab${activeTab === "grouping" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("grouping")}
        >
          <Layers size={14} /> Grouping
          {configured.grouping && <CircleCheck size={12} className="astep-tab-check" />}
        </button>
        {freeTextFilterColumns.length > 0 && (
          <button
            className={`astep-tab${activeTab === "validation" ? " astep-tab--active" : ""}`}
            onClick={() => setActiveTab("validation")}
          >
            <ShieldCheck size={14} /> Validation
            {configured.validation
              ? <><CircleCheck size={12} className="astep-tab-check" /><span className="astep-tab-badge">{configuredRuleCount}</span></>
              : null}
          </button>
        )}
        <button
          className={`astep-tab${activeTab === "dimensions" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("dimensions")}
        >
          <Filter size={14} /> Custom Filters
          {configured.dimensions
            ? <><CircleCheck size={12} className="astep-tab-check" /><span className="astep-tab-badge">{dimensionSources.length}</span></>
            : null}
        </button>
        <button
          className={`astep-tab${activeTab === "hierarchies" ? " astep-tab--active" : ""}`}
          onClick={() => setActiveTab("hierarchies")}
        >
          <Network size={14} /> Hierarchies & Cascading
          {configured.hierarchies
            ? <><CircleCheck size={12} className="astep-tab-check" /><span className="astep-tab-badge">{hierarchies.length + cascadeRules.length}</span></>
            : null}
        </button>
      </div>

      {/* ── Display Names tab ── */}
      {activeTab === "aliases" && (
        <div className="astep-panel">
          <p className="alias-step-desc">
            Choose how column names appear in the UI. Queries always use the original names.
          </p>

          <div className="alias-strategy-bar">
            {STRATEGY_OPTS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  className={`alias-strategy-btn${strategy === opt.id ? " alias-strategy-btn--active" : ""}`}
                  onClick={() => applyStrategy(opt.id)}
                  title={opt.desc}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
            <button className="alias-abbr-btn" onClick={() => setShowAbbrModal(true)} title="Manage abbreviation dictionary">
              <BookOpen size={14} /> Dictionary
            </button>
          </div>

          <div className="alias-search-bar">
            <Search size={14} />
            <input
              className="alias-search-input"
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="alias-count">
              {excludedColumns.length > 0 && (
                <span className="alias-excluded-count">{excludedColumns.length} hidden · </span>
              )}
              {filtered.length} / {columns.length}
            </span>
          </div>

          {selectedCols.size > 0 && (
            <div className="alias-bulk-bar">
              <span className="alias-bulk-count">{selectedCols.size} selected</span>
              <button className="alias-bulk-btn" onClick={bulkHide} title="Hide selected columns">
                <EyeOff size={12} /> Hide
              </button>
              <button className="alias-bulk-btn" onClick={bulkShow} title="Show selected columns">
                <Eye size={12} /> Show
              </button>
              <div className="alias-bulk-type-wrap">
                <button className="alias-bulk-btn" onClick={() => setShowBulkType(!showBulkType)}>
                  <Hash size={12} /> Set Type <ChevronDown size={10} />
                </button>
                {showBulkType && (
                  <div className="alias-bulk-type-menu">
                    {DATA_TYPE_OPTIONS.map((t) => (
                      <button key={t} className="alias-bulk-type-opt" onClick={() => { bulkSetType(t); setShowBulkType(false); }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="alias-bulk-btn" onClick={() => bulkToggleFreeText(true)} title="Enable free-text for selected string columns">
                <ListFilter size={12} /> Free Text On
              </button>
              <button className="alias-bulk-btn" onClick={() => bulkToggleFreeText(false)} title="Disable free-text for selected">
                <ListFilter size={12} /> Free Text Off
              </button>
              <button className="alias-bulk-btn alias-bulk-btn--clear" onClick={() => setSelectedCols(new Set())}>
                <X size={12} /> Clear
              </button>
            </div>
          )}

          <div className="alias-table-wrap">
            <table className="alias-table">
              <thead>
                <tr>
                  <th className="alias-th-check">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedCols.size === filtered.length}
                      onChange={toggleSelectAll}
                      title="Select all visible"
                    />
                  </th>
                  <th className="alias-th-vis" title="Visibility — hidden columns won't appear in the workspace">
                    <Eye size={13} />
                  </th>
                  <th className="alias-th-col">Column Name</th>
                  {hasJoinedCols && <th className="alias-th-source">Source Table</th>}
                  <th className="alias-th-alias">Display Alias</th>
                  <th className="alias-th-type">Data Type</th>
                  <th className="alias-th-freetext" title="When enabled, users type or paste filter values instead of picking from a dropdown list. Only available for string columns.">
                    Free Text <span className="alias-th-help"><Info size={11} /></span>
                  </th>
                  <th className="alias-th-searchselect" title="When enabled, values are not loaded upfront. Users type to search and pick from server results. Ideal for columns with many distinct values.">
                    Search &amp; Select <span className="alias-th-help"><Info size={11} /></span>
                  </th>
                  <th className="alias-th-singleselect" title="When enabled, users can only select one value at a time in the filter dropdown. The multi-select toggle will be hidden.">
                    Single Only <span className="alias-th-help"><Info size={11} /></span>
                  </th>
                  <th className="alias-th-action" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((col) => {
                  const isExcluded = excludedSet.has(col);
                  const originalType = getOriginalType(col);
                  const effectiveType = getEffectiveType(col);
                  const isOverridden = !!columnTypeOverrides[col];
                  return (
                    <tr key={col} className={`alias-row${isExcluded ? " alias-row--excluded" : ""}${selectedCols.has(col) ? " alias-row--selected" : ""}`}>
                      <td className="alias-col-check">
                        <input
                          type="checkbox"
                          checked={selectedCols.has(col)}
                          onChange={() => toggleSelectCol(col)}
                        />
                      </td>
                      <td className="alias-col-vis">
                        <button
                          className={`alias-vis-btn${isExcluded ? " alias-vis-btn--off" : ""}`}
                          onClick={() => toggleExclude(col)}
                          title={isExcluded ? "Show this column" : "Hide this column"}
                        >
                          {isExcluded ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </td>
                      <td className="alias-col-name" title={col}><code>{col}</code></td>
                      {hasJoinedCols && (
                        <td className="alias-col-source">
                          <span className={`alias-source-badge${getSourceTable(col) !== table ? " alias-source-badge--joined" : ""}`}>
                            {getSourceTable(col) ?? table}
                          </span>
                        </td>
                      )}
                      <td className="alias-col-alias">
                        <input
                          className="alias-input"
                          value={aliases[col] ?? col}
                          onChange={(e) => updateAlias(col, e.target.value)}
                          disabled={isExcluded}
                        />
                      </td>
                      <td className="alias-col-type">
                        <select
                          className={`alias-type-select${isOverridden ? " alias-type-select--changed" : ""}`}
                          value={effectiveType.toUpperCase()}
                          onChange={(e) => handleTypeOverride(col, e.target.value)}
                          disabled={isExcluded}
                          title={isOverridden ? `Original: ${originalType}` : originalType}
                        >
                          <option value={originalType.toUpperCase()}>{originalType}</option>
                          {DATA_TYPE_OPTIONS
                            .filter((t) => t !== originalType.toUpperCase())
                            .map((t) => <option key={t} value={t}>{t}</option>)
                          }
                        </select>
                        {isOverridden && (
                          <button
                            className="alias-type-reset"
                            onClick={() => handleTypeOverride(col, originalType)}
                            title={`Reset to ${originalType}`}
                          >
                            <RotateCcw size={10} />
                          </button>
                        )}
                      </td>
                      <td className="alias-col-freetext">
                        {isStringType(col) ? (
                          <label className="alias-freetext-toggle" title="Users type/paste values instead of picking from a list">
                            <input
                              type="checkbox"
                              checked={freeTextSet.has(col)}
                              onChange={() => toggleFreeText(col)}
                              disabled={isExcluded}
                            />
                          </label>
                        ) : (
                          <span className="alias-freetext-na">—</span>
                        )}
                      </td>
                      <td className="alias-col-searchselect">
                        {isStringType(col) ? (
                          <label className="alias-searchselect-toggle" title={`Enable search & select for "${aliases[col] ?? col}" — values load on-demand as user types`}>
                            <input
                              type="checkbox"
                              checked={searchSelectSet.has(col)}
                              onChange={() => toggleSearchSelect(col)}
                              disabled={isExcluded || freeTextSet.has(col)}
                            />
                          </label>
                        ) : (
                          <span className="alias-freetext-na">—</span>
                        )}
                      </td>
                      <td className="alias-col-singleselect">
                        <label className="alias-singleselect-toggle" title={`Force single-select for "${aliases[col] ?? col}" — users won't be able to switch to multi-select`}>
                          <input
                            type="checkbox"
                            checked={singleSelectSet.has(col)}
                            onChange={() => toggleSingleSelect(col)}
                            disabled={isExcluded}
                          />
                        </label>
                      </td>
                      <td className="alias-col-action">
                        <button className="alias-reset-btn" onClick={() => resetAlias(col)} title="Reset to strategy default">
                          <RotateCcw size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aggregations tab ── */}
      {activeTab === "aggregations" && (
        <div className="astep-panel">
          <p className="alias-step-desc">
            Configure default aggregations for measure columns.
            Dimensions (non-numeric) are used in <code>GROUP BY ALL</code>.
            Measures are wrapped in the chosen aggregation (e.g. <code>SUM</code>).
          </p>
          <AggregationSection
            columnMetas={columnMetas}
            columnTypeOverrides={columnTypeOverrides}
            aliases={aliases}
            aggregations={columnAggregations}
            onChange={onColumnAggregationsChange}
            primaryTable={table}
          />
        </div>
      )}

      {/* ── Grouping tab ── */}
      {activeTab === "grouping" && (
        <div className="astep-panel">
          <p className="alias-step-desc">
            Choose how columns are organized in selectors. Default splits by data type.
          </p>
          <GroupingSection
            columnMetas={columnMetas}
            config={columnGroups}
            onChange={onColumnGroupsChange}
          />
        </div>
      )}

      {/* ── Dimensions tab ── */}
      {activeTab === "dimensions" && (
        <div className="astep-panel">
          <DimensionSourcesSection
            columns={columns}
            aliases={aliases}
            sources={dimensionSources}
            onChange={onDimensionSourcesChange}
            defaultCatalog={catalog}
            defaultSchema={schema}
            defaultTable={table}
            partitionColumns={partitionColumns}
          />
        </div>
      )}

      {activeTab === "hierarchies" && (
        <div className="astep-panel">
          <HierarchySection
            columns={columns}
            columnMetas={columnMetas}
            aliases={aliases}
            catalog={catalog}
            schema={schema}
            table={table}
            hierarchies={hierarchies}
            onChange={onHierarchiesChange}
            cascadeRules={cascadeRules}
            onCascadeRulesChange={onCascadeRulesChange}
            dimensionSources={dimensionSources}
          />
        </div>
      )}

      {activeTab === "validation" && (
        <div className="astep-panel">
          <ValidationRulesSection
            freeTextColumns={freeTextFilterColumns}
            rules={freeTextValidationRules}
            onChange={onFreeTextValidationRulesChange}
            aliases={aliases}
          />
        </div>
      )}


      {showAbbrModal && createPortal(
        <AbbreviationModal
          onClose={() => setShowAbbrModal(false)}
          initialEntries={abbreviations}
          onApply={(entries) => {
            onAbbreviationsChange(entries);
            setAbbreviations(entries);
            onAliasesChange(generateAliases(columns, strategy, entries));
            setShowAbbrModal(false);
          }}
        />,
        document.getElementById("themed-portal") ?? document.body,
      )}
    </div>
  );
}
