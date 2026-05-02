import { useEffect, useState } from "react";
import {
  testConnection, fetchCatalogs, fetchSchemas, fetchTablesIn,
} from "@/lib/api";

export interface ConnectionSetup {
  connStatus: { ok: boolean; message: string } | null;
  connTesting: boolean;

  catalogs: string[];
  catalogsLoading: boolean;
  schemas: string[];
  schemasLoading: boolean;
  tables: string[];
  tablesLoading: boolean;

  selectedCatalog: string;
  selectedSchema: string;
  selectedTable: string;

  handleCatalogChange: (v: string) => void;
  handleSchemaChange: (v: string) => void;
  setSelectedTable: (v: string) => void;

  setSelectedCatalog: (v: string) => void;
  setSelectedSchema: (v: string) => void;
}

export function useConnectionSetup(
  initialCatalog = "",
  initialSchema = "",
  initialTable = "",
): ConnectionSetup {
  const [connStatus, setConnStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [connTesting, setConnTesting] = useState(false);

  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);

  const [selectedCatalog, setSelectedCatalog] = useState(initialCatalog);
  const [selectedSchema, setSelectedSchema] = useState(initialSchema);
  const [selectedTable, setSelectedTable] = useState(initialTable);

  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);

  useEffect(() => {
    setConnTesting(true);
    testConnection()
      .then((r) => setConnStatus(r))
      .catch(() => setConnStatus({ ok: false, message: "Cannot reach server" }))
      .finally(() => setConnTesting(false));
  }, []);

  useEffect(() => {
    if (!connStatus?.ok) return;
    setCatalogsLoading(true);
    fetchCatalogs()
      .then((c) => setCatalogs(c))
      .catch(() => {})
      .finally(() => setCatalogsLoading(false));
  }, [connStatus]);

  useEffect(() => {
    if (!selectedCatalog) { setSchemas([]); setTables([]); return; }
    setSchemasLoading(true);
    fetchSchemas(selectedCatalog)
      .then((s) => setSchemas(s))
      .catch(() => {})
      .finally(() => setSchemasLoading(false));
  }, [selectedCatalog]);

  useEffect(() => {
    if (!selectedCatalog || !selectedSchema) { setTables([]); return; }
    setTablesLoading(true);
    fetchTablesIn(selectedCatalog, selectedSchema)
      .then((rows) => {
        const names = rows.map((r) =>
          (r as Record<string, string>).tableName ??
          (r as Record<string, string>).table_name ??
          (Object.values(r)[0] as string),
        ).filter(Boolean);
        setTables(names);
      })
      .catch(() => {})
      .finally(() => setTablesLoading(false));
  }, [selectedCatalog, selectedSchema]);

  const handleCatalogChange = (v: string) => {
    setSelectedCatalog(v);
    setSelectedSchema("");
    setSelectedTable("");
  };

  const handleSchemaChange = (v: string) => {
    setSelectedSchema(v);
    setSelectedTable("");
  };

  return {
    connStatus, connTesting,
    catalogs, catalogsLoading,
    schemas, schemasLoading,
    tables, tablesLoading,
    selectedCatalog, selectedSchema, selectedTable,
    handleCatalogChange, handleSchemaChange, setSelectedTable,
    setSelectedCatalog, setSelectedSchema,
  };
}
