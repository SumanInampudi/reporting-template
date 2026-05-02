import { useRef, useState } from "react";
import { Send, Bot, User, MessageSquare } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const MOCK_RESPONSES = [
  "Based on the data in your workspace, total revenue increased **12.3%** quarter over quarter. The biggest contributor was the **Electronics** category.",
  "I found **3 anomalies** in the last 30 days of data:\n- Spike in returns on March 15\n- Unusual drop in traffic on March 22\n- Order volume 2x normal on March 28",
  "Here's a summary of your top 5 products by revenue:\n1. **Widget Pro** — $124,500\n2. **Gadget Plus** — $98,200\n3. **Smart Sensor** — $87,300\n4. **DataHub** — $76,100\n5. **CloudSync** — $65,400",
  "The correlation between marketing spend and sales is **0.87** (strong positive). I recommend increasing budget allocation for the **Social** channel which shows the highest ROI.",
  "Your data quality score is **94%**. I detected **12 null values** in the `customer_email` column and **3 duplicate rows** in the orders table.",
];

export default function LlmChat() {
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
      id: `llm-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    scrollToBottom();

    setTimeout(() => {
      const response = MOCK_RESPONSES[responseIdx.current % MOCK_RESPONSES.length];
      responseIdx.current++;
      const botMsg: ChatMessage = {
        id: `llm-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, 1200 + Math.random() * 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon">
              <MessageSquare size={40} strokeWidth={1.2} />
            </div>
            <h2>LLM Assistant</h2>
            <p>Have a natural language conversation. Ask questions, get summaries, request explanations — powered by your connected LLM.</p>
            <div className="ai-chat-suggestions">
              {["Summarize my data", "Explain this trend", "What should I investigate?"].map((s) => (
                <button key={s} className="ai-chat-suggestion" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-chat-msg ai-chat-msg--${msg.role}`}>
            <div className="ai-chat-msg-avatar">
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="ai-chat-msg-bubble">
              <div className="ai-chat-msg-content">{msg.content}</div>
              <span className="ai-chat-msg-time">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="ai-chat-msg ai-chat-msg--assistant">
            <div className="ai-chat-msg-avatar"><Bot size={16} /></div>
            <div className="ai-chat-msg-bubble ai-chat-typing">
              <span className="ai-chat-typing-dot" />
              <span className="ai-chat-typing-dot" />
              <span className="ai-chat-typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-chat-input-bar">
        <textarea
          className="ai-chat-input"
          placeholder="Ask the LLM anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className="ai-chat-send" onClick={handleSend} disabled={!input.trim() || isTyping}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
