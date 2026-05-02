import { useState } from "react";
import { Code, Loader2, Play } from "lucide-react";

interface Props {
  sql: string;
  sqlEdit: string;
  onSqlChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
}

export default function SqlPreview({ sql, sqlEdit, onSqlChange, onRun, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sql-preview">
      <button className="sql-toggle" onClick={() => setExpanded(!expanded)}>
        <Code size={12} />
        <span>SQL Query</span>
        {loading && <Loader2 size={12} className="spin" />}
      </button>
      {expanded && (
        <div className="sql-editor">
          <textarea
            rows={4}
            value={sqlEdit || sql}
            onChange={(e) => onSqlChange(e.target.value)}
          />
          <button className="run-btn" onClick={onRun} disabled={loading}>
            <Play size={12} />
            {loading ? "Running..." : "Run Query"}
          </button>
        </div>
      )}
      {!expanded && sql && (
        <pre className="sql-inline">{sql}</pre>
      )}
    </div>
  );
}
