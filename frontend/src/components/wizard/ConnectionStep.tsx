import CatalogBrowser from "./CatalogBrowser";
import type { ConnectionSetup } from "@/hooks/useConnectionSetup";

interface Props {
  conn: ConnectionSetup;
  rowLimit: number;
  onRowLimitChange: (v: number) => void;
}

export default function ConnectionStep({ conn, rowLimit, onRowLimitChange }: Props) {
  return <CatalogBrowser conn={conn} rowLimit={rowLimit} onRowLimitChange={onRowLimitChange} />;
}
