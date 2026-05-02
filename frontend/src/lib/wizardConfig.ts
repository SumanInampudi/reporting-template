import { Database, BarChart3, Brain, Link2, Sparkles, SearchCode, Gauge, Table2 } from "lucide-react";
import type { AiInsightsOption, Capability, DashboardingFeature, SelfServiceFeature } from "@/types/dashboard";

/* ── Capability tiles ────────────────────────────── */

export interface CapabilityOption {
  id: Capability;
  label: string;
  desc: string;
  icon: typeof Database;
  available: boolean;
}

export const CAPABILITIES: CapabilityOption[] = [
  {
    id: "self_service", label: "Self-Service Data",
    desc: "Explore, filter, create formulas & export your data",
    icon: Database, available: true,
  },
  {
    id: "dashboarding", label: "Dashboarding",
    desc: "Build interactive charts and visual dashboards",
    icon: BarChart3, available: true,
  },
  {
    id: "ai_insights", label: "AI Insights",
    desc: "Ask natural language questions about your data",
    icon: Brain, available: true,
  },
];

/* ── Self-service feature toggles ────────────────── */

export interface FeatureToggle {
  id: SelfServiceFeature;
  label: string;
  disabled?: boolean;
}

export const SELF_SERVICE_FEATURES: FeatureToggle[] = [
  { id: "download_data", label: "Download Data (CSV)" },
  { id: "custom_columns", label: "Custom Columns (Formulas)" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "presets", label: "Presets" },
];

/* ── Dashboarding feature toggles ─────────────────── */

export interface DashFeatureToggle {
  id: DashboardingFeature;
  label: string;
  icon: typeof Database;
  disabled?: boolean;
}

export const DASHBOARDING_FEATURES: DashFeatureToggle[] = [
  { id: "kpi_metrics", label: "KPI Metrics", icon: Gauge },
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "pivot_table", label: "Pivot Table", icon: Table2 },
];

/* ── AI Insights options ─────────────────────────── */

export interface AiOptionConfig {
  id: AiInsightsOption;
  label: string;
  desc: string;
  icon: typeof Link2;
  endpointLabel: string;
  endpointPlaceholder: string;
}

export const AI_OPTIONS: AiOptionConfig[] = [
  {
    id: "llm_connection", label: "LLM",
    desc: "Natural language conversation powered by an external LLM",
    icon: Link2,
    endpointLabel: "LLM Endpoint URL",
    endpointPlaceholder: "https://api.openai.com/v1/chat/completions",
  },
  {
    id: "zenie_space", label: "Genie",
    desc: "Natural language conversation with your data via Genie AI",
    icon: Sparkles,
    endpointLabel: "Genie Endpoint URL",
    endpointPlaceholder: "https://genie.databricks.com/api/v1",
  },
  {
    id: "root_cause_analysis", label: "RCA",
    desc: "Root Cause Analysis — agentic investigation of anomalies & metric changes",
    icon: SearchCode,
    endpointLabel: "RCA Endpoint URL",
    endpointPlaceholder: "https://rca.example.com/api/v1/analyze",
  },
];
