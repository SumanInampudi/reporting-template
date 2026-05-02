import { useState } from "react";
import {
  SearchCode, Play, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, TrendingDown, ArrowRight,
} from "lucide-react";

type AgentStatus = "idle" | "running" | "complete";

interface AgentStep {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "running" | "done";
}

interface Finding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  metric: string;
  impact: string;
}

const MOCK_STEPS: Omit<AgentStep, "status">[] = [
  { id: "s1", label: "Fetching baseline metrics", detail: "Comparing current period vs previous 30-day window" },
  { id: "s2", label: "Detecting anomalies", detail: "Running statistical outlier detection on 14 metrics" },
  { id: "s3", label: "Analyzing dimensions", detail: "Drill-down across Region, Product, Channel, Segment" },
  { id: "s4", label: "Correlating events", detail: "Checking deployment logs, campaigns, and external data" },
  { id: "s5", label: "Generating root cause report", detail: "Ranking contributing factors by impact score" },
];

const MOCK_FINDINGS: Finding[] = [
  {
    id: "f1", severity: "high",
    title: "EMEA region revenue dropped 23%",
    description: "Supply chain disruption in Central Europe caused delayed shipments. 68% of EMEA orders were affected between Apr 5–12.",
    metric: "Revenue (EMEA)", impact: "-$420K vs baseline",
  },
  {
    id: "f2", severity: "medium",
    title: "Paid Search conversion rate declined 18%",
    description: "Landing page A/B test (variant B) went live Apr 8 with a broken CTA button on mobile. Mobile traffic accounts for 62% of Paid Search.",
    metric: "Conversion Rate (Paid Search)", impact: "-1.4pp (5.2% → 3.8%)",
  },
  {
    id: "f3", severity: "low",
    title: "Seasonal dip in Accessories category",
    description: "Historical pattern shows 10–15% drop in Accessories every April. Current decline of 12% is within expected range.",
    metric: "Units Sold (Accessories)", impact: "-8K units (expected)",
  },
];

const SEVERITY_COLORS: Record<string, string> = {
  high: "#ef4444", medium: "#f59e0b", low: "#6b7280",
};

export default function RcaAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [query, setQuery] = useState("");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const runInvestigation = () => {
    const text = query.trim();
    if (!text) return;

    setStatus("running");
    setFindings([]);
    setExpandedFinding(null);

    const initialSteps = MOCK_STEPS.map((s, i) => ({
      ...s,
      status: (i === 0 ? "running" : "pending") as AgentStep["status"],
    }));
    setSteps(initialSteps);

    MOCK_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, j) => ({
            ...s,
            status: j < i + 1 ? "done" : j === i + 1 ? "running" : s.status,
          })) as AgentStep[],
        );

        if (i === MOCK_STEPS.length - 1) {
          setTimeout(() => {
            setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
            setFindings(MOCK_FINDINGS);
            setStatus("complete");
          }, 800);
        }
      }, (i + 1) * 1400);
    });
  };

  const toggleFinding = (id: string) => {
    setExpandedFinding((prev) => (prev === id ? null : id));
  };

  return (
    <div className="rca-agent">
      {/* Trigger area */}
      <div className="rca-trigger">
        <div className="rca-trigger-header">
          <SearchCode size={20} />
          <div>
            <h3 className="rca-trigger-title">Root Cause Analysis</h3>
            <p className="rca-trigger-desc">Describe a metric change or anomaly and the agent will investigate automatically.</p>
          </div>
        </div>
        <div className="rca-trigger-input-row">
          <input
            className="rca-trigger-input"
            placeholder="e.g. Revenue dropped 15% last week — why?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runInvestigation()}
            disabled={status === "running"}
          />
          <button
            className="rca-trigger-btn"
            onClick={runInvestigation}
            disabled={!query.trim() || status === "running"}
          >
            {status === "running"
              ? <><Loader2 size={14} className="spin" /> Investigating...</>
              : <><Play size={14} /> Investigate</>}
          </button>
        </div>
      </div>

      {/* Agent timeline */}
      {steps.length > 0 && (
        <div className="rca-timeline">
          <h4 className="rca-section-title">Agent Progress</h4>
          <div className="rca-steps">
            {steps.map((step) => (
              <div key={step.id} className={`rca-step rca-step--${step.status}`}>
                <div className="rca-step-icon">
                  {step.status === "done" && <CheckCircle2 size={16} />}
                  {step.status === "running" && <Loader2 size={16} className="spin" />}
                  {step.status === "pending" && <div className="rca-step-dot" />}
                </div>
                <div className="rca-step-body">
                  <span className="rca-step-label">{step.label}</span>
                  <span className="rca-step-detail">{step.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div className="rca-findings">
          <h4 className="rca-section-title">
            <AlertTriangle size={16} /> Findings ({findings.length})
          </h4>
          <div className="rca-finding-list">
            {findings.map((f) => {
              const expanded = expandedFinding === f.id;
              return (
                <div key={f.id} className={`rca-finding rca-finding--${f.severity}`}>
                  <button className="rca-finding-header" onClick={() => toggleFinding(f.id)}>
                    <span className="rca-finding-severity" style={{ background: SEVERITY_COLORS[f.severity] }}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className="rca-finding-title">{f.title}</span>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expanded && (
                    <div className="rca-finding-body">
                      <p className="rca-finding-desc">{f.description}</p>
                      <div className="rca-finding-metrics">
                        <div className="rca-finding-metric">
                          <TrendingDown size={14} />
                          <span><strong>Metric:</strong> {f.metric}</span>
                        </div>
                        <div className="rca-finding-metric">
                          <ArrowRight size={14} />
                          <span><strong>Impact:</strong> {f.impact}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Idle state */}
      {status === "idle" && steps.length === 0 && (
        <div className="rca-idle-hint">
          <SearchCode size={32} strokeWidth={1} />
          <p>Enter a question above and hit <strong>Investigate</strong> to start the analysis agent.</p>
        </div>
      )}
    </div>
  );
}
