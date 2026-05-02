import { useRef, useState } from "react";
import { Send, Sparkles, User, Database, Table2 } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  miniTable?: { columns: string[]; rows: string[][] };
  timestamp: Date;
}

const MOCK_RESPONSES: Omit<ChatMessage, "id" | "timestamp">[] = [
  {
    role: "assistant",
    content: "Here are the **top 5 regions** by total sales for the current quarter:",
    sql: "SELECT region, SUM(sales) AS total_sales\nFROM published_analytics.orders\nGROUP BY region\nORDER BY total_sales DESC\nLIMIT 5;",
    miniTable: {
      columns: ["Region", "Total Sales"],
      rows: [["North America", "$2.4M"], ["EMEA", "$1.8M"], ["APAC", "$1.2M"], ["LATAM", "$680K"], ["MEA", "$320K"]],
    },
  },
  {
    role: "assistant",
    content: "The **return rate** spiked last week. Here's the daily breakdown:",
    sql: "SELECT date, COUNT(*) AS returns, ROUND(COUNT(*) * 100.0 / total_orders, 2) AS return_pct\nFROM published_analytics.returns r\nJOIN published_analytics.orders o USING (order_date)\nWHERE date >= CURRENT_DATE - INTERVAL 7 DAYS\nGROUP BY date;",
    miniTable: {
      columns: ["Date", "Returns", "Return %"],
      rows: [["Apr 11", "142", "3.2%"], ["Apr 12", "189", "4.1%"], ["Apr 13", "312", "7.8%"], ["Apr 14", "287", "6.5%"], ["Apr 15", "201", "4.6%"]],
    },
  },
  {
    role: "assistant",
    content: "Your **customer_email** column has the most null values. Here's the data quality summary:",
    sql: "SELECT column_name,\n       COUNT(*) - COUNT(column_value) AS null_count,\n       ROUND((COUNT(*) - COUNT(column_value)) * 100.0 / COUNT(*), 1) AS null_pct\nFROM published_analytics.customers\nUNPIVOT (column_value FOR column_name IN (email, phone, address))\nGROUP BY column_name\nORDER BY null_count DESC;",
    miniTable: {
      columns: ["Column", "Nulls", "Null %"],
      rows: [["email", "1,240", "4.2%"], ["phone", "890", "3.0%"], ["address", "312", "1.1%"]],
    },
  },
  {
    role: "assistant",
    content: "The **Electronics** category drives the most revenue. Full category breakdown:",
    sql: "SELECT category, SUM(revenue) AS total_rev,\n       ROUND(SUM(revenue) * 100.0 / SUM(SUM(revenue)) OVER (), 1) AS pct\nFROM published_analytics.products\nGROUP BY category\nORDER BY total_rev DESC;",
  },
  {
    role: "assistant",
    content: "I found **2 duplicate order IDs** in the recent batch. You may want to investigate.",
    sql: "SELECT order_id, COUNT(*) AS cnt\nFROM published_analytics.orders\nWHERE created_at >= CURRENT_DATE - INTERVAL 7 DAYS\nGROUP BY order_id\nHAVING cnt > 1;",
    miniTable: {
      columns: ["Order ID", "Count"],
      rows: [["ORD-99281", "2"], ["ORD-99455", "3"]],
    },
  },
];

export default function GenieChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const responseIdx = useRef(0);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `genie-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    scrollToBottom();

    setTimeout(() => {
      const mock = MOCK_RESPONSES[responseIdx.current % MOCK_RESPONSES.length];
      responseIdx.current++;
      const botMsg: ChatMessage = {
        ...mock,
        id: `genie-${Date.now()}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, 1500 + Math.random() * 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-chat genie-chat">
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon genie-icon">
              <Sparkles size={40} strokeWidth={1.2} />
            </div>
            <h2>Genie</h2>
            <p>Ask questions in plain English and I'll query your data directly. I generate SQL, fetch results, and show insights.</p>
            <div className="ai-chat-suggestions">
              {["Show top 5 regions by sales", "What's my return rate this week?", "Find duplicate orders"].map((s) => (
                <button key={s} className="ai-chat-suggestion" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-chat-msg ai-chat-msg--${msg.role}`}>
            <div className="ai-chat-msg-avatar">
              {msg.role === "user" ? <User size={16} /> : <Database size={16} />}
            </div>
            <div className="ai-chat-msg-bubble">
              <div className="ai-chat-msg-content">{msg.content}</div>
              {msg.sql && (
                <pre className="genie-sql-block"><code>{msg.sql}</code></pre>
              )}
              {msg.miniTable && (
                <div className="genie-mini-table">
                  <table>
                    <thead>
                      <tr>{msg.miniTable.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {msg.miniTable.rows.map((row, ri) => (
                        <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <span className="ai-chat-msg-time">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
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
        <textarea
          className="ai-chat-input"
          placeholder="Ask Genie about your data..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className="ai-chat-send genie-send" onClick={handleSend} disabled={!input.trim() || isTyping}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
