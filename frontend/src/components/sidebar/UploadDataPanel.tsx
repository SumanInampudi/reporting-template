import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload, X, FileSpreadsheet, ArrowRight, Check, AlertCircle, Trash2,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useStore } from "@/hooks/useStore";
import type { UploadedDataset, UploadJoinConfig } from "@/types/dashboard";

function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const columns = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    columns.forEach((col, i) => { row[col] = vals[i] ?? ""; });
    return row;
  });
  return { columns, rows };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadDataPanel() {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const uploadedDataset = useStore((s) => s.uploadedDataset);
  const setUploadedDataset = useStore((s) => s.setUploadedDataset);
  const setUploadJoinConfig = useStore((s) => s.setUploadJoinConfig);
  const clearUploadedDataset = useStore((s) => s.clearUploadedDataset);
  const columns = useStore((s) => s.columns);
  const selectedTable = useStore((s) => s.selectedTable);

  const limitMb = activeWorkspace?.settings?.upload_limit_mb ?? 2;
  const limitBytes = limitMb * 1024 * 1024;

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const primaryColumns = useMemo(() => {
    if (!selectedTable) return [];
    const key = Object.keys(columns).find((k) => k.endsWith(`.${selectedTable}`) || k === selectedTable);
    return key ? columns[key].map((c) => c.col_name) : [];
  }, [columns, selectedTable]);

  const handleFile = useCallback((file: File) => {
    setParseError(null);
    if (file.size > limitBytes) {
      setParseError(`File is ${formatBytes(file.size)} — exceeds the ${limitMb} MB limit`);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Only .csv files are supported");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { columns: cols, rows } = parseCsv(text);
        if (cols.length === 0) { setParseError("File is empty or has no header row"); return; }
        if (rows.length === 0) { setParseError("File has headers but no data rows"); return; }

        const ds: UploadedDataset = {
          fileName: file.name,
          columns: cols,
          rows,
          joinConfig: null,
          uploadedAt: new Date().toISOString(),
        };
        setUploadedDataset(ds);
        toast.success(`Loaded ${rows.length.toLocaleString()} rows, ${cols.length} columns`);
      } catch {
        setParseError("Failed to parse CSV file");
      }
    };
    reader.onerror = () => setParseError("Failed to read file");
    reader.readAsText(file);
  }, [limitBytes, limitMb, setUploadedDataset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleJoinChange = (field: keyof UploadJoinConfig, value: string) => {
    if (!uploadedDataset) return;
    const current = uploadedDataset.joinConfig ?? {
      uploadKeyColumn: "",
      primaryKeyColumn: "",
      joinType: "LEFT" as const,
    };
    setUploadJoinConfig({ ...current, [field]: value });
  };

  const joinReady = !!(
    uploadedDataset?.joinConfig?.uploadKeyColumn &&
    uploadedDataset?.joinConfig?.primaryKeyColumn
  );

  if (uploadedDataset) {
    const ds = uploadedDataset;
    const previewRows = ds.rows.slice(0, 3);

    return (
      <div className="upload-panel">
        <div className="upload-file-info">
          <FileSpreadsheet size={14} />
          <div className="upload-file-details">
            <span className="upload-file-name">{ds.fileName}</span>
            <span className="upload-file-meta">
              {ds.rows.length.toLocaleString()} rows · {ds.columns.length} columns
            </span>
          </div>
          <button className="upload-remove-btn" onClick={clearUploadedDataset} title="Remove uploaded data">
            <Trash2 size={12} />
          </button>
        </div>

        {/* Preview */}
        <div className="upload-preview-wrap">
          <table className="upload-preview-table">
            <thead>
              <tr>
                {ds.columns.map((c) => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, i) => (
                <tr key={i}>
                  {ds.columns.map((c) => <td key={c}>{r[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Join config */}
        <div className="upload-join-config">
          <h4 className="upload-join-title">Define Join</h4>
          <p className="upload-join-desc">
            Map a column from your file to a column in the primary table to merge data.
          </p>

          <div className="upload-join-row">
            <div className="upload-join-col">
              <label className="upload-join-label">Uploaded File Column</label>
              <select
                className="upload-join-select"
                value={ds.joinConfig?.uploadKeyColumn ?? ""}
                onChange={(e) => handleJoinChange("uploadKeyColumn", e.target.value)}
              >
                <option value="">Select column...</option>
                {ds.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <ArrowRight size={14} className="upload-join-arrow" />
            <div className="upload-join-col">
              <label className="upload-join-label">Primary Table Column</label>
              <select
                className="upload-join-select"
                value={ds.joinConfig?.primaryKeyColumn ?? ""}
                onChange={(e) => handleJoinChange("primaryKeyColumn", e.target.value)}
              >
                <option value="">Select column...</option>
                {primaryColumns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="upload-join-type-row">
            <label className="upload-join-label">Join Type</label>
            <div className="upload-join-type-btns">
              {(["LEFT", "INNER"] as const).map((jt) => (
                <button
                  key={jt}
                  className={`upload-join-type-btn${(ds.joinConfig?.joinType ?? "LEFT") === jt ? " upload-join-type-btn--active" : ""}`}
                  onClick={() => handleJoinChange("joinType", jt)}
                >
                  {jt === "LEFT" ? "Left (keep all)" : "Inner (matching only)"}
                </button>
              ))}
            </div>
          </div>

          {joinReady && (
            <div className="upload-join-ready">
              <Check size={12} /> Join configured — uploaded columns will merge after "Load Data"
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="upload-panel">
      <div
        className={`upload-dropzone${dragging ? " upload-dropzone--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={20} />
        <span className="upload-dropzone-text">
          Drop a CSV file here or <strong>browse</strong>
        </span>
        <span className="upload-dropzone-hint">Max {limitMb} MB</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />
      {parseError && (
        <div className="upload-error">
          <AlertCircle size={12} /> {parseError}
          <button className="upload-error-close" onClick={() => setParseError(null)}><X size={10} /></button>
        </div>
      )}
    </div>
  );
}
