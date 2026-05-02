import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Filter, RotateCcw, Hash, Calendar, ListFilter,
  Check, Search, X, ChevronDown,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useColumnAlias } from "@/hooks/useColumnAlias";
import type { FilterItem, NumericOp } from "@/types/dashboard";

function DashFilterChip({ filter }: { filter: FilterItem }) {
  const { updateDashboardFilter } = useStore();
  const alias = useColumnAlias();
  const label = alias(filter.column);
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (chipRef.current && !chipRef.current.contains(t) && popRef.current && !popRef.current.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getPos = useCallback((): React.CSSProperties => {
    if (!chipRef.current) return {};
    const r = chipRef.current.getBoundingClientRect();
    let top = r.bottom + 4;
    let left = r.left;
    if (left + 320 > window.innerWidth - 8) left = window.innerWidth - 328;
    if (top + 320 > window.innerHeight - 8) top = r.top - 324;
    return { top, left };
  }, []);

  const portalTarget = document.getElementById("themed-portal") ?? document.body;

  if (filter.filterType === "numeric_range") {
    return (
      <NumericDashChip
        filter={filter}
        label={label}
        open={open}
        setOpen={setOpen}
        chipRef={chipRef}
        popRef={popRef}
        getPos={getPos}
        portalTarget={portalTarget}
      />
    );
  }

  if (filter.filterType === "date_range" || filter.filterType === "date_relative") {
    const display = filter.dateFrom && filter.dateTo
      ? `${filter.dateFrom} → ${filter.dateTo}`
      : "All dates";
    return (
      <div className="dash-flt-chip" ref={chipRef}>
        <Calendar size={12} />
        <span className="dash-flt-chip-name">{label}</span>
        <span className="dash-flt-chip-val">{display}</span>
      </div>
    );
  }

  return (
    <ValueListDashChip
      filter={filter}
      label={label}
      open={open}
      setOpen={setOpen}
      chipRef={chipRef}
      popRef={popRef}
      getPos={getPos}
      portalTarget={portalTarget}
    />
  );
}

interface SubChipProps {
  filter: FilterItem;
  label: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  chipRef: React.RefObject<HTMLDivElement>;
  popRef: React.RefObject<HTMLDivElement>;
  getPos: () => React.CSSProperties;
  portalTarget: HTMLElement;
}

function ValueListDashChip({ filter, label, open, setOpen, chipRef, popRef, getPos, portalTarget }: SubChipProps) {
  const { updateDashboardFilter } = useStore();
  const [local, setLocal] = useState<string[]>(filter.selectedValues);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setLocal(filter.selectedValues);
  }, [open, filter.selectedValues]);

  const toggle = (val: string) =>
    setLocal((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);

  const apply = () => {
    updateDashboardFilter(filter.id, { selectedValues: local });
    setOpen(false);
  };

  const filtered = search
    ? filter.values.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : filter.values;

  const display = filter.selectedValues.length === 0
    ? "All"
    : filter.selectedValues.length === 1
      ? filter.selectedValues[0]
      : `${filter.selectedValues.length} sel.`;

  return (
    <>
      <div className={`dash-flt-chip${filter.selectedValues.length > 0 ? " dash-flt-chip--active" : ""}`} ref={chipRef} onClick={() => setOpen(!open)}>
        <ListFilter size={12} />
        <span className="dash-flt-chip-name">{label}</span>
        <span className="dash-flt-chip-val">{display}</span>
        <ChevronDown size={10} />
      </div>
      {open && createPortal(
        <div className="flt-popover-portal" style={getPos()} ref={popRef}>
          <div className="flt-popover" style={{ maxWidth: 320 }}>
            <div className="flt-popover-header">
              <span className="flt-popover-title"><ListFilter size={14} /> {label}</span>
            </div>
            <div className="flt-popover-search">
              <Search size={13} />
              <input className="flt-popover-search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} onClick={() => setSearch("")}><X size={12} /></button>}
            </div>
            {filter.values.length > 0 && (
              <div className="flt-popover-bulk">
                <button className="flt-popover-bulk-btn" onClick={() => setLocal([...new Set([...local, ...filtered])])}>Select all</button>
                <span className="flt-popover-bulk-sep">|</span>
                <button className="flt-popover-bulk-btn" onClick={() => { const rm = new Set(filtered); setLocal(local.filter((v) => !rm.has(v))); }}>Deselect all</button>
              </div>
            )}
            <div className="flt-popover-list">
              {filtered.map((v) => {
                const sel = local.includes(v);
                return (
                  <button key={v} className={`flt-popover-option${sel ? " flt-popover-option--selected" : ""}`} onClick={() => toggle(v)}>
                    <span className="flt-popover-option-text">{v}</span>
                    {sel && <Check size={12} className="flt-popover-option-tick" />}
                  </button>
                );
              })}
            </div>
            <div className="flt-popover-footer">
              <span className="flt-popover-count"><strong>{local.length}</strong> of {filter.values.length}</span>
              <div className="flt-popover-actions">
                <button className="flt-popover-btn" onClick={() => setLocal([])}>Clear</button>
                <button className="flt-popover-btn flt-popover-btn--done" onClick={apply}>Done</button>
              </div>
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </>
  );
}

function NumericDashChip({ filter, label, open, setOpen, chipRef, popRef, getPos, portalTarget }: SubChipProps) {
  const { updateDashboardFilter } = useStore();
  const OPS: { id: NumericOp; sym: string }[] = [
    { id: ">", sym: ">" }, { id: ">=", sym: ">=" },
    { id: "<", sym: "<" }, { id: "<=", sym: "<=" },
    { id: "=", sym: "=" }, { id: "!=", sym: "≠" },
    { id: "between", sym: "↔" },
  ];
  const [op, setOp] = useState<NumericOp>(filter.numericOp ?? ">");
  const [v1, setV1] = useState(filter.numericValue?.toString() ?? "");
  const [v2, setV2] = useState(filter.numericValue2?.toString() ?? "");

  useEffect(() => {
    if (open) {
      setOp(filter.numericOp ?? ">");
      setV1(filter.numericValue?.toString() ?? "");
      setV2(filter.numericValue2?.toString() ?? "");
    }
  }, [open, filter.numericOp, filter.numericValue, filter.numericValue2]);

  const apply = () => {
    const n1 = v1 !== "" ? Number(v1) : undefined;
    const n2 = op === "between" && v2 !== "" ? Number(v2) : undefined;
    updateDashboardFilter(filter.id, { numericOp: op, numericValue: n1, numericValue2: n2 });
    setOpen(false);
  };

  const isActive = filter.numericValue !== undefined;
  const sym = OPS.find((o) => o.id === filter.numericOp)?.sym ?? ">";
  const display = isActive
    ? filter.numericOp === "between" && filter.numericValue2 !== undefined
      ? `${filter.numericValue} – ${filter.numericValue2}`
      : `${sym} ${filter.numericValue}`
    : "Any";

  return (
    <>
      <div className={`dash-flt-chip${isActive ? " dash-flt-chip--active" : ""}`} ref={chipRef} onClick={() => setOpen(!open)}>
        <Hash size={12} />
        <span className="dash-flt-chip-name">{label}</span>
        <span className="dash-flt-chip-val">{display}</span>
        <ChevronDown size={10} />
      </div>
      {open && createPortal(
        <div className="flt-popover-portal" style={getPos()} ref={popRef}>
          <div className="flt-popover flt-popover--numeric">
            <div className="flt-popover-header">
              <span className="flt-popover-title"><Hash size={14} /> {label}</span>
            </div>
            <div className="num-flt-body">
              <label className="num-flt-label">Operator</label>
              <div className="num-flt-ops">
                {OPS.map((o) => (
                  <button key={o.id} className={`num-flt-op${op === o.id ? " num-flt-op--active" : ""}`} onClick={() => setOp(o.id)} title={o.id}>{o.sym}</button>
                ))}
              </div>
              <label className="num-flt-label">{op === "between" ? "Min" : "Value"}</label>
              <input type="number" className="num-flt-input" value={v1} onChange={(e) => setV1(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} />
              {op === "between" && (
                <>
                  <label className="num-flt-label">Max</label>
                  <input type="number" className="num-flt-input" value={v2} onChange={(e) => setV2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} />
                </>
              )}
            </div>
            <div className="flt-popover-footer">
              <span className="flt-popover-count">{isActive ? <strong>{display}</strong> : "No constraint"}</span>
              <div className="flt-popover-actions">
                <button className="flt-popover-btn" onClick={() => { updateDashboardFilter(filter.id, { numericValue: undefined, numericValue2: undefined }); setV1(""); setV2(""); }}>Clear</button>
                <button className="flt-popover-btn flt-popover-btn--done" disabled={v1 === ""} onClick={apply}>Apply</button>
              </div>
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </>
  );
}

export default function DashboardFilterBar() {
  const { dashboardFilters, resetDashboardFilters, appliedFilters } = useStore();

  useEffect(() => {
    if (dashboardFilters.length === 0 && appliedFilters.length > 0) {
      resetDashboardFilters();
    }
  }, [appliedFilters, dashboardFilters.length, resetDashboardFilters]);

  if (dashboardFilters.length === 0) return null;

  const activeCount = dashboardFilters.filter((f) =>
    f.selectedValues.length > 0 || (f.dateFrom && f.dateTo) || f.numericValue !== undefined,
  ).length;

  return (
    <div className="dash-filter-bar">
      <div className="dash-filter-bar-label">
        <Filter size={13} />
        <span>Dashboard Filters</span>
        {activeCount > 0 && <span className="filter-bar-badge">{activeCount}</span>}
      </div>
      <div className="dash-filter-bar-chips">
        {dashboardFilters.map((f) => (
          <DashFilterChip key={f.id} filter={f} />
        ))}
      </div>
      <button className="dash-filter-bar-reset" onClick={resetDashboardFilters} title="Reset to data filters">
        <RotateCcw size={12} /> Reset
      </button>
    </div>
  );
}
