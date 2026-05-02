import { useColumnAlias } from "@/hooks/useColumnAlias";
import type { QueryResult } from "@/types/dashboard";

interface Props {
  data: QueryResult;
  maxRows?: number;
}

export default function DataTable({ data, maxRows = 100 }: Props) {
  const alias = useColumnAlias();
  const displayed = data.rows.slice(0, maxRows);
  const truncated = data.rows.length > maxRows;

  return (
    <div className="widget-table-wrapper">
      <table className="widget-table">
        <thead>
          <tr>
            {data.columns.map((c) => <th key={c} title={c}>{alias(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{String(cell ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && (
        <p className="table-truncated">Showing {maxRows} of {data.rows.length} rows</p>
      )}
    </div>
  );
}
