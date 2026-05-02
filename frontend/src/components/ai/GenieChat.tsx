import { useCallback, useMemo, useRef, useState } from "react";
import {
  Send, Sparkles, User, Database, Table2, RotateCcw, Copy, Check,
  ChevronDown, ChevronRight, BarChart3,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactECharts from "echarts-for-react";
import { useStore } from "@/hooks/useStore";
import { askGenie, type GenieResponse } from "@/lib/api";
import { toast } from "@/components/ui/Toast";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  miniTable?: { columns: string[]; rows: string[][] };
  timestamp: Date;
  error?: boolean;
}

/* ── Context builder ─────────────────────────────────────────────── */

function buildContext(): string {
  const s = useStore.getState();
  const ws = s.activeWorkspace;
  if (!ws) return "";

  const parts: string[] = [];

  const ds = ws.datasource;
  if (ds?.catalog && ds?.schema && ds?.default_table) {
    parts.push(`Table: \`${ds.catalog}\`.\`${ds.schema}\`.\`${ds.default_table}\``);
  }

  const cols = s.selectedOutputColumns;
  if (cols.length > 0) {
    parts.push(`Selected columns: ${cols.slice(0, 20).join(", ")}${cols.length > 20 ? ` (+${cols.length - 20} more)` : ""}`);
  }

  const activeFilters = s.appliedFilters.filter(
    (f) => f.selectedValues.length > 0 || f.dateFrom || f.numericValue != null,
  );
  if (activeFilters.length > 0) {
    const filterDesc = activeFilters.map((f) => {
      if (f.selectedValues.length > 0) {
        const vals = f.selectedValues.slice(0, 5).join(", ");
        return `${f.column} IN (${vals}${f.selectedValues.length > 5 ? ", ..." : ""})`;
      }
      if (f.dateFrom && f.dateTo) return `${f.column} BETWEEN '${f.dateFrom}' AND '${f.dateTo}'`;
      if (f.numericValue != null) return `${f.column} ${f.numericOp ?? "="} ${f.numericValue}`;
      return f.column;
    });
    parts.push(`Active filters: ${filterDesc.join("; ")}`);
  }

  const dimFilters = s.dimensionFilters.filter((f) => f.selectedValues.length > 0);
  if (dimFilters.length > 0) {
    const desc = dimFilters.map(
      (f) => `${f.column} IN (${f.selectedValues.slice(0, 5).join(", ")}${f.selectedValues.length > 5 ? ", ..." : ""})`,
    );
    parts.push(`Custom filters: ${desc.join("; ")}`);
  }

  if (ws.column_aliases && Object.keys(ws.column_aliases).length > 0) {
    const sample = Object.entries(ws.column_aliases).slice(0, 10);
    parts.push(`Column aliases: ${sample.map(([k, v]) => `${k}="${v}"`).join(", ")}`);
  }

  return parts.length > 0 ? `Context:\n${parts.join("\n")}` : "";
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const NUM_RE = /^-?[\d,]+(\.\d+)?$/;

function isNumeric(val: string): boolean {
  return NUM_RE.test(val.replace(/[$€£%,\s]/g, ""));
}

function formatCell(val: string): string {
  const stripped = val.replace(/[$€£%,\s]/g, "");
  const num = Number(stripped);
  if (!isNaN(num) && stripped !== "") {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return val;
}

function detectChartData(
  table: { columns: string[]; rows: string[][] } | undefined,
): { labels: string[]; values: number[]; labelCol: string; valueCol: string } | null {
  if (!table || table.columns.length < 2 || table.rows.length < 2 || table.rows.length > 30) return null;

  const labelIdx = table.rows[0].findIndex((_, ci) =>
    table.rows.every((r) => !isNumeric(r[ci]) || r[ci] === ""),
  );
  const valueIdx = table.rows[0].findIndex((_, ci) =>
    ci !== labelIdx && table.rows.every((r) => isNumeric(r[ci].replace(/[$€£%,\s]/g, "")) || r[ci] === ""),
  );

  if (labelIdx === -1 || valueIdx === -1) return null;

  const labels = table.rows.map((r) => r[labelIdx]);
  const values = table.rows.map((r) => {
    const s = r[valueIdx].replace(/[$€£%,\s]/g, "");
    return Number(s) || 0;
  });

  return { labels, values, labelCol: table.columns[labelIdx], valueCol: table.columns[valueIdx] };
}

/* ── Mini Chart ──────────────────────────────────────────────────── */

function GenieMiniChart({ labels, values, labelCol, valueCol }: {
  labels: string[]; values: number[]; labelCol: string; valueCol: string;
}) {
  const accentRgb = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-rgb").trim() || "99,102,241";

  const option = useMemo(() => ({
    tooltip: { trigger: "axis" as const, confine: true },
    grid: { left: 10, right: 10, top: 8, bottom: 4, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: labels,
      axisLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", rotate: labels.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: {
        fontSize: 10,
        color: "rgba(255,255,255,0.4)",
        formatter: (v: number) => {
          if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
          if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
          if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
          return String(v);
        },
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
    },
    series: [{
      type: "bar" as const,
      data: values,
      name: valueCol,
      itemStyle: {
        color: `rgba(${accentRgb}, 0.7)`,
        borderRadius: [3, 3, 0, 0],
      },
      emphasis: { itemStyle: { color: `rgba(${accentRgb}, 1)` } },
    }],
  }), [labels, values, valueCol, accentRgb]);

  return (
    <div className="genie-mini-chart">
      <div className="genie-mini-chart-header">
        <BarChart3 size={12} />
        <span>{labelCol} vs {valueCol}</span>
      </div>
      <ReactECharts option={option} style={{ height: 180, width: "100%" }} opts={{ renderer: "svg" }} />
    </div>
  );
}

/* ── SQL Block ───────────────────────────────────────────────────── */

function SqlBlock({ sql, copied, onCopy }: { sql: string; copied: boolean; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="genie-sql-section">
      <button className="genie-sql-toggle" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>Generated SQL</span>
        <button className="genie-sql-copy" onClick={(e) => { e.stopPropagation(); onCopy(); }} title="Copy SQL">
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </button>
      {open && (
        <div className="genie-sql-wrap">
          <SyntaxHighlighter
            language="sql"
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: "12px",
              borderRadius: "0 0 6px 6px",
              fontSize: "12px",
              background: "rgba(0,0,0,0.3)",
            }}
            wrapLongLines
          >
            {sql}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

/* ── Data Table ──────────────────────────────────────────────────── */

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  const colIsNumeric = useMemo(
    () => columns.map((_, ci) => rows.length > 0 && rows.every((r) => isNumeric(r[ci]) || r[ci] === "")),
    [columns, rows],
  );

  return (
    <div className="genie-mini-table">
      <table>
        <thead>
          <tr>
            {columns.map((c, ci) => (
              <th key={c} className={colIsNumeric[ci] ? "genie-col-num" : ""}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={colIsNumeric[ci] ? "genie-col-num" : ""}>
                  {colIsNumeric[ci] ? formatCell(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length > 20 && (
            <tr>
              <td colSpan={columns.length} className="genie-table-more">
                +{rows.length - 20} more rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */

export default function GenieChat() {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const spaceId = activeWorkspace?.ai_settings?.zenieEndpoint ?? "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    if (!spaceId) {
      toast.error("Genie Space ID not configured. Check workspace AI settings.");
      return;
    }

    const userMsg: ChatMessage = {
      id: `genie-u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    scrollToBottom();

    try {
      const context = buildContext();
      const resp: GenieResponse = await askGenie(
        spaceId,
        text,
        context,
        conversationIdRef.current ?? undefined,
      );

      conversationIdRef.current = resp.conversation_id;

      const botMsg: ChatMessage = {
        id: `genie-a-${Date.now()}`,
        role: "assistant",
        content: resp.text || (resp.status === "FAILED" ? "Sorry, I couldn't process that question." : "Here are the results:"),
        sql: resp.sql ?? undefined,
        miniTable:
          resp.columns && resp.rows
            ? { columns: resp.columns, rows: resp.rows.map((r) => r.map((c) => String(c ?? ""))) }
            : undefined,
        timestamp: new Date(),
        error: resp.status === "FAILED",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `genie-e-${Date.now()}`,
        role: "assistant",
        content: err instanceof Error ? err.message : "Failed to reach Genie. Please try again.",
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
  }, [input, isTyping, spaceId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    conversationIdRef.current = null;
  };

  const copySql = (sql: string) => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopiedSql(sql);
      setTimeout(() => setCopiedSql(null), 2000);
    });
  };

  const suggestions = useMemo(() => {
    const ws = activeWorkspace;
    const table = ws?.datasource?.default_table ?? "your data";
    return [
      `Show top 5 categories by revenue`,
      `What trends do you see in ${table}?`,
      `Summarize the data with key metrics`,
    ];
  }, [activeWorkspace]);

  return (
    <div className="ai-chat genie-chat">
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon genie-icon">
              <Sparkles size={40} strokeWidth={1.2} />
            </div>
            <h2>Genie</h2>
            <p>
              Ask questions in plain English and I'll query your data directly.
              {spaceId
                ? " I generate SQL, fetch results, and show insights."
                : " Configure a Genie Space ID in workspace settings to get started."}
            </p>
            {spaceId && (
              <div className="ai-chat-suggestions">
                {suggestions.map((s) => (
                  <button key={s} className="ai-chat-suggestion" onClick={() => setInput(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => {
          const chartData = msg.miniTable ? detectChartData(msg.miniTable) : null;
          return (
            <div key={msg.id} className={`ai-chat-msg ai-chat-msg--${msg.role}${msg.error ? " ai-chat-msg--error" : ""}`}>
              <div className="ai-chat-msg-avatar">
                {msg.role === "user" ? <User size={16} /> : <Database size={16} />}
              </div>
              <div className="ai-chat-msg-bubble">
                {msg.role === "assistant" ? (
                  <div className="ai-chat-msg-content genie-md">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="ai-chat-msg-content">{msg.content}</div>
                )}
                {msg.sql && (
                  <SqlBlock sql={msg.sql} copied={copiedSql === msg.sql} onCopy={() => copySql(msg.sql!)} />
                )}
                {chartData && (
                  <GenieMiniChart
                    labels={chartData.labels}
                    values={chartData.values}
                    labelCol={chartData.labelCol}
                    valueCol={chartData.valueCol}
                  />
                )}
                {msg.miniTable && (
                  <DataTable columns={msg.miniTable.columns} rows={msg.miniTable.rows} />
                )}
                <span className="ai-chat-msg-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="ai-chat-msg ai-chat-msg--assistant">
            <div className="ai-chat-msg-avatar"><Database size={16} /></div>
            <div className="ai-chat-msg-bubble ai-chat-typing">
              <Table2 size={14} className="spin" style={{ opacity: 0.5 }} />
              <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>Querying your data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-chat-input-bar">
        {messages.length > 0 && (
          <button className="genie-new-chat" onClick={handleNewChat} title="Start new conversation">
            <RotateCcw size={14} />
          </button>
        )}
        <textarea
          className="ai-chat-input"
          placeholder={spaceId ? "Ask Genie about your data..." : "Configure Genie Space ID first..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!spaceId}
        />
        <button className="ai-chat-send genie-send" onClick={handleSend} disabled={!input.trim() || isTyping || !spaceId}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
