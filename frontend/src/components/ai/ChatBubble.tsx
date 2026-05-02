import { useState, useRef, useEffect } from "react";
import { Bot, X, Minus } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import AiInsightsPanel from "./AiInsightsPanel";

export default function ChatBubble() {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const aiEnabled = (activeWorkspace?.capabilities ?? []).includes("ai_insights");
  const hasOptions = (activeWorkspace?.ai_settings?.options ?? []).length > 0;

  useEffect(() => {
    if (!aiEnabled) setOpen(false);
  }, [aiEnabled]);

  if (!aiEnabled || !hasOptions) return null;

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          className="chat-fab"
          onClick={() => { setOpen(true); setMinimized(false); }}
          title="AI Assistant"
        >
          <Bot size={22} />
          <span className="chat-fab-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`chat-panel${minimized ? " chat-panel--minimized" : ""}`}
          ref={panelRef}
        >
          <div className="chat-panel-header">
            <Bot size={16} />
            <span className="chat-panel-title">AI Assistant</span>
            <div className="chat-panel-header-actions">
              <button
                className="chat-panel-btn"
                onClick={() => setMinimized(!minimized)}
                title={minimized ? "Expand" : "Minimize"}
              >
                <Minus size={14} />
              </button>
              <button
                className="chat-panel-btn"
                onClick={() => setOpen(false)}
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {!minimized && (
            <div className="chat-panel-body">
              <AiInsightsPanel />
            </div>
          )}
        </div>
      )}
    </>
  );
}
