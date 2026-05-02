import { useEffect, useMemo, useRef, useState } from "react";
import { Database, TableIcon, Search } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ColumnGroup from "./ColumnGroup";
import Spinner from "@/components/ui/Spinner";
import PresetBar from "@/components/presets/PresetBar";
import {
  fetchCatalogs, fetchSchemas, fetchTablesIn, fetchColumnsIn,
} from "@/lib/api";
import { resolveColumnGroups } from "@/lib/columnGroupResolver";
import { useStore } from "@/hooks/useStore";

interface DataSourceTabProps {
  showPresets?: boolean;
}

export default function DataSourceTab({ showPresets = false }: DataSourceTabProps) {
  const {
    catalogs, schemas, tablesMap, columns,
    selectedCatalog, selectedSchema, selectedTable,
    setCatalogs, selectCatalog, setSchemas, selectSchema,
    setTablesForSchema, selectTable, setColumns,
    activeWorkspace,
  } = useStore();

  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [colSearch, setColSearch] = useState("");
  const autoLoadedRef = useRef(false);

  // Load catalogs on mount
  useEffect(() => {
    if (catalogs.length > 0) return;
    setLoadingCatalogs(true);
    fetchCatalogs()
      .then(setCatalogs)
      .catch(() => setCatalogs(["samples"]))
      .finally(() => setLoadingCatalogs(false));
  }, [setCatalogs, catalogs.length]);

  // Auto-load cascade from workspace config (schemas → tables → columns)
  useEffect(() => {
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
        } catch { /* swallow */ }
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
        } catch { /* swallow */ }
        setLoadingTables(false);
      }

      // Auto-select default table from workspace (bypass selectTable to avoid clean-slate reset)
      if (wsTable && !selectedTable) {
        useStore.setState({ selectedTable: wsTable });
        const colKey = `${selectedCatalog}.${selectedSchema}.${wsTable}`;
        if (!columns[colKey]) {
          setLoadingColumns(true);
          try {
            const cols = await fetchColumnsIn(selectedCatalog, selectedSchema, wsTable);
            setColumns(colKey, cols);
          } catch { /* swallow */ }
          setLoadingColumns(false);
        }
      }
    })();
  }, [
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
    } catch { /* swallow */ }
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
    } catch { /* swallow */ }
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
      const cols = await fetchColumnsIn(selectedCatalog, selectedSchema, tbl);
      setColumns(colKey, cols);
    } catch { /* swallow */ }
    setLoadingColumns(false);
  };

  const schemaList = selectedCatalog ? schemas[selectedCatalog] ?? [] : [];
  const tableKey =
    selectedCatalog && selectedSchema
      ? `${selectedCatalog}.${selectedSchema}`
      : null;
  const tableList = tableKey ? tablesMap[tableKey] ?? [] : [];
  const colKey =
    selectedCatalog && selectedSchema && selectedTable
      ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
      : null;
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

  const groups = useMemo(
    () => resolveColumnGroups(filteredColumns, activeWorkspace?.column_groups),
    [filteredColumns, activeWorkspace?.column_groups],
  );

  const wsHasConnection = !!(
    activeWorkspace?.datasource?.catalog && activeWorkspace?.datasource?.schema
  );

  return (
    <div className="sidebar-scroll">
      {showPresets && (
        <div className="sidebar-section sidebar-presets-section">
          <PresetBar />
        </div>
      )}

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

      {wsHasConnection && !colKey && (
        <div className="sidebar-section">
          <Spinner text="Loading metadata..." />
        </div>
      )}

      {(loadingSchemas || loadingTables || loadingColumns) && !colKey && !wsHasConnection && (
        <Spinner text="Loading metadata..." />
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

          {loadingColumns && <Spinner text="Loading columns..." />}

          {groups.map((g) => (
            <ColumnGroup
              key={g.key}
              title={g.label}
              icon={g.isNumeric === true ? "fact" : "dimension"}
              columns={g.columns}
              table={colKey}
            />
          ))}

          {filteredColumns.length === 0 && colSearch && (
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
    </div>
  );
}
