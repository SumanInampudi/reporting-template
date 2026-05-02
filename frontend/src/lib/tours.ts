import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_PREFIX = "tour-completed-";

function hasCompleted(tourId: string): boolean {
  return localStorage.getItem(`${TOUR_PREFIX}${tourId}`) === "true";
}

function markCompleted(tourId: string) {
  localStorage.setItem(`${TOUR_PREFIX}${tourId}`, "true");
}

export function resetTour(tourId: string) {
  localStorage.removeItem(`${TOUR_PREFIX}${tourId}`);
}

function runTour(tourId: string, steps: DriveStep[], overrides?: Partial<Config>) {
  const d = driver({
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayColor: "rgba(0, 0, 0, 0.6)",
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: "app-tour-popover",
    ...overrides,
    onDestroyStarted: () => {
      markCompleted(tourId);
      d.destroy();
    },
  });
  d.setSteps(steps);
  d.drive();
  return d;
}

// ── Home Page Tour ──────────────────────────────

const HOME_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to BI Excellence! 🎉",
      description: "Let's take a quick tour to help you get started. You can replay this anytime from the help button.",
    },
  },
  {
    element: ".home-nav-brand",
    popover: {
      title: "Your Platform",
      description: "This is your team's analytics platform name. Admins can change it from Settings.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".home-nav-new-btn",
    popover: {
      title: "Create a Workspace",
      description: "Click here to set up a new workspace. A wizard will guide you through connecting to your data, selecting columns, and choosing capabilities.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: ".lp-search-wrap",
    popover: {
      title: "Search Workspaces",
      description: "Quickly find a workspace by typing part of its name.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".lp-cap-filters",
    popover: {
      title: "Filter by Capability",
      description: "Filter workspaces by their capabilities — Explorer, Dashboard, or AI.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: ".lp-sort-wrap",
    popover: {
      title: "Sort Workspaces",
      description: "Sort alphabetically or by recently opened.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: ".lp-tile-wrap:first-child .lp-tile",
    popover: {
      title: "Workspace Tiles",
      description: "Each tile represents a workspace. Click to see details, launch, edit, clone, or delete. The colored dots show enabled capabilities.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: ".home-theme-toggle",
    popover: {
      title: "Light / Dark Mode",
      description: "Toggle between light and dark themes for the home page.",
      side: "left",
      align: "center",
    },
  },
];

export function startHomeTour(force = false) {
  if (!force && hasCompleted("home")) return null;
  const availableSteps = HOME_STEPS.filter(
    (s) => !s.element || document.querySelector(s.element as string),
  );
  if (availableSteps.length < 2) return null;
  return runTour("home", availableSteps);
}

// ── Workspace App Tour ──────────────────────────

const WORKSPACE_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to Your Workspace!",
      description: "Here's a quick overview of the workspace tools available to you.",
    },
  },
  {
    element: ".sidebar-resizable, .sidebar",
    popover: {
      title: "Column Sidebar",
      description: "Browse your data columns here. Drag columns to the filter bar, KPI strip, or directly onto charts.",
      side: "right",
      align: "start",
    },
  },
  {
    element: ".main-tabs",
    popover: {
      title: "Capability Tabs",
      description: "Switch between Data Explorer, Dashboard, and AI tabs depending on your workspace's capabilities.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".main-tab--focus",
    popover: {
      title: "Focus Mode",
      description: "Press F11 or click here for a distraction-free view. The sidebar and header collapse to maximize your workspace.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: ".preset-bar, .preset-bar-wrap",
    popover: {
      title: "Presets",
      description: "Save and switch between different configurations of filters, columns, and dashboard layouts. Your admin can set a default preset for everyone.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".ws-back-btn",
    popover: {
      title: "Back to Home",
      description: "Click here to return to the workspace launcher. Unsaved changes will prompt you before leaving.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".status-bar",
    popover: {
      title: "Status Bar",
      description: "Shows your current data source, active filters, and row counts at a glance.",
      side: "top",
      align: "center",
    },
  },
  {
    element: ".chat-bubble-btn",
    popover: {
      title: "AI Assistant",
      description: "Click the chat bubble to ask questions about your data, get AI-powered analysis, or run root cause analysis.",
      side: "left",
      align: "end",
    },
  },
];

export function startWorkspaceTour(force = false) {
  if (!force && hasCompleted("workspace")) return null;
  const availableSteps = WORKSPACE_STEPS.filter(
    (s) => !s.element || document.querySelector(s.element as string),
  );
  if (availableSteps.length < 2) return null;
  return runTour("workspace", availableSteps);
}

// ── Setup Wizard Tour ───────────────────────────

const WIZARD_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Setup Wizard",
      description: "This wizard walks you through creating a workspace in 5 easy steps. Let's see what each step does.",
    },
  },
  {
    element: ".wizard-steps",
    popover: {
      title: "Progress Steps",
      description: "Track your progress here. Click any completed step to go back and make changes.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: ".wizard-body",
    popover: {
      title: "Configuration Area",
      description: "Each step has its own form. Fill in the details and click Next to proceed.",
      side: "top",
      align: "center",
    },
  },
  {
    element: ".wizard-skip-btn",
    popover: {
      title: "Skip Ahead",
      description: "If you've configured the data connection, you can skip straight to the Save step. You can always come back to edit later.",
      side: "top",
      align: "start",
    },
  },
  {
    element: ".wizard-footer",
    popover: {
      title: "Navigation",
      description: "Use Back and Next to move between steps. The Save button appears on the final step.",
      side: "top",
      align: "end",
    },
  },
];

export function startWizardTour(force = false) {
  if (!force && hasCompleted("wizard")) return null;
  const availableSteps = WIZARD_STEPS.filter(
    (s) => !s.element || document.querySelector(s.element as string),
  );
  if (availableSteps.length < 2) return null;
  return runTour("wizard", availableSteps);
}

// ── Data Explorer Tour ──────────────────────────

const DATA_TAB_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Data Explorer",
      description: "Explore your data, apply filters, choose columns, and preview results. Here's a quick guide.",
    },
  },
  {
    element: ".sidebar-resizable",
    popover: {
      title: "Column Browser",
      description: "All available columns from your data source appear here. Drag them to the filter bar to create filters, or use the column selector to choose which to display.",
      side: "right",
      align: "start",
    },
  },
  {
    element: ".dt-filter-grid, .dt-filter-empty",
    popover: {
      title: "Filters",
      description: "Drag columns here from the sidebar, or click '+ Add Filter' to filter your data. Combine multiple filters to narrow results.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".csm-card",
    popover: {
      title: "Output Columns",
      description: "Choose which columns appear in your data preview. Click to open the full column selector with search, reordering, and bulk actions.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: ".data-tab-actionbar",
    popover: {
      title: "Action Bar",
      description: "Run your query, download results as CSV or Excel, and see the generated SQL. The row count shows how many records matched.",
      side: "top",
      align: "center",
    },
  },
];

export function startDataTabTour(force = false) {
  if (!force && hasCompleted("data-tab")) return null;
  const availableSteps = DATA_TAB_STEPS.filter(
    (s) => !s.element || document.querySelector(s.element as string),
  );
  if (availableSteps.length < 2) return null;
  return runTour("data-tab", availableSteps);
}

// ── Dashboard Tour ──────────────────────────────

const DASHBOARD_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Dashboard Builder",
      description: "Build KPI cards, charts, and pivot tables to visualize your data. Let's see the key areas.",
    },
  },
  {
    element: ".kpi-strip",
    popover: {
      title: "KPI Strip",
      description: "Drag numeric columns from the sidebar here to create KPI metric cards. Each card shows an aggregated value (SUM, AVG, COUNT, etc.).",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: ".chart-type-grid",
    popover: {
      title: "Chart Palette",
      description: "Drag a chart type onto the canvas to create a new visualization. Bar, line, pie, scatter, area, heatmap, and more are available.",
      side: "right",
      align: "start",
    },
  },
  {
    element: ".canvas-grid, .canvas-drop-zone",
    popover: {
      title: "Chart Canvas",
      description: "Your charts and pivot tables live here. Drag columns onto charts to bind data. Resize and rearrange widgets by dragging their edges.",
      side: "left",
      align: "start",
    },
  },
  {
    element: ".sidebar-section:first-child",
    popover: {
      title: "Design Panel",
      description: "When on the Dashboard tab, the sidebar switches to chart types and design options. Drag chart types to the canvas to add visualizations.",
      side: "right",
      align: "start",
    },
  },
];

export function startDashboardTour(force = false) {
  if (!force && hasCompleted("dashboard")) return null;
  const availableSteps = DASHBOARD_STEPS.filter(
    (s) => !s.element || document.querySelector(s.element as string),
  );
  if (availableSteps.length < 2) return null;
  return runTour("dashboard", availableSteps);
}
