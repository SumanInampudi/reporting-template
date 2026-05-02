import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Database, TableIcon, Search, Filter, ChevronDown, ChevronRight, GripVertical, Check, GitMerge, ChevronsUpDown, Hash, Type, Network, ArrowDownRight, Upload } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ColumnGroup from "./ColumnGroup";
import DraggableColumn from "./DraggableColumn";
import UploadDataPanel from "./UploadDataPanel";
import Spinner from "@/components/ui/Spinner";
import { SkeletonSidebarColumns } from "@/components/ui/Skeleton";
import {
  fetchCatalogs, fetchSchemas, fetchTablesIn, fetchColumnsIn, runQuery,
} from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { resolveColumnGroupsHierarchical } from "@/lib/columnGroupResolver";
import { useStore } from "@/hooks/useStore";
import type { ColumnMeta, DimensionSource, SelfServiceFeature } from "@/types/dashboard";

function DraggableDimension({ source, isActivated }: { source: DimensionSource; isActivated: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `dim-source-${source.id}`,
    data: { type: "dimension-source", dimSourceId: source.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`sidebar-column${isDragging ? " dragging" : ""}${isActivated ? " sidebar-column--activated" : ""}`}
      title={`${source.label || source.column} (${source.sourceType})`}
    >
      <span className="col-type-badge text">
        <Filter size={10} />
      </span>
      <span className="col-name">{source.label || source.column}</span>
      <span className="col-dtype">{source.sourceType}</span>
      {isActivated && <Check size={10} className="sidebar-dim-active-icon" />}
    </div>
  );
}

