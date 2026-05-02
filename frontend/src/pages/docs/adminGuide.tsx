import type { ReactNode } from "react";
import {
  BookOpen, Database, Type, Sigma, FolderOpen, Layers,
  Workflow, CaseSensitive, FileText, Settings, Copy, Monitor, Terminal,
} from "lucide-react";

export interface DocSection {
  id: string;
  icon: ReactNode;
  title: string;
  content: ReactNode;
}

function DocImg({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="doc-figure">
      <img src={src} alt={alt} className="doc-img" loading="lazy" />
      {caption && <figcaption className="doc-caption">{caption}</figcaption>}
    </figure>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="doc-kbd">{children}</kbd>;
}

export function adminSections(): DocSection[] {
  return [
    {
      id: "overview",
      icon: <BookOpen size={16} />,
      title: "Overview",
      content: (
        <>
          <p>
            The <strong>Setup Wizard</strong> is where administrators configure workspaces.
            A workspace defines everything an end-user needs: which data to connect to,
            how columns appear, which filters are available, and what capabilities are enabled.
          </p>
          <p>The wizard has <strong>4 steps</strong>:</p>
          <ol>
            <li><strong>Connection</strong> — Select catalog, schema, and table from Databricks Unity Catalog</li>
            <li><strong>Columns</strong> — Configure display names, data types, aggregations, grouping, custom filters, hierarchies &amp; cascading, and joins across 6 tabs</li>
            <li><strong>Capabilities</strong> — Enable features like self-service analytics, dashboarding, and AI insights</li>
            <li><strong>Save</strong> — Name the workspace, choose an accent color, and review the configuration</li>
          </ol>
          <p>
            Service-principal credentials for SP fallback are configured once per environment in
            <code> databricks.yml</code> — see <em>Deployment to Databricks → Secret Scope Setup</em>.
          </p>
          <DocImg src="/docs/screenshots/wizard-overview.png" alt="Setup Wizard overview" caption="The Setup Wizard with all four steps" />
        </>
      ),
    },
    {
      id: "connection",
      icon: <Database size={16} />,
      title: "Step 1 — Connection",
      content: (
        <>
          <p>
            Select the data source for this workspace by navigating through the Unity Catalog hierarchy:
          </p>
          <ol>
            <li>Pick a <strong>Catalog</strong> (e.g. <code>analytics_prod</code>)</li>
            <li>Pick a <strong>Schema</strong> (e.g. <code>sales</code>)</li>
            <li>Pick a <strong>Table</strong> (e.g. <code>order_summary</code>)</li>
          </ol>
          <h4>Row Limit</h4>
          <p>
            Optionally set a maximum row limit. When set, queries that would exceed this limit
            are blocked with a friendly message asking users to refine their filters.
            Set to <code>0</code> for no limit.
          </p>
          <DocImg src="/docs/screenshots/step-connection.png" alt="Connection step" caption="Navigating catalog → schema → table" />
        </>
      ),
    },
    {
      id: "col-display",
      icon: <Type size={16} />,
      title: "Columns — Display Names",
      content: (
        <>
          <p>
            The <strong>Display Names</strong> tab controls how column names appear to end-users throughout the tool.
            The underlying SQL queries always use the original column names.
          </p>
          <h4>Alias Strategies</h4>
          <table className="doc-table">
            <thead><tr><th>Strategy</th><th>What it does</th><th>Example</th></tr></thead>
            <tbody>
              <tr><td>Title Case</td><td>Removes underscores, capitalizes each word</td><td><code>order_mgmt_qty</code> → <code>Order Mgmt Qty</code></td></tr>
              <tr><td>Smart Abbreviate</td><td>Applies your abbreviation dictionary to shorten names</td><td><code>order_management_quantity</code> → <code>Order Mgmt Qty</code></td></tr>
              <tr><td>Keep Original</td><td>Uses raw column names as-is</td><td><code>order_mgmt_qty</code> → <code>order_mgmt_qty</code></td></tr>
            </tbody>
          </table>
          <h4>Column Visibility</h4>
          <p>
            Click the <strong>eye icon</strong> to hide columns you don't want users to see.
            Hidden columns won't appear in the column picker or sidebar.
          </p>
          <h4>Data Type Override</h4>
          <p>
            Change a column's effective data type using the <strong>Data Type</strong> dropdown.
            This controls how the UI treats the column (filter type, aggregation defaults, sidebar grouping)
            but does not apply a SQL <code>CAST()</code>. Overridden types appear with an orange highlight.
            Click the reset icon to revert.
          </p>
          <h4>Free Text Filter</h4>
          <p>
            For <strong>string columns</strong>, check the <strong>Free Text</strong> checkbox to enable
            free-text search mode. When a user drags this column into the filter bar, instead of a dropdown
            with value selection, they get a text area where they can:
          </p>
          <ul>
            <li>Type or paste one or multiple values (one per line, or comma-separated)</li>
            <li>Use <code>*</code> as a wildcard (e.g. <code>ABC*</code> matches "ABC123", <code>*XYZ</code> matches "FGHXYZ")</li>
            <li>Toggle case sensitivity with the <Kbd>Aa</Kbd> button (case-insensitive by default)</li>
          </ul>
          <DocImg src="/docs/screenshots/tab-display-names.png" alt="Display Names tab" caption="Alias strategy, visibility toggles, type overrides, and free text" />
        </>
      ),
    },
    {
      id: "col-agg",
      icon: <Sigma size={16} />,
      title: "Columns — Aggregations",
      content: (
        <>
          <p>
            Configure <strong>default aggregation functions</strong> for numeric (measure) columns.
            When users load data, each measure is wrapped in its configured aggregation
            (e.g. <code>SUM(amount)</code>), and Databricks uses <code>GROUP BY ALL</code> for grouping.
          </p>
          <h4>Available Aggregations</h4>
          <table className="doc-table">
            <thead><tr><th>Aggregation</th><th>SQL Generated</th></tr></thead>
            <tbody>
              <tr><td>SUM</td><td><code>SUM(`col`)</code></td></tr>
              <tr><td>AVG</td><td><code>AVG(`col`)</code></td></tr>
              <tr><td>COUNT</td><td><code>COUNT(`col`)</code></td></tr>
              <tr><td>COUNT DISTINCT</td><td><code>COUNT(DISTINCT `col`)</code></td></tr>
              <tr><td>MIN</td><td><code>MIN(`col`)</code></td></tr>
              <tr><td>MAX</td><td><code>MAX(`col`)</code></td></tr>
              <tr><td>NONE</td><td>No aggregation — column is used as raw <code>SELECT `col`</code></td></tr>
            </tbody>
          </table>
          <p>
            Numeric columns default to <strong>SUM</strong> unless they match patterns like
            "pct", "percent", "ratio", "rate", "avg", or "mean". Use the bulk buttons to quickly
            set all measures to the same aggregation.
          </p>
          <DocImg src="/docs/screenshots/tab-aggregations.png" alt="Aggregations tab" caption="Setting default aggregation per measure column" />
        </>
      ),
    },
    {
      id: "col-grouping",
      icon: <FolderOpen size={16} />,
      title: "Columns — Grouping",
      content: (
        <>
          <p>
            Control how columns are organized in the <strong>sidebar</strong> and <strong>column picker</strong>.
          </p>
          <h4>Grouping Modes</h4>
          <table className="doc-table">
            <thead><tr><th>Mode</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>Measures & Dimensions</td><td>Auto-splits by data type: numeric → Measures, string/date → Dimensions</td></tr>
              <tr><td>Custom Groups</td><td>Define your own groups with regex patterns (e.g. <code>^sales_</code>, <code>_amt$</code>)</td></tr>
              <tr><td>Flat List</td><td>No grouping — all columns in a single list</td></tr>
            </tbody>
          </table>
          <DocImg src="/docs/screenshots/tab-grouping.png" alt="Grouping tab" caption="Custom column groups with pattern matching" />
        </>
      ),
    },
    {
      id: "col-dimensions",
      icon: <Layers size={16} />,
      title: "Columns — Custom Filters",
      content: (
        <>
          <p>
            Custom dimensions are supplemental filter sources that don't come from the main table.
            They're useful for reference data like region lists, product catalogs, or business hierarchies.
          </p>
          <h4>Source Types</h4>
          <table className="doc-table">
            <thead><tr><th>Type</th><th>Description</th><th>Example</th></tr></thead>
            <tbody>
              <tr><td>Static</td><td>Hard-coded list of values defined in the wizard</td><td>Region: NA, EMEA, APAC</td></tr>
              <tr><td>Query</td><td>Custom SQL query that returns a value/label pair</td><td><code>SELECT code, name FROM regions</code></td></tr>
              <tr><td>Table</td><td>Pick from a table in Unity Catalog, choose value and display columns</td><td>Table: <code>dim_product</code>, Value: <code>id</code>, Label: <code>name</code></td></tr>
            </tbody>
          </table>
          <h4>Required vs Optional</h4>
          <ul>
            <li><strong>Required</strong> — Always visible in the Filters section. Users must make a selection before loading data.</li>
            <li><strong>Optional</strong> — Appears in the sidebar under "Custom Filters". Users drag them to the filter bar when needed.</li>
          </ul>
          <h4>Performance Tip</h4>
          <p>
            If the table has <strong>partition columns</strong>, the wizard shows a banner suggesting you create
            mandatory filters for them. This helps queries run faster by leveraging partition pruning.
          </p>
          <DocImg src="/docs/screenshots/tab-custom-dims.png" alt="Custom Filters tab" caption="Defining custom filter sources" />
        </>
      ),
    },
    {
      id: "col-hierarchies",
      icon: <Workflow size={16} />,
      title: "Columns — Hierarchies & Cascading",
      content: (
        <>
          <p>
            The <strong>Hierarchies &amp; Cascading</strong> tab combines two related features:
            drill-down hierarchies and filter cascading rules.
          </p>
          <h4>Hierarchies</h4>
          <p>
            Define drill-down hierarchies for your dimensions. Each hierarchy is an ordered chain of columns
            from broadest to most specific (e.g., Country → Region → City).
          </p>
          <ol>
            <li>Click <strong>Add Hierarchy</strong> and give it a name (e.g., &quot;Geography&quot;)</li>
            <li>Add levels from broadest to most specific, selecting a column for each</li>
            <li>Reorder levels with the up/down buttons if needed</li>
            <li>Click <strong>Preview</strong> to see a sample tree of values from the database</li>
          </ol>
          <h4>What hierarchies enable at runtime</h4>
          <ul>
            <li><strong>Drill-down in pivot tables</strong> — users click row values to drill from Country → Region → City</li>
            <li><strong>Drill-down in charts</strong> — users click bars/data points to drill deeper</li>
            <li><strong>Breadcrumb navigation</strong> — shows the current drill path with clickable levels to navigate back up</li>
            <li><strong>Sidebar indicators</strong> — columns that belong to a hierarchy show a purple icon and left border</li>
            <li><strong>Hierarchy overview</strong> — a collapsible &quot;Hierarchies&quot; group appears in the sidebar showing all defined hierarchies and their levels</li>
          </ul>
          <h4>Auto-generated cascade rules</h4>
          <p>
            When you create a hierarchy with 2+ levels, cascade rules are <strong>automatically generated</strong>
            for each adjacent pair (e.g., Country → Region, Region → City). These appear as read-only rules
            in the Cascade Rules section below the hierarchies.
          </p>
          <p>
            Each hierarchy has an <strong>&quot;Auto-generate cascade filter rules&quot;</strong> checkbox (on by default).
            Uncheck it if you don&apos;t want cascading behavior for that hierarchy.
          </p>
          <h4>Additional cascade rules</h4>
          <p>
            Expand the <strong>Cascade Rules</strong> section at the bottom to see all rules. You can also
            add <strong>manual cascade rules</strong> for relationships not covered by hierarchies, such as:
          </p>
          <ul>
            <li>Cascading between custom dimension sources</li>
            <li>Cross-hierarchy relationships (e.g., Division → Product Line)</li>
            <li>Rules involving lookup table dimensions with link columns</li>
          </ul>
          <div className="doc-tip">
            <strong>Example:</strong> Country → State → City. When the user picks &quot;USA&quot; in Country,
            State only shows US states, and City only shows cities in the selected state.
          </div>
        </>
      ),
    },
    {
      id: "col-freetext",
      icon: <CaseSensitive size={16} />,
      title: "Free-Text Filters",
      content: (
        <>
          <p>
            Free-text filters let users type or paste values instead of selecting from a pre-loaded list.
            This is ideal for high-cardinality string columns like product codes or customer IDs
            where the dropdown would be impractically large.
          </p>
          <h4>Configuration</h4>
          <p>
            In the <strong>Display Names</strong> tab, check the <strong>Free Text</strong> checkbox
            for any string column that should use this mode. No additional setup is required.
          </p>
          <h4>User Experience</h4>
          <p>When a user drags a free-text column into the filter bar, they see:</p>
          <ul>
            <li>A <strong>text area</strong> where they enter values (one per line or comma-separated)</li>
            <li>A <strong>wildcard help panel</strong> (<code>?</code> button) explaining <code>*</code> syntax</li>
            <li>A <strong>case-sensitivity toggle</strong> (<Kbd>Aa</Kbd>) — case-insensitive by default</li>
          </ul>
          <h4>Wildcard Syntax</h4>
          <table className="doc-table">
            <thead><tr><th>Pattern</th><th>Matches</th><th>SQL Generated</th></tr></thead>
            <tbody>
              <tr><td><code>ABC*</code></td><td>Starts with "ABC"</td><td><code>UPPER(`col`) LIKE 'ABC%'</code></td></tr>
              <tr><td><code>*XYZ</code></td><td>Ends with "XYZ"</td><td><code>UPPER(`col`) LIKE '%XYZ'</code></td></tr>
              <tr><td><code>*MID*</code></td><td>Contains "MID"</td><td><code>UPPER(`col`) LIKE '%MID%'</code></td></tr>
              <tr><td><code>EXACT</code></td><td>Exact match</td><td><code>UPPER(`col`) = 'EXACT'</code></td></tr>
            </tbody>
          </table>
          <DocImg src="/docs/screenshots/freetext-filter.png" alt="Free-text filter popover" caption="The free-text filter input with wildcard help" />
        </>
      ),
    },
    {
      id: "abbreviations",
      icon: <FileText size={16} />,
      title: "Abbreviations",
      content: (
        <>
          <p>
            Each workspace has its own <strong>abbreviation dictionary</strong> used by the
            "Smart Abbreviate" alias strategy. When generating display names, the system replaces
            long words with their abbreviations.
          </p>
          <h4>Managing Abbreviations</h4>
          <p>
            Click the <strong>Manage Abbreviations</strong> button in the Display Names tab to
            open the abbreviation editor. Add, edit, or remove word → abbreviation mappings.
          </p>
          <table className="doc-table">
            <thead><tr><th>Word</th><th>Abbreviation</th></tr></thead>
            <tbody>
              <tr><td>management</td><td>Mgmt</td></tr>
              <tr><td>quantity</td><td>Qty</td></tr>
              <tr><td>number</td><td>Nbr</td></tr>
              <tr><td>amount</td><td>Amt</td></tr>
            </tbody>
          </table>
          <p>
            Abbreviations are stored per-workspace, so different workspaces can have different
            dictionaries tailored to their domain.
          </p>
          <DocImg src="/docs/screenshots/abbreviations.png" alt="Abbreviation editor" caption="Per-workspace abbreviation dictionary" />
        </>
      ),
    },
    {
      id: "capabilities",
      icon: <Settings size={16} />,
      title: "Step 3 — Capabilities",
      content: (
        <>
          <p>
            Choose which features are available to end-users in this workspace.
          </p>
          <h4>Capability Groups</h4>
          <table className="doc-table">
            <thead><tr><th>Capability</th><th>What it enables</th></tr></thead>
            <tbody>
              <tr><td>Self-Service Analytics</td><td>Data tab with filters, column selection, and data loading</td></tr>
              <tr><td>Dashboarding</td><td>Dashboard tab with KPI cards, charts, and layouts</td></tr>
              <tr><td>AI Assistant</td><td>AI-powered analysis (requires endpoint configuration)</td></tr>
            </tbody>
          </table>
          <h4>Self-Service Features</h4>
          <ul>
            <li><strong>Download Data</strong> — Allow users to export data as CSV</li>
            <li><strong>Calculated Fields</strong> — Allow users to create formula columns</li>
          </ul>
          <h4>Dashboard Features</h4>
          <ul>
            <li><strong>KPI Metrics</strong> — Summary cards with numeric aggregations</li>
            <li><strong>Charts</strong> — Interactive charts (bar, line, pie, etc.)</li>
          </ul>
          <DocImg src="/docs/screenshots/step-capabilities.png" alt="Capabilities step" caption="Selecting workspace capabilities" />
        </>
      ),
    },
    {
      id: "clone",
      icon: <Copy size={16} />,
      title: "Cloning Workspaces",
      content: (
        <>
          <p>
            You can <strong>clone</strong> an existing workspace from the home page by clicking the
            clone button on a workspace card. This copies all configuration including:
          </p>
          <ul>
            <li>Connection settings (catalog, schema, table)</li>
            <li>Column aliases, type overrides, aggregations, and visibility</li>
            <li>Custom dimensions and cascade rules</li>
            <li>Abbreviations and free-text filter settings</li>
            <li>Capabilities and features</li>
          </ul>
          <p>
            Presets are <strong>not</strong> copied — the cloned workspace starts fresh.
            After cloning, you're taken directly to the Setup Wizard to review and modify the configuration.
          </p>
        </>
      ),
    },
    {
      id: "team-setup",
      icon: <Settings size={16} />,
      title: "Team Setup & Identity",
      content: (
        <>
          <p>
            When a new team adopts this tool, they configure their identity in <strong>two files</strong>:
            <code>databricks.yml</code> (deployment) and <code>.env</code> (local dev). This section covers
            the <strong>identity</strong> values (team name, app slug). Additional infrastructure values —
            warehouse, metadata catalog/schema, and secret scope — are required before deploy and are
            covered in <strong>Deployment to Databricks</strong> below.
          </p>
          <h4>1. <code>databricks.yml</code> — Single source of truth for deployment</h4>
          <p>
            Open <code>databricks.yml</code> and find the two lines marked with ✏️ near the top:
          </p>
          <table className="doc-table">
            <thead><tr><th>Variable</th><th>What it does</th><th>Example</th></tr></thead>
            <tbody>
              <tr>
                <td><code>app_slug</code></td>
                <td>URL-safe app identifier (lowercase, hyphens only). Becomes the Databricks App name: <code>&lt;app_slug&gt;-dev</code> / <code>&lt;app_slug&gt;-prod</code></td>
                <td><code>zoom360</code>, <code>zaominout</code>, <code>emea-orderbook</code></td>
              </tr>
              <tr>
                <td><code>team_name</code></td>
                <td>Display name shown in the nav bar, hero banner, and browser tab</td>
                <td><code>ZOOM 360</code>, <code>Zaomin Out Analytics</code></td>
              </tr>
            </tbody>
          </table>
          <p>
            The <code>team_name</code> default applies to <strong>both dev and prod</strong>.
            To help users distinguish environments, override it in the <code>dev</code> target with a suffix:
          </p>
          <pre className="doc-code">{`targets:\n  dev:\n    variables:\n      team_name: "ZOOM 360 - Dev"   # only override needed\n  prod:\n    variables:\n      # inherits "ZOOM 360" from the default — no override needed`}</pre>

          <h4>2. <code>.env</code> — Local development only</h4>
          <p>
            For local development on your laptop, set <code>TEAM_NAME</code> in the <code>.env</code> file
            to match your <code>team_name</code> default from <code>databricks.yml</code>.
          </p>
          <div className="doc-tip">
            <strong>Summary:</strong> Change <code>app_slug</code> and <code>team_name</code> defaults in
            <code> databricks.yml</code>, add a &quot;- Dev&quot; override in the dev target, and set <code>TEAM_NAME</code>
            in <code>.env</code>. That&apos;s it — everything else derives automatically.
          </div>
        </>
      ),
    },
    {
      id: "local-dev",
      icon: <Monitor size={16} />,
      title: "Running Locally",
      content: (
        <>
          <p>
            For local development on your laptop, the app runs entirely outside of Databricks
            using a lightweight dev server. No deployment step is needed.
          </p>
          <h4>Setup (one time)</h4>
          <ol>
            <li>Copy the environment template: <code>cp .env.example .env</code></li>
            <li>
              Fill in your values in <code>.env</code>:
              <ul>
                <li><code>TEAM_NAME</code> — match your <code>team_name</code> from <code>databricks.yml</code></li>
                <li><code>DATABRICKS_HOST</code> — your Databricks workspace hostname</li>
                <li><code>DATABRICKS_TOKEN</code> — your personal access token</li>
                <li><code>DATABRICKS_WAREHOUSE_ID</code> — your dev SQL Warehouse ID</li>
              </ul>
            </li>
          </ol>
          <h4>Start the dev server</h4>
          <pre className="doc-code">bash deploy-local.sh</pre>
          <p>
            This starts both the <strong>Vite frontend</strong> (with hot reload) and the
            <strong> uvicorn backend</strong> in a single terminal. The app opens at{" "}
            <code>http://localhost:5173</code>.
          </p>
          <h4>How local dev differs from Databricks</h4>
          <table className="doc-table">
            <thead><tr><th>Aspect</th><th>Local dev</th><th>Databricks (dev/prod)</th></tr></thead>
            <tbody>
              <tr><td>Start command</td><td><code>bash deploy-local.sh</code></td><td><code>./deploy-databricks.sh</code> or <code>./deploy-databricks.sh prod</code></td></tr>
              <tr><td>Config source</td><td><code>.env</code> file</td><td><code>databricks.yml</code> → targets section</td></tr>
              <tr><td>Data storage</td><td>YAML files (local <code>data/</code> folder)</td><td>Delta tables (auto-created)</td></tr>
              <tr><td>Authentication</td><td>Personal access token (<code>AUTH_MODE=pat</code>)</td><td>OAuth (auto-injected by Databricks Apps)</td></tr>
              <tr><td>Frontend</td><td>Vite dev server with hot reload</td><td>Pre-built static bundle</td></tr>
            </tbody>
          </table>
          <div className="doc-tip">
            <strong>Tip:</strong> Set <code>LOCAL_TEST_MODE=true</code> in <code>.env</code> to work on
            the UI without any Databricks connection — the backend will return mock data.
          </div>
        </>
      ),
    },
    {
      id: "deployment",
      icon: <Terminal size={16} />,
      title: "Deployment to Databricks",
      content: (
        <>
          <p>
            The app is deployed to Databricks using <strong>Databricks Asset Bundles</strong>.
            All configuration lives in <code>databricks.yml</code> — no command-line flags needed.
          </p>
          <h4>Prerequisites</h4>
          <ol>
            <li>Install <strong>Databricks CLI</strong> version 0.250.0 or later</li>
            <li>Configure a CLI profile: <code>databricks configure --profile &lt;name&gt;</code></li>
            <li>
              Fill in your values in <code>databricks.yml</code>:
              <ul>
                <li><code>app_slug</code> and <code>team_name</code> (see <em>Team Setup &amp; Identity</em> above)</li>
                <li><code>warehouse_id</code> per target (dev / prod)</li>
                <li><code>app_metadata_catalog</code> and <code>app_metadata_schema</code> per target</li>
                <li><code>secret_scope</code> and <code>secret_key</code> per target — see <em>Secret Scope Setup</em> below</li>
              </ul>
            </li>
            <li>Create the secret scope(s) in Databricks and store the SP token (see below)</li>
          </ol>

          <h4>Secret Scope Setup (one-time, per environment)</h4>
          <p>
            The app uses a <strong>service-principal PAT</strong> stored in a Databricks secret scope as a
            fallback when a user's OAuth token can't query the SQL warehouse (e.g. they don't have direct
            <code> CAN_USE</code> permission), and to access metadata tables in catalogs not granted to all users.
          </p>
          <p>
            Create the scope and store the token using the Databricks CLI. Use a <strong>different scope name
            per environment</strong> (dev vs prod):
          </p>
          <pre className="doc-code">{`# Create the scope
databricks secrets create-scope your-team-secrets-non-prod

# Store the SP token under the key referenced in databricks.yml (default: sp-token)
databricks secrets put-secret your-team-secrets-non-prod sp-token
# (paste the SP PAT when prompted)

# Grant the deployed app's service principal READ access on the scope
databricks secrets put-acl your-team-secrets-non-prod <app-service-principal> READ`}</pre>
          <p>
            Then reference these scope names in <code>databricks.yml</code> under each target's
            <code> secret_scope</code> variable.
          </p>
          <h5>SP token permissions required</h5>
          <table className="doc-table">
            <thead><tr><th>Resource</th><th>Permissions</th></tr></thead>
            <tbody>
              <tr><td>Metadata catalog + schema</td><td><code>USAGE</code>, <code>CREATE TABLE</code>, <code>SELECT</code>, <code>INSERT</code>, <code>DELETE</code></td></tr>
              <tr><td>Data catalogs/schemas</td><td><code>USAGE</code>, <code>SELECT</code></td></tr>
              <tr><td>SQL Warehouse</td><td><code>CAN_USE</code></td></tr>
            </tbody>
          </table>
          <div className="doc-tip">
            <strong>Skip this step</strong> if all your users will have direct warehouse access —
            set <code>secret_scope: "none"</code> in <code>databricks.yml</code> and the app will run
            queries only as the logged-in user (no SP fallback).
          </div>

          <h4>Deploy commands</h4>
          <table className="doc-table">
            <thead><tr><th>Command</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td><code>./deploy-databricks.sh</code></td><td>Deploy and start the <strong>dev</strong> app (default target)</td></tr>
              <tr><td><code>./deploy-databricks.sh prod</code></td><td>Deploy and start the <strong>prod</strong> app</td></tr>
            </tbody>
          </table>
          <p>
            The deploy script shows real-time progress with timestamps and will report errors at each step.
          </p>
          <h4>What happens on first startup</h4>
          <ol>
            <li><strong>Frontend build</strong> — <code>npm install</code> + <code>npm run build</code></li>
            <li><strong>Backend starts</strong> — <code>uvicorn</code> launches the FastAPI server</li>
            <li><strong>Metadata tables created</strong> — 6 Delta tables are auto-created in the schema
            specified by <code>app_metadata_catalog</code> / <code>app_metadata_schema</code>:
            workspaces, presets, custom_themes, abbreviations, subscriptions, shared_formulas</li>
          </ol>
          <h4>Target-specific configuration</h4>
          <p>
            Each target (<code>dev</code> / <code>prod</code>) has its own variables in <code>databricks.yml</code>:
          </p>
          <table className="doc-table">
            <thead><tr><th>Variable</th><th>Description</th><th>Dev example</th><th>Prod example</th></tr></thead>
            <tbody>
              <tr><td><code>warehouse_id</code></td><td>SQL Warehouse ID</td><td>Your dev warehouse</td><td>Your prod warehouse</td></tr>
              <tr><td><code>app_metadata_schema</code></td><td>Schema for metadata tables</td><td><code>dev_team_app</code></td><td><code>team_app</code></td></tr>
              <tr><td><code>secret_scope</code></td><td>Secret scope for SP token</td><td><code>non-prod-scope</code></td><td><code>prod-scope</code></td></tr>
              <tr><td><code>admin_role_suffixes</code></td><td>Group suffixes granting admin</td><td><code>none</code></td><td><code>DataAdmin,ClusterAdmin</code></td></tr>
              <tr><td><code>log_level</code></td><td>Backend logging level</td><td><code>INFO</code></td><td><code>WARNING</code></td></tr>
            </tbody>
          </table>
          <div className="doc-tip">
            <strong>Key isolation:</strong> Each team uses a unique <code>app_metadata_schema</code> so workspaces,
            presets, and all configuration data are completely separate between teams — even on the same Databricks workspace.
          </div>
        </>
      ),
    },
    {
      id: "env-config",
      icon: <FileText size={16} />,
      title: "Environment Variables (.env)",
      content: (
        <>
          <p>
            The <code>.env</code> file is for <strong>local development only</strong>. In production,
            all values are injected via <code>databricks.yml</code>.
          </p>
          <table className="doc-table">
            <thead><tr><th>Variable</th><th>Description</th><th>Dev value</th><th>Prod source</th></tr></thead>
            <tbody>
              <tr><td><code>TEAM_NAME</code></td><td>Display name in header and browser tab</td><td>Your team name</td><td><code>databricks.yml</code> → <code>team_name</code></td></tr>
              <tr><td><code>LOCAL_TEST_MODE</code></td><td>Skip Databricks calls, use mock data</td><td><code>false</code></td><td>Always <code>false</code></td></tr>
              <tr><td><code>DATABRICKS_HOST</code></td><td>Workspace hostname</td><td><code>your-ws.cloud.databricks.com</code></td><td>Auto-injected by Databricks Apps</td></tr>
              <tr><td><code>DATABRICKS_TOKEN</code></td><td>Personal access token</td><td><code>dapi...</code></td><td>Not needed (OAuth)</td></tr>
              <tr><td><code>DATABRICKS_WAREHOUSE_ID</code></td><td>SQL Warehouse ID</td><td>Your dev warehouse</td><td><code>databricks.yml</code> → <code>warehouse_id</code></td></tr>
              <tr><td><code>AUTH_MODE</code></td><td>Authentication method</td><td><code>pat</code></td><td><code>oauth</code></td></tr>
              <tr><td><code>STORAGE_BACKEND</code></td><td>Persistence backend</td><td><code>yaml</code> (local files)</td><td><code>delta</code> (Delta tables)</td></tr>
              <tr><td><code>APP_METADATA_CATALOG</code></td><td>Catalog for metadata tables</td><td><code>development</code></td><td><code>databricks.yml</code> → <code>app_metadata_catalog</code></td></tr>
              <tr><td><code>APP_METADATA_SCHEMA</code></td><td>Schema for metadata tables</td><td><code>your_team_app</code></td><td><code>databricks.yml</code> → <code>app_metadata_schema</code></td></tr>
              <tr><td><code>DEFAULT_SECRET_SCOPE</code></td><td>Default scope for SP fallback</td><td>(empty or dev scope)</td><td><code>databricks.yml</code> → <code>secret_scope</code></td></tr>
              <tr><td><code>ADMIN_ROLE_SUFFIXES</code></td><td>Group suffixes granting admin</td><td>(empty = everyone)</td><td><code>databricks.yml</code> → <code>admin_role_suffixes</code></td></tr>
              <tr><td><code>ALLOWED_CATALOGS</code></td><td>Catalogs visible in wizard</td><td><code>development</code></td><td><code>databricks.yml</code> → <code>allowed_catalogs</code></td></tr>
            </tbody>
          </table>
          <div className="doc-tip">
            <strong>Tip:</strong> See <code>.env.example</code> for a fully documented template. Copy it
            to <code>.env</code> and fill in your values: <code>cp .env.example .env</code>
          </div>
        </>
      ),
    },
  ];
}
