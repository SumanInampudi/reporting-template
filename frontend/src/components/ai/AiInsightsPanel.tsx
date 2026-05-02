import { useMemo, useState } from "react";
import { MessageSquare, Sparkles, SearchCode } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import LlmChat from "./LlmChat";
import GenieChat from "./GenieChat";
import RcaAgent from "./RcaAgent";
import type { AiInsightsOption } from "@/types/dashboard";

interface SubTab {
  id: AiInsightsOption;
  label: string;
  icon: typeof MessageSquare;
  component: React.FC;
}

const ALL_SUB_TABS: SubTab[] = [
  { id: "llm_connection", label: "LLM", icon: MessageSquare, component: LlmChat },
  { id: "zenie_space", label: "Genie", icon: Sparkles, component: GenieChat },
  { id: "root_cause_analysis", label: "RCA", icon: SearchCode, component: RcaAgent },
];

export default function AiInsightsPanel() {
  const { activeWorkspace } = useStore();

  const enabledTabs = useMemo(() => {
    const opts = new Set<AiInsightsOption>(
      (activeWorkspace?.ai_settings?.options ?? []) as AiInsightsOption[],
    );
    return ALL_SUB_TABS.filter((t) => opts.has(t.id));
  }, [activeWorkspace]);

  const [activeSubTab, setActiveSubTab] = useState<AiInsightsOption | null>(null);

  const current = enabledTabs.find((t) => t.id === activeSubTab) ?? enabledTabs[0] ?? null;
  const ActiveComponent = current?.component ?? null;

  if (enabledTabs.length === 0) {
    return (
      <div className="ai-insights-empty">
        <SearchCode size={40} strokeWidth={1} />
        <h3>No AI features enabled</h3>
        <p>Enable LLM, Genie, or RCA in your workspace settings to get started.</p>
      </div>
    );
  }

  return (
    <div className="ai-insights-panel">
      {enabledTabs.length > 1 && (
        <div className="ai-sub-tabs">
          {enabledTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = current?.id === tab.id;
            return (
              <button
                key={tab.id}
                className={`ai-sub-tab${isActive ? " ai-sub-tab--active" : ""}`}
                onClick={() => setActiveSubTab(tab.id)}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="ai-sub-content">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
