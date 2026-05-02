import {
  Home, PanelLeft, Filter, CaseSensitive, Columns3, Database,
  Save, Table, Download, Layers, BarChart3, Keyboard, Network,
} from "lucide-react";
import type { DocSection } from "./adminGuide";

function DocImg({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="doc-figure">
      <img src={src} alt={alt} className="doc-img" loading="lazy" />
      {caption && <figcaption className="doc-caption">{caption}</figcaption>}
    </figure>
  );
}

export function userSections(): DocSection[] {
  return [
    {
      id: "u-getting-started",
      icon: <Home size={16} />,
      title: "Getting Started",
      content: (
        <>
          <p>
            When you open the app, you land on the <strong>Home Page</strong>. Here you see all the
            workspaces that have been set up for your team. Each workspace card shows the workspace name,
            description, and the data source it connects to.
          </p>
          <h4>Launching a workspace</h4>
          <ol>
            <li>Find the workspace you want to use</li>
            <li>Click the <strong>Launch</strong> button on its card</li>
            <li>The workspace opens with the data tab, sidebar, and filter bar ready to use</li>
          </ol>
          <DocImg src="/docs/screenshots/user-home.png" alt="Home page" caption="The home page with workspace cards" />
        </>
      ),
    },
    {
      id: "u-layout",
      icon: <PanelLeft size={16} />,
      title: "Workspace Layout",
      content: (
        <>
          <p>
            Once inside a workspace, the screen is divided into three areas:
          </p>
          <table className="doc-table">
            <thead><tr><th>Area</th><th>Location</th><th>What it contains</th></tr></thead>
            <tbody>
              <tr><td><strong>Sidebar</strong></td><td>Left panel</td><td>Available columns grouped by category, hierarchies overview, custom dimensions you can drag in</td></tr>
              <tr><td><strong>Filters</strong></td><td>Top of main area</td><td>Active filter chips — click to open, drag new ones from sidebar</td></tr>
              <tr><td><strong>Data Area</strong></td><td>Center</td><td>Data table, pivot view, charts, or dashboard depending on the active tab</td></tr>
            </tbody>
          </table>
          <DocImg src="/docs/screenshots/user-layout.png" alt="Workspace layout" caption="Sidebar, filter bar, and data area" />
        </>
      ),
    },
    {
      id: "u-filters",
      icon: <Filter size={16} />,
      title: "Using Filters",
      content: (
        <>
          <p>
            Filters narrow down the data before loading. There are several filter types depending on
            the column&apos;s data type:
          </p>
          <table className="doc-table">
            <thead><tr><th>Filter type</th><th>Used for</th><th>How it works</th></tr></thead>
            <tbody>
              <tr><td><strong>Value list</strong></td><td>String columns</td><td>Search and select one or more values from a dropdown</td></tr>
              <tr><td><strong>Date range</strong></td><td>Date columns</td><td>Pick a start and end date, or use relative presets (Last 7 days, etc.)</td></tr>
              <tr><td><strong>Numeric range</strong></td><td>Numeric columns</td><td>Set operators like &gt; 0, between 100–500, etc.</td></tr>
              <tr><td><strong>Free text</strong></td><td>Configured string columns</td><td>Type or paste values, supports wildcards (<code>*</code>)</td></tr>
            </tbody>
          </table>
          <h4>Adding a filter</h4>
          <ol>
            <li>Find the column in the <strong>sidebar</strong></li>
            <li><strong>Drag</strong> it onto the filter bar at the top</li>
            <li>Click the filter chip to open its popover and select values</li>
          </ol>
          <h4>Removing a filter</h4>
          <p>
            Click the <strong>×</strong> button on any filter chip to remove it. For optional custom
            dimensions, you can also drag them back to the sidebar.
          </p>
          <DocImg src="/docs/screenshots/user-filters.png" alt="Filter bar" caption="Active filters with value selection" />
        </>
      ),
    },
    {
      id: "u-free-text",
      icon: <CaseSensitive size={16} />,
      title: "Free-Text Filters",
      content: (
        <>
          <p>
            Some columns are configured for <strong>free-text search</strong> instead of a dropdown.
            When you drag these into the filter bar, you get a text area instead of a value list.
          </p>
          <h4>How to use</h4>
          <ul>
            <li>Type or paste values — <strong>one per line</strong> or <strong>comma-separated</strong></li>
            <li>Use <code>*</code> as a wildcard: <code>ABC*</code> (starts with), <code>*XYZ</code> (ends with), <code>*MID*</code> (contains)</li>
            <li>Click the <strong>?</strong> button for a help panel with wildcard examples</li>
            <li>Toggle the <strong>Aa</strong> button to switch between case-sensitive and case-insensitive matching</li>
          </ul>
          <div className="doc-tip">
            <strong>Tip:</strong> Free-text filters are great for product codes, order IDs, or any column
            where you know the exact values you&apos;re looking for.
          </div>
          <DocImg src="/docs/screenshots/user-freetext.png" alt="Free-text filter" caption="Free-text filter with wildcard help" />
        </>
      ),
    },
    {
      id: "u-columns",
      icon: <Columns3 size={16} />,
      title: "Selecting Columns",
      content: (
        <>
          <p>
            Choose which columns appear in the data table using the <strong>column picker</strong>.
          </p>
          <h4>Opening the column picker</h4>
          <p>
            Click the <strong>Columns</strong> button above the data table to open the column selector modal.
          </p>
          <h4>Adding and removing columns</h4>
          <ul>
            <li>Click a column in the <strong>Available</strong> list to add it to your selection</li>
            <li>Click the <strong>×</strong> on a selected column to remove it</li>
            <li>Drag selected columns to <strong>reorder</strong> them</li>
          </ul>
          <h4>Aggregations</h4>
          <p>
            Numeric columns show their aggregation (SUM, AVG, COUNT, etc.) next to the name.
            You can change the aggregation in the column picker by clicking the dropdown on a selected column.
          </p>
          <DocImg src="/docs/screenshots/user-column-picker.png" alt="Column picker" caption="Selecting and reordering columns" />
        </>
      ),
    },
    {
      id: "u-loading-data",
      icon: <Database size={16} />,
      title: "Loading Data",
      content: (
        <>
          <p>
            After setting your filters and columns, click the <strong>Load Data</strong> button
            to execute the query and display results in the data table.
          </p>
          <h4>What you see</h4>
          <ul>
            <li><strong>Row count</strong> — shown in the toolbar, telling you how many rows matched</li>
            <li><strong>Data table</strong> — sortable columns, paginated results</li>
            <li><strong>SQL preview</strong> — click to see the exact SQL query that was generated</li>
          </ul>
          <h4>Sorting</h4>
          <p>
            Click any <strong>column header</strong> to sort ascending. Click again for descending.
            A third click removes the sort.
          </p>
          <DocImg src="/docs/screenshots/user-data-table.png" alt="Data table" caption="Loaded data with sorting and pagination" />
        </>
      ),
    },
    {
      id: "u-presets",
      icon: <Save size={16} />,
      title: "Presets",
      content: (
        <>
          <p>
            Presets save your <strong>current view</strong> — filters, selected columns, sort order,
            and aggregations — so you can reload the same configuration later with one click.
          </p>
          <h4>Saving a preset</h4>
          <ol>
            <li>Set up your filters, columns, and sort order</li>
            <li>Click the <strong>Save Preset</strong> button in the preset bar</li>
            <li>Give your preset a name and save</li>
          </ol>
          <h4>Loading a preset</h4>
          <p>
            Click any preset name in the <strong>preset bar</strong> to instantly restore its
            filters, columns, and sort settings.
          </p>
          <h4>Sharing presets</h4>
          <p>
            Presets are shared across all users of the workspace. Anyone who has access to
            the workspace can see and load presets created by others.
          </p>
          <DocImg src="/docs/screenshots/user-presets.png" alt="Preset bar" caption="Saving and loading presets" />
        </>
      ),
    },
    {
      id: "u-pivot",
      icon: <Table size={16} />,
      title: "Pivot Table",
      content: (
        <>
          <p>
            The <strong>Pivot</strong> tab lets you create pivot table views of your data — similar to
            Excel pivot tables.
          </p>
          <h4>How to use</h4>
          <ol>
            <li>Switch to the <strong>Pivot</strong> tab</li>
            <li>Drag fields from the <strong>Fields</strong> panel into <strong>Rows</strong>, <strong>Columns</strong>, and <strong>Values</strong></li>
            <li>Choose an aggregation (SUM, AVG, COUNT, etc.) and number format for each value field</li>
            <li>Results update automatically as you configure</li>
          </ol>
          <h4>Features</h4>
          <ul>
            <li><strong>Grand totals</strong> — toggle on/off with the Totals checkbox</li>
            <li><strong>Heatmap</strong> — color-code cells by value intensity</li>
            <li><strong>Export</strong> — download the pivot results as CSV</li>
            <li><strong>Drill-down</strong> — if hierarchies are configured, click row values to drill deeper (see Hierarchies section)</li>
          </ul>
          <DocImg src="/docs/screenshots/user-pivot.png" alt="Pivot table" caption="Pivot table configuration and results" />
        </>
      ),
    },
    {
      id: "u-hierarchies",
      icon: <Network size={16} />,
      title: "Hierarchies & Drill-Down",
      content: (
        <>
          <p>
            Some workspaces include <strong>dimension hierarchies</strong> — predefined drill paths
            that let you explore data from broad to specific (e.g., Country → Region → City).
          </p>
          <h4>How to know hierarchies exist</h4>
          <ul>
            <li>
              The <strong>sidebar</strong> shows a collapsible <strong>Hierarchies</strong> section with
              a purple icon. Expand it to see all defined hierarchies and their levels.
            </li>
            <li>
              Individual columns that belong to a hierarchy have a <strong>purple left border</strong> and
              a small network icon. Hover over them to see which hierarchy they belong to.
            </li>
          </ul>
          <h4>Drill-down in pivot tables</h4>
          <ul>
            <li>When a row field belongs to a hierarchy, its values appear in <strong>accent color</strong> and are clickable</li>
            <li>Click a value to <strong>drill down</strong> — the pivot switches to the next level, filtered to that value</li>
            <li>Use the <strong>breadcrumb bar</strong> above the pivot to see your current drill path and navigate back up</li>
            <li>Click the <strong>Reset</strong> button to clear all drill filters and return to the top level</li>
            <li>Use the <strong>↘</strong> (drill down) and <strong>↖</strong> (drill up) buttons next to fields for manual navigation</li>
          </ul>
          <h4>Drill-down in charts</h4>
          <ul>
            <li>Click a <strong>bar or data point</strong> in a chart to drill into that specific value</li>
            <li>A <strong>breadcrumb trail</strong> appears showing your drill path with a Reset button</li>
            <li>Hover over the chart to reveal drill-up/down buttons for the X-axis field</li>
          </ul>
          <div className="doc-tip">
            <strong>Tip:</strong> Drill-down and filter cascading work together. When you drill from
            Country to Region, the data is automatically filtered to show only the regions within
            the selected country.
          </div>
        </>
      ),
    },
    {
      id: "u-export",
      icon: <Download size={16} />,
      title: "Exporting Data",
      content: (
        <>
          <p>
            You can export the currently loaded data to a <strong>CSV file</strong> for use in
            Excel, Google Sheets, or other tools.
          </p>
          <h4>How to export</h4>
          <ol>
            <li>Load your data with the desired filters and columns</li>
            <li>Click the <strong>Export CSV</strong> button in the toolbar</li>
            <li>The file downloads to your browser&apos;s default download folder</li>
          </ol>
          <div className="doc-tip">
            <strong>Note:</strong> The export uses the same filters and columns as your current view.
            If you need different data, adjust your filters before exporting.
          </div>
        </>
      ),
    },
    {
      id: "u-custom-dims",
      icon: <Layers size={16} />,
      title: "Custom Filters",
      content: (
        <>
          <p>
            Some workspaces include <strong>custom dimensions</strong> — additional filter categories
            that don&apos;t come from the main data table (e.g. region lists, business hierarchies).
          </p>
          <h4>Required dimensions</h4>
          <p>
            These appear directly in the <strong>filter bar</strong> and must be filled in before
            loading data. They&apos;re marked as required by the workspace administrator.
          </p>
          <h4>Optional dimensions</h4>
          <p>
            These appear in the <strong>sidebar</strong> under the "Custom Filters" category.
            Drag them onto the filter bar when you need them, and remove them by clicking the <strong>×</strong>.
          </p>
          <DocImg src="/docs/screenshots/user-dimensions.png" alt="Custom dimensions" caption="Required and optional custom dimensions" />
        </>
      ),
    },
    {
      id: "u-charts",
      icon: <BarChart3 size={16} />,
      title: "Charts & Dashboards",
      content: (
        <>
          <p>
            If the workspace has <strong>dashboarding</strong> enabled, you can visualize your data
            using charts and KPI cards.
          </p>
          <h4>Available chart types</h4>
          <ul>
            <li><strong>Bar chart</strong> — compare values across categories</li>
            <li><strong>Line chart</strong> — show trends over time</li>
            <li><strong>Pie / Area / Scatter</strong> — additional visualization options</li>
            <li><strong>KPI cards</strong> — highlight key metrics with numeric summaries</li>
          </ul>
          <p>
            Charts use the same filters as the data tab, so changing filters updates both
            the table and charts. If hierarchies are configured, you can click data points
            to drill down into more detailed views (see <strong>Hierarchies &amp; Drill-Down</strong>).
          </p>
          <DocImg src="/docs/screenshots/user-charts.png" alt="Charts" caption="Dashboard with charts and KPI cards" />
        </>
      ),
    },
    {
      id: "u-tips",
      icon: <Keyboard size={16} />,
      title: "Tips & Shortcuts",
      content: (
        <>
          <table className="doc-table">
            <thead><tr><th>Action</th><th>How</th></tr></thead>
            <tbody>
              <tr><td>Quick-filter a column</td><td>Drag it from the sidebar to the filter bar</td></tr>
              <tr><td>Sort data</td><td>Click any column header in the data table</td></tr>
              <tr><td>Clear all filters</td><td>Click the <strong>Clear All</strong> button in the filter bar</td></tr>
              <tr><td>Reorder columns</td><td>Drag selected columns in the column picker</td></tr>
              <tr><td>Switch views</td><td>Use the <strong>Data</strong> / <strong>Pivot</strong> / <strong>Dashboard</strong> tabs</td></tr>
              <tr><td>Save your view</td><td>Click <strong>Save Preset</strong> to save filters + columns</td></tr>
              <tr><td>Go back to home</td><td>Click the <strong>logo</strong> or team name in the top nav</td></tr>
            </tbody>
          </table>
          <div className="doc-tip">
            <strong>Pro tip:</strong> Use presets to save views you use frequently. Share useful
            presets with your team — everyone in the workspace can see them!
          </div>
        </>
      ),
    },
  ];
}