export default function DataSourceTab() {
  const {
    catalogs, schemas, tablesMap, columns,
    selectedCatalog, selectedSchema, selectedTable,
    setCatalogs, selectCatalog, setSchemas, selectSchema,
    setTablesForSchema, selectTable, setColumns,
    activeWorkspace, setColumnTableMap,
  } = useStore();

  const uploadedDataset = useStore((s) => s.uploadedDataset);

  const showUpload = useMemo(() => {
    const raw = activeWorkspace?.features ?? [];
    return new Set(raw as SelfServiceFeature[]).has("upload_data");
  }, [activeWorkspace]);

  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [colSearch, setColSearch] = useState("");
  const [uploadSectionOpen, setUploadSectionOpen] = useState(false);
  const autoLoadedRef = useRef(false);

  const isCustomQuery = activeWorkspace?.datasource?.source_mode === "query";

  // Load catalogs on mount (skip for custom query mode)
  useEffect(() => {
    if (isCustomQuery || catalogs.length > 0) return;
    setLoadingCatalogs(true);
    fetchCatalogs()
      .then(setCatalogs)
      .catch(() => setCatalogs(["samples"]))
      .finally(() => setLoadingCatalogs(false));
  }, [isCustomQuery, setCatalogs, catalogs.length]);

  // Auto-load for custom query mode
  useEffect(() => {
    if (!isCustomQuery || autoLoadedRef.current) return;
    const cq = activeWorkspace?.datasource?.custom_query;
    if (!cq || selectedTable) return;

    autoLoadedRef.current = true;
    const colKey = "__custom_source__";

    (async () => {
      setLoadingColumns(true);
      try {
        const result = await runQuery(`SELECT * FROM (${cq}) AS __cq__ LIMIT 1`, 1);
        const types = result.column_types ?? [];
        const cols: ColumnMeta[] = result.columns.map((name, i) => ({
          col_name: name, data_type: types[i] ?? "STRING",
        }));
        useStore.setState({ selectedTable: colKey });
        setColumns(colKey, cols);
        const map: Record<string, string> = {};
        for (const c of cols) map[c.col_name] = colKey;
        setColumnTableMap(map);
      } catch { toast.error("Failed to load query columns"); }
      setLoadingColumns(false);
    })();
  }, [isCustomQuery, activeWorkspace, selectedTable, setColumns, setColumnTableMap]);

  // Auto-load cascade from workspace config (schemas → tables → columns)
  useEffect(() => {
    if (isCustomQuery) return;
    if (autoLoadedRef.current) return;
    if (!selectedCatalog || catalogs.length === 0) return;

    autoLoadedRef.current = true;

    const wsTable = activeWorkspace?.datasource?.default_table ?? null;

    (async () => {
      // Load schemas if missing
      if (!schemas[selectedCatalog]) {
        setLoadingSchemas(true);
        try {
          const s = await fetchSchemas(selectedCatalog);
          setSchemas(selectedCatalog, s);
        } catch { toast.error("Failed to load schemas"); }
        setLoadingSchemas(false);
      }

      if (!selectedSchema) return;

      // Load tables if missing
      const tblKey = `${selectedCatalog}.${selectedSchema}`;
      if (!tablesMap[tblKey]) {
        setLoadingTables(true);
        try {
          const rows = await fetchTablesIn(selectedCatalog, selectedSchema);
          const names = rows.map(
            (r) => (r.tableName ?? r.table_name ?? Object.values(r)[1] ?? Object.values(r)[0]) as string,
          );
          setTablesForSchema(tblKey, names);
        } catch { toast.error("Failed to load tables"); }
        setLoadingTables(false);
      }

      // Auto-select default table from workspace (bypass selectTable to avoid clean-slate reset)
      if (wsTable && !selectedTable) {
        useStore.setState({ selectedTable: wsTable });
        const colKey = `${selectedCatalog}.${selectedSchema}.${wsTable}`;
        if (!columns[colKey]) {
          setLoadingColumns(true);
          try {
            const { columns: cols } = await fetchColumnsIn(selectedCatalog, selectedSchema, wsTable);
            setColumns(colKey, cols);
            const map: Record<string, string> = {};
            for (const c of cols) map[c.col_name] = colKey;
            setColumnTableMap(map);
          } catch { toast.error("Failed to load columns"); }
          setLoadingColumns(false);
        }
      }
    })();
  }, [
    isCustomQuery,
    catalogs, selectedCatalog, selectedSchema, selectedTable,
    schemas, tablesMap, columns, activeWorkspace,
    setSchemas, setTablesForSchema, setColumns,
  ]);

  const handleCatalogChange = async (cat: string) => {
    selectCatalog(cat);
    if (!cat) return;
    if (schemas[cat]) return;
    setLoadingSchemas(true);
    try {
      const s = await fetchSchemas(cat);
      setSchemas(cat, s);
    } catch { toast.error("Failed to load schemas"); }
    setLoadingSchemas(false);
  };

  const handleSchemaChange = async (sch: string) => {
    selectSchema(sch);
    if (!sch || !selectedCatalog) return;
    const key = `${selectedCatalog}.${sch}`;
    if (tablesMap[key]) return;
    setLoadingTables(true);
    try {
      const rows = await fetchTablesIn(selectedCatalog, sch);
      const names = rows.map(
        (r) => (r.tableName ?? r.table_name ?? Object.values(r)[1] ?? Object.values(r)[0]) as string,
      );
      setTablesForSchema(key, names);
    } catch { toast.error("Failed to load tables"); }
    setLoadingTables(false);
  };

  const handleTableChange = async (tbl: string) => {
    selectTable(tbl);
    setColSearch("");
    if (!tbl || !selectedCatalog || !selectedSchema) return;
    const colKey = `${selectedCatalog}.${selectedSchema}.${tbl}`;
    if (columns[colKey]) return;
    setLoadingColumns(true);
    try {
      const { columns: cols } = await fetchColumnsIn(selectedCatalog, selectedSchema, tbl);
      setColumns(colKey, cols);
    } catch { toast.error("Failed to load columns"); }
    setLoadingColumns(false);
  };

  const schemaList = selectedCatalog ? schemas[selectedCatalog] ?? [] : [];
  const tableKey =
    selectedCatalog && selectedSchema
      ? `${selectedCatalog}.${selectedSchema}`
      : null;
  const tableList = tableKey ? tablesMap[tableKey] ?? [] : [];
  const colKey = isCustomQuery
    ? (selectedTable ? "__custom_source__" : null)
    : (selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : null);
  const excludedSet = useMemo(
    () => new Set(activeWorkspace?.excluded_columns ?? []),
    [activeWorkspace?.excluded_columns],
  );
  const columnList = useMemo(() => {
    const raw = colKey ? columns[colKey] ?? [] : [];
    return excludedSet.size > 0 ? raw.filter((c) => !excludedSet.has(c.col_name)) : raw;
  }, [colKey, columns, excludedSet]);

  const filteredColumns = useMemo(() => {
    if (!colSearch) return columnList;
    const q = colSearch.toLowerCase();
    return columnList.filter((c) => c.col_name.toLowerCase().includes(q));
  }, [columnList, colSearch]);

  const hierarchy = useMemo(
    () => resolveColumnGroupsHierarchical(filteredColumns, activeWorkspace?.column_groups),
    [filteredColumns, activeWorkspace?.column_groups],
  );

  const { dimensionSources, activatedOptionalDimIds, hierarchies } = useStore();
  const optionalDimSources = useMemo(
    () => dimensionSources.filter((ds) => !ds.required),
    [dimensionSources],
  );
  const [dimGroupOpen, setDimGroupOpen] = useState(false);
  const [hierSectionOpen, setHierSectionOpen] = useState(false);

  const columnAliases = activeWorkspace?.column_aliases ?? {};
  const hierColSet = useMemo(() => {
    const s = new Set<string>();
    for (const h of hierarchies) for (const lv of h.levels) if (lv.column) s.add(lv.column);
    return s;
  }, [hierarchies]);
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({});

  const wsJoins = activeWorkspace?.joins ?? [];
  const [joinedCols, setJoinedCols] = useState<Record<string, ColumnMeta[]>>({});
  const [joinGroupsOpen, setJoinGroupsOpen] = useState<Record<string, boolean>>({});
  const joinLoadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedCatalog || !selectedSchema || wsJoins.length === 0) return;
    for (const j of wsJoins) {
      if (!j.table || joinLoadedRef.current.has(j.table)) continue;
      joinLoadedRef.current.add(j.table);
      const fqKey = `${selectedCatalog}.${selectedSchema}.${j.table}`;
      fetchColumnsIn(selectedCatalog, selectedSchema, j.table)
        .then(({ columns: cols }) => {
          setColumns(fqKey, cols);
          setJoinedCols((prev) => ({ ...prev, [j.table]: cols }));
          setJoinGroupsOpen((prev) => ({ ...prev, [j.table]: false }));
          const map: Record<string, string> = {};
          for (const c of cols) map[c.col_name] = fqKey;
          setColumnTableMap(map);
        })
        .catch(() => {});
    }
  }, [selectedCatalog, selectedSchema, wsJoins, setColumns]);

  const filteredJoinedCols = useMemo(() => {
    if (!colSearch) return joinedCols;
    const q = colSearch.toLowerCase();
    const out: Record<string, ColumnMeta[]> = {};
    for (const [tbl, cols] of Object.entries(joinedCols)) {
      const matched = cols.filter((c) => c.col_name.toLowerCase().includes(q));
      if (matched.length > 0) out[tbl] = matched;
    }
    return out;
  }, [joinedCols, colSearch]);

  const wsHasConnection = isCustomQuery || !!(
    activeWorkspace?.datasource?.catalog && activeWorkspace?.datasource?.schema
  );

  return (
    <div className="sidebar-scroll">

      {/* Only show connection dropdowns if workspace doesn't already define them */}
      {!wsHasConnection && (
        <div className="sidebar-section">
          <h3 className="sidebar-heading"><Database size={14} /> Connection</h3>

          <SearchableSelect
            label="Catalog"
            value={selectedCatalog}
            options={catalogs}
            placeholder="Select catalog..."
            loading={loadingCatalogs}
            onChange={handleCatalogChange}
          />

          <SearchableSelect
            label="Schema"
            value={selectedSchema}
            options={schemaList}
            placeholder="Select schema..."
            loading={loadingSchemas}
            disabled={!selectedCatalog}
            onChange={handleSchemaChange}
          />

          <SearchableSelect
            label="Table / View"
            value={selectedTable}
            options={tableList}
            placeholder="Select table..."
            loading={loadingTables}
            disabled={!selectedSchema}
            onChange={handleTableChange}
          />
        </div>
      )}

      {isCustomQuery && (
        <div className="sidebar-section">
          <div className="cq-source-badge">
            <Database size={12} /> Custom SQL Query
          </div>
        </div>
      )}

      {wsHasConnection && !colKey && (
        <div className="sidebar-section">
          <SkeletonSidebarColumns groups={3} itemsPerGroup={4} />
        </div>
      )}

      {(loadingSchemas || loadingTables || loadingColumns) && !colKey && !wsHasConnection && (
        <SkeletonSidebarColumns groups={2} itemsPerGroup={3} />
      )}

      {colKey && columnList.length > 0 && (
        <div className="sidebar-section">
          <h3 className="sidebar-heading">
            <TableIcon size={14} /> Columns ({columnList.length})
          </h3>

          <div className="sidebar-col-search">
            <Search size={12} />
            <input
              className="sidebar-col-search-input"
              placeholder="Search columns..."
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
            />
          </div>

          <div className="sidebar-expand-bar">
            <button
              className="sidebar-expand-btn"
              onClick={() => {
                const allOpen: Record<string, boolean> = {};
                for (const l1 of hierarchy) {
                  allOpen[l1.key] = true;
                  for (const sg of l1.subGroups) allOpen[`${l1.key}::${sg.key}`] = true;
                }
                for (const tbl of Object.keys(joinedCols)) allOpen[tbl] = true;
                setGroupsOpen(allOpen);
                setDimGroupOpen(true);
                setJoinGroupsOpen((prev) => {
                  const next = { ...prev };
                  for (const k of Object.keys(next)) next[k] = true;
                  return next;
                });
              }}
            >
              <ChevronsUpDown size={11} /> Expand All
            </button>
            <button
              className="sidebar-expand-btn"
              onClick={() => {
                setGroupsOpen({});
                setDimGroupOpen(false);
                setJoinGroupsOpen((prev) => {
                  const next = { ...prev };
                  for (const k of Object.keys(next)) next[k] = false;
                  return next;
                });
              }}
            >
              <ChevronsUpDown size={11} /> Collapse All
            </button>
          </div>

          {loadingColumns && <SkeletonSidebarColumns groups={2} itemsPerGroup={3} />}

          {optionalDimSources.length > 0 && (
            <div className="col-group">
              <button className="col-group-header" onClick={() => setDimGroupOpen(!dimGroupOpen)}>
                {dimGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Filter size={13} className="col-group-icon dimension" />
                <span className="col-group-title">Custom Filters</span>
                <span className="col-group-count">{optionalDimSources.length}</span>
              </button>
            {dimGroupOpen && (
              <>
                <p className="sidebar-hint">Drag to Filters section to use as a filter</p>
                <div className="col-group-list">
                  {optionalDimSources.map((ds) => (
                    <DraggableDimension
                      key={ds.id}
                      source={ds}
                      isActivated={activatedOptionalDimIds.includes(ds.id)}
                    />
                  ))}
                </div>
              </>
            )}
            </div>
          )}

          {hierarchies.length > 0 && (
            <div className="col-group col-group--hierarchies">
              <button className="col-group-header" onClick={() => setHierSectionOpen(!hierSectionOpen)}>
                {hierSectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Network size={13} className="col-group-icon hierarchy" />
                <span className="col-group-title">Hierarchies</span>
                <span className="col-group-count">{hierarchies.length}</span>
              </button>
              {hierSectionOpen && (
                <div className="sidebar-hier-list">
                  {hierarchies.map((h) => (
                    <div key={h.id} className="sidebar-hier-item">
                      <span className="sidebar-hier-name">{h.name}</span>
                      <div className="sidebar-hier-levels">
                        {h.levels.map((lv, i) => (
                          <span key={lv.id} className="sidebar-hier-level">
                            {i > 0 && <ArrowDownRight size={10} className="sidebar-hier-arrow" />}
                            <span className="sidebar-hier-level-label">
                              {lv.label || columnAliases[lv.column] || lv.column}
                            </span>
                          </span>
                        ))}
                      </div>
                      <p className="sidebar-hier-hint">Click values in charts or pivot rows to drill down</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hierarchy.map((l1) => {
            if (l1.allColumns.length === 0) return null;
            const L1Icon = l1.isNumeric ? Hash : Type;
            const l1Open = !!colSearch || (groupsOpen[l1.key] ?? false);
            const hasSubCategories = l1.subGroups.length > 1 || (l1.subGroups.length === 1 && l1.subGroups[0].key !== l1.key);
            return (
              <div key={l1.key} className="col-group col-group--level1">
                <button
                  className="col-group-header col-group-header--level1"
                  onClick={() => setGroupsOpen((prev) => ({ ...prev, [l1.key]: !l1Open }))}
                >
                  {l1Open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <L1Icon size={13} className={`col-group-icon ${l1.isNumeric ? "fact" : "dimension"}`} />
                  <span className="col-group-title">{l1.label}</span>
                  <span className="col-group-count">{l1.allColumns.length}</span>
                </button>
                {l1Open && hasSubCategories && l1.subGroups.map((sg) => {
                  if (sg.columns.length === 0) return null;
                  const sgKey = `${l1.key}::${sg.key}`;
                  return (
                    <ColumnGroup
                      key={sgKey}
                      title={sg.label}
                      icon={l1.isNumeric ? "fact" : "dimension"}
                      columns={sg.columns}
                      table={colKey}
                      isOpen={!!colSearch || (groupsOpen[sgKey] ?? false)}
                      onToggle={() => setGroupsOpen((prev) => ({ ...prev, [sgKey]: !(prev[sgKey] ?? false) }))}
                      indent
                    />
                  );
                })}
                {l1Open && !hasSubCategories && (
                  <div className="col-group-list">
                    {l1.allColumns.map((c) => (
                      <DraggableColumn
                        key={c.col_name}
                        table={colKey!}
                        column={c.col_name}
                        dataType={c.data_type}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {wsJoins.length > 0 && Object.entries(filteredJoinedCols).map(([tbl, cols]) => {
            const fqKey = `${selectedCatalog}.${selectedSchema}.${tbl}`;
            const isOpen = !!colSearch || (joinGroupsOpen[tbl] ?? false);
            return (
              <div key={tbl} className="col-group">
                <button className="col-group-header" onClick={() => setJoinGroupsOpen((p) => ({ ...p, [tbl]: !isOpen }))}>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <GitMerge size={13} className="col-group-icon dimension" />
                  <span className="col-group-title">{tbl}</span>
                  <span className="col-group-count">{cols.length}</span>
                </button>
                {isOpen && (
                  <div className="col-group-list">
                    {cols.map((c) => (
                      <DraggableColumn
                        key={`${tbl}.${c.col_name}`}
                        table={fqKey}
                        column={c.col_name}
                        dataType={c.data_type}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uploaded data columns */}
          {uploadedDataset?.joinConfig?.uploadKeyColumn && uploadedDataset?.joinConfig?.primaryKeyColumn && (
            <div className="col-group">
              <button className="col-group-header" onClick={() => setUploadSectionOpen(!uploadSectionOpen)}>
                {uploadSectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Upload size={13} className="col-group-icon dimension" />
                <span className="col-group-title">{uploadedDataset.fileName}</span>
                <span className="col-group-count">{uploadedDataset.columns.length}</span>
              </button>
              {uploadSectionOpen && (
                <div className="col-group-list">
                  {uploadedDataset.columns
                    .filter((c) => c !== uploadedDataset.joinConfig!.uploadKeyColumn)
                    .map((c) => (
                      <DraggableColumn
                        key={`upload.${c}`}
                        table="__upload__"
                        column={c}
                        dataType="STRING"
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {filteredColumns.length === 0 && Object.keys(filteredJoinedCols).length === 0 && colSearch && (
            <p className="sidebar-info">No columns match "{colSearch}"</p>
          )}
        </div>
      )}

      {colKey && columnList.length === 0 && !loadingColumns && (
        <p className="sidebar-info">No columns found.</p>
      )}

      {!colKey && !wsHasConnection && (
        <p className="sidebar-info">
          Select a catalog, schema, and table to browse columns.
        </p>
      )}

      {showUpload && colKey && (
        <div className="sidebar-section sidebar-upload-section">
          <h3 className="sidebar-heading">
            <Upload size={14} /> Upload & Join Data
          </h3>
          <UploadDataPanel />
        </div>
      )}
    </div>
  );
}
