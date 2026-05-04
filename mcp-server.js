import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const WIDGET_URI = "ui://widget/canada-open-data.html";

function escapeMarkdownCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildMarkdownTable(columns, rows) {
  // Add extra spaces for better rendering
  const header = `|  ${columns.map((column) => escapeMarkdownCell(column.label)).join("  |  ")}  |`;
  const divider = `|  ${columns
    .map((column) => (column.align === "right" ? "---:" : "---"))
    .join("  |  ")}  |`;
  const body = rows.map((row) => {
    const cells = columns.map((column) => escapeMarkdownCell(row[column.key] ?? ""));
    return `|  ${cells.join("  |  ")}  |`;
  });

  return [header, divider, ...body].join("\n");
}

function buildHtmlTable(columns, rows) {
  const thStyle =
    "padding:10px 12px;border:2px solid #333;background:#4A90E2;color:white;text-align:left;font-weight:bold;";
  const tdBaseStyle = "padding:10px 12px;border:1px solid #666;";
  const headerRow = columns
    .map((column) => `<th style="${thStyle}">${escapeHtml(column.label)}</th>`)
    .join("");
  const bodyRows = rows
    .map((row, index) => {
      const bgColor = index % 2 === 0 ? 'background:#f9f9f9;' : 'background:#ffffff;';
      const cells = columns
        .map((column) => {
          const align = column.align === "right" ? "text-align:right;" : "text-align:left;";
          return `<td style="${tdBaseStyle}${align}">${escapeHtml(row[column.key] ?? "")}</td>`;
        })
        .join("");
      return `<tr style="${bgColor}">${cells}</tr>`;
    })
    .join("");

  return [
    '<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;border:2px solid #333;">',
    `<thead><tr>${headerRow}</tr></thead>`,
    `<tbody>${bodyRows}</tbody>`,
    "</table>"
  ].join("");
}

function stripMarkdownBold(text) {
  return String(text).replaceAll("**", "");
}

function buildWidgetHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Canada Open Data Explorer</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --panel: #f7f8fa;
        --text: #18212f;
        --muted: #5d6978;
        --line: #d7dde5;
        --accent: #0f766e;
        --accent-strong: #115e59;
        --selected: #e6f4f1;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #111827;
          --panel: #172033;
          --text: #f5f7fb;
          --muted: #aab4c3;
          --line: #344154;
          --accent: #5eead4;
          --accent-strong: #99f6e4;
          --selected: #143a38;
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
      }

      button,
      input,
      select {
        font: inherit;
      }

      .app {
        min-height: 100vh;
        padding: 14px;
      }

      .toolbar {
        display: grid;
        grid-template-columns: minmax(160px, 1fr) minmax(150px, 0.75fr) 112px 116px 116px auto;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }

      .field,
      .select,
      .button {
        min-height: 38px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--bg);
        color: var(--text);
      }

      .field {
        padding: 0 11px;
      }

      .select {
        padding: 0 8px;
      }

      .button {
        padding: 0 12px;
        background: var(--accent);
        border-color: var(--accent);
        color: #ffffff;
        cursor: pointer;
        font-weight: 650;
      }

      .button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .button.secondary {
        background: var(--bg);
        border-color: var(--line);
        color: var(--text);
      }

      .summary {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        color: var(--muted);
        margin-bottom: 10px;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(240px, 34%);
        gap: 12px;
      }

      .tableWrap,
      .details {
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
        background: var(--bg);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 10px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }

      th {
        background: var(--panel);
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
        white-space: nowrap;
      }

      th button {
        all: unset;
        cursor: pointer;
      }

      tr {
        cursor: pointer;
      }

      tr:hover td,
      tr.selected td {
        background: var(--selected);
      }

      .title {
        font-weight: 700;
      }

      .muted {
        color: var(--muted);
      }

      .details {
        padding: 13px;
        min-height: 240px;
      }

      .details h2 {
        margin: 0 0 8px;
        font-size: 16px;
        line-height: 1.3;
      }

      .metaGrid {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 7px 10px;
        margin: 12px 0;
      }

      .metaGrid dt {
        color: var(--muted);
      }

      .metaGrid dd {
        margin: 0;
        overflow-wrap: anywhere;
      }

      .link {
        color: var(--accent-strong);
        font-weight: 700;
        text-decoration: none;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .smallButton {
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel);
        color: var(--text);
        cursor: pointer;
      }

      .note {
        margin: 12px 0 0;
        color: var(--muted);
        line-height: 1.45;
      }

      .empty {
        padding: 22px;
        color: var(--muted);
      }

      @media (max-width: 720px) {
        .toolbar {
          grid-template-columns: 1fr 102px;
        }

        .toolbar .button,
        .toolbar #localFilterInput {
          grid-column: 1 / -1;
        }

        .layout {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="app">
      <form class="toolbar" id="searchForm">
        <input class="field" id="queryInput" name="query" placeholder="Search datasets" autocomplete="off" />
        <input class="field" id="localFilterInput" name="localFilter" placeholder="Filter visible rows" autocomplete="off" />
        <select class="select" id="limitInput" name="limit">
          <option value="5">5 rows</option>
          <option value="10">10 rows</option>
          <option value="20">20 rows</option>
        </select>
        <select class="select" id="filterInput" name="filter">
          <option value="">All orgs</option>
        </select>
        <select class="select" id="minResourcesInput" name="minResources">
          <option value="0">Any files</option>
          <option value="1">1+ files</option>
          <option value="5">5+ files</option>
          <option value="10">10+ files</option>
        </select>
        <button class="button" id="searchButton" type="submit">Search</button>
        <button class="button secondary" id="exportButton" type="button">CSV</button>
      </form>
      <div class="summary">
        <span id="summaryText">Loading datasets...</span>
        <span id="sortText"></span>
      </div>
      <section class="layout">
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th><button type="button" data-sort="Title">Title</button></th>
                <th><button type="button" data-sort="Organization">Organization</button></th>
                <th><button type="button" data-sort="Resources">Resources</button></th>
                <th><button type="button" data-sort="Metadata Updated">Updated</button></th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
          <div class="empty" id="emptyState" hidden>No datasets match the current filter.</div>
        </div>
        <aside class="details" id="details"></aside>
      </section>
    </main>
    <script>
      const state = {
        output: null,
        rows: [],
        selectedIndex: 0,
        sortKey: "Resources",
        sortDirection: "desc",
        orgFilter: "",
        localFilter: "",
        minResources: 0
      };

      const elements = {
        form: document.getElementById("searchForm"),
        query: document.getElementById("queryInput"),
        localFilter: document.getElementById("localFilterInput"),
        limit: document.getElementById("limitInput"),
        filter: document.getElementById("filterInput"),
        minResources: document.getElementById("minResourcesInput"),
        button: document.getElementById("searchButton"),
        exportButton: document.getElementById("exportButton"),
        summary: document.getElementById("summaryText"),
        sort: document.getElementById("sortText"),
        rows: document.getElementById("rows"),
        empty: document.getElementById("emptyState"),
        details: document.getElementById("details")
      };

      function getOutput() {
        return window.openai?.toolOutput?.structuredContent || window.openai?.toolOutput || state.output || {};
      }

      function setOutput(output) {
        state.output = output || {};
        state.rows = Array.isArray(state.output.rows) ? state.output.rows : [];
        elements.query.value = state.output.query || window.openai?.toolInput?.query || "climate";
        elements.limit.value = String(window.openai?.toolInput?.limit || Math.min(Math.max(state.rows.length, 5), 20));
        state.selectedIndex = 0;
        rebuildOrganizationFilter();
        render();
      }

      function rebuildOrganizationFilter() {
        const orgs = [...new Set(state.rows.map((row) => row.Organization).filter(Boolean))].sort();
        elements.filter.innerHTML = '<option value="">All orgs</option>' + orgs
          .map((org) => '<option value="' + escapeAttribute(org) + '">' + escapeHtml(org) + '</option>')
          .join("");
        elements.filter.value = state.orgFilter;
      }

      function getVisibleRows() {
        const needle = state.localFilter.trim().toLowerCase();
        const filtered = state.rows.filter((row) => {
          const matchesOrg = !state.orgFilter || row.Organization === state.orgFilter;
          const matchesResources = Number(row.Resources || 0) >= state.minResources;
          const haystack = [
            row.Title,
            row.Organization,
            row["Dataset ID"],
            row.Notes,
            row.License,
            row.Formats
          ].join(" ").toLowerCase();
          const matchesText = !needle || haystack.includes(needle);
          return matchesOrg && matchesResources && matchesText;
        });

        return filtered.sort((a, b) => {
          const left = a[state.sortKey] ?? "";
          const right = b[state.sortKey] ?? "";
          const value = typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
          return state.sortDirection === "asc" ? value : -value;
        });
      }

      function render() {
        const visibleRows = getVisibleRows();
        const total = state.output?.total ?? state.rows.length;
        const query = state.output?.query || elements.query.value || "current query";
        elements.summary.textContent = visibleRows.length + " shown from " + state.rows.length + " loaded row(s), " + total + " total result(s) for " + query;
        elements.sort.textContent = "Sorted by " + state.sortKey + " " + state.sortDirection;
        elements.empty.hidden = visibleRows.length > 0;

        elements.rows.innerHTML = visibleRows.map((row, index) => {
          const selected = index === state.selectedIndex ? " selected" : "";
          return '<tr class="' + selected + '" data-index="' + index + '">' +
            '<td><div class="title">' + escapeHtml(row.Title) + '</div><div class="muted">' + escapeHtml(row["Dataset ID"]) + '</div></td>' +
            '<td>' + escapeHtml(row.Organization || "Unknown") + '</td>' +
            '<td>' + escapeHtml(row.Resources) + '</td>' +
            '<td>' + escapeHtml(row["Metadata Updated"] || "") + '</td>' +
          '</tr>';
        }).join("");

        renderDetails(visibleRows[state.selectedIndex] || visibleRows[0]);
      }

      function renderDetails(row) {
        if (!row) {
          elements.details.innerHTML = '<div class="muted">Select a dataset to inspect it.</div>';
          return;
        }

        const datasetUrl = "https://open.canada.ca/data/en/dataset/" + encodeURIComponent(row["Dataset ID"]);
        const note = row.Notes ? '<p class="note">' + escapeHtml(truncateText(row.Notes, 420)) + '</p>' : "";
        elements.details.innerHTML =
          '<h2>' + escapeHtml(row.Title) + '</h2>' +
          '<dl class="metaGrid">' +
            '<dt>Organization</dt><dd>' + escapeHtml(row.Organization || "Unknown") + '</dd>' +
            '<dt>Resources</dt><dd>' + escapeHtml(row.Resources) + '</dd>' +
            '<dt>Updated</dt><dd>' + escapeHtml(row["Metadata Updated"] || "Unknown") + '</dd>' +
            '<dt>Formats</dt><dd>' + escapeHtml(row.Formats || "Unknown") + '</dd>' +
            '<dt>License</dt><dd>' + escapeHtml(row.License || "Unknown") + '</dd>' +
            '<dt>ID</dt><dd>' + escapeHtml(row["Dataset ID"]) + '</dd>' +
          '</dl>' +
          note +
          '<div class="actions">' +
            '<a class="link" href="' + datasetUrl + '" target="_blank" rel="noreferrer">Open dataset</a>' +
            '<button class="smallButton" type="button" id="copyIdButton">Copy ID</button>' +
          '</div>';

        document.getElementById("copyIdButton")?.addEventListener("click", async () => {
          try {
            await navigator.clipboard?.writeText(row["Dataset ID"]);
            elements.summary.textContent = "Copied dataset ID: " + row["Dataset ID"];
          } catch (error) {
            elements.summary.textContent = "Dataset ID: " + row["Dataset ID"];
          }
        });
      }

      function truncateText(value, maxLength) {
        const text = String(value || "").replace(/\\s+/g, " ").trim();
        return text.length > maxLength ? text.slice(0, maxLength - 1) + "..." : text;
      }

      function toCsv(rows) {
        const headers = ["Title", "Organization", "Resources", "Metadata Updated", "Dataset ID", "Formats", "License"];
        const escapeCsv = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
        return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\\n");
      }

      function downloadCsv() {
        const csv = toCsv(getVisibleRows());
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "canada-open-data-results.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function escapeHtml(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function escapeAttribute(value) {
        return escapeHtml(value);
      }

      elements.rows.addEventListener("click", (event) => {
        const row = event.target.closest("tr[data-index]");
        if (!row) return;
        state.selectedIndex = Number(row.dataset.index);
        render();
      });

      document.querySelectorAll("[data-sort]").forEach((button) => {
        button.addEventListener("click", () => {
          const nextKey = button.dataset.sort;
          if (state.sortKey === nextKey) {
            state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
          } else {
            state.sortKey = nextKey;
            state.sortDirection = nextKey === "Resources" ? "desc" : "asc";
          }
          state.selectedIndex = 0;
          render();
        });
      });

      elements.filter.addEventListener("change", () => {
        state.orgFilter = elements.filter.value;
        state.selectedIndex = 0;
        render();
      });

      elements.localFilter.addEventListener("input", () => {
        state.localFilter = elements.localFilter.value;
        state.selectedIndex = 0;
        render();
      });

      elements.minResources.addEventListener("change", () => {
        state.minResources = Number(elements.minResources.value || 0);
        state.selectedIndex = 0;
        render();
      });

      elements.exportButton.addEventListener("click", downloadCsv);

      elements.form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!window.openai?.callTool) {
          elements.summary.textContent = "This host does not expose interactive tool calls from widgets.";
          return;
        }

        elements.button.disabled = true;
        elements.button.textContent = "Searching...";
        try {
          const result = await window.openai.callTool("queryOpenDatabase", {
            databaseId: "canada_open_data",
            query: elements.query.value || "climate",
            limit: Number(elements.limit.value || 10)
          });
          setOutput(result?.structuredContent || result);
        } catch (error) {
          elements.summary.textContent = "Search failed: " + (error?.message || "Unknown error");
        } finally {
          elements.button.disabled = false;
          elements.button.textContent = "Search";
        }
      });

      window.addEventListener("openai:set_globals", () => {
        setOutput(getOutput());
      });

      setOutput(getOutput());
    </script>
  </body>
</html>`;
}

function getOrganizationTitle(dataset) {
  return (
    dataset.organization?.title ||
    dataset.organization?.name ||
    dataset.author ||
    dataset.maintainer ||
    ""
  );
}

async function fetchCanadaOpenDataDatasets({ query = "climate", limit = 10 }) {
  const requestedLimit = Math.max(1, Math.min(limit, 20));
  const endpoint = new URL("https://open.canada.ca/data/api/3/action/package_search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("rows", String(requestedLimit));

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Canada Open Data API request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.success) {
    throw new Error("Canada Open Data API returned an unsuccessful response.");
  }

  const datasets = Array.isArray(payload.result?.results) ? payload.result.results : [];
  const rows = datasets
    .slice(0, requestedLimit)
    .map((dataset) => ({
      title: dataset.title || dataset.name || "",
      organization: getOrganizationTitle(dataset),
      resourceCount: Array.isArray(dataset.resources) ? dataset.resources.length : 0,
      metadataUpdated: dataset.metadata_modified || dataset.revision_timestamp || "",
      datasetId: dataset.name || dataset.id || "",
      formats: Array.isArray(dataset.resources)
        ? [
            ...new Set(
              dataset.resources
                .map((resource) => resource.format || resource.mimetype || "")
                .filter(Boolean)
            )
          ].join(", ")
        : "",
      license: dataset.license_title || dataset.license_id || "",
      notes: dataset.notes || ""
    }));

  return {
    source: "Government of Canada Open Data Portal",
    endpoint: endpoint.toString(),
    query,
    total: payload.result?.count ?? rows.length,
    rows
  };
}

export function createMcpStoreServer() {
  const server = new McpServer({
    name: "open-database-mcp-server",
    version: "1.0.0",
    description: "MCP server for querying live open databases."
  });

  server.registerResource(
    "canada-open-data-widget",
    WIDGET_URI,
    {
      title: "Canada Open Data Explorer",
      description: "Interactive table for searching, filtering, sorting, and inspecting Canada Open Data results.",
      mimeType: "text/html+skybridge"
    },
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: "text/html+skybridge",
          text: buildWidgetHtml(),
          _meta: {
            "openai/widgetDescription":
              "An interactive explorer for Canada Open Data datasets with search, filtering, sorting, and row details.",
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": {
              connect_domains: ["https://open.canada.ca"],
              resource_domains: []
            }
          }
        }
      ]
    })
  );

  server.registerTool(
    "queryOpenDatabase",
    {
      title: "Query Canada Open Data",
      description:
        "Searches the Government of Canada Open Data portal and renders an interactive dataset explorer widget.",
      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        "openai/toolInvocation/invoking": "Searching Canada Open Data...",
        "openai/toolInvocation/invoked": "Canada Open Data results ready.",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true
      },
      inputSchema: {
      databaseId: z
        .literal("canada_open_data")
        .default("canada_open_data")
        .describe("Open database identifier. Currently supports only canada_open_data."),
      query: z
        .string()
        .trim()
        .min(1)
        .default("climate")
        .describe("Search text for Canada Open Data datasets, e.g. climate, housing, health."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
      }
    },
    async ({ query, limit }) => {
      try {
        const result = await fetchCanadaOpenDataDatasets({
          query,
          limit
        });
        const tableRows = result.rows.map((row) => ({
          Title: row.title,
          Organization: row.organization,
          Resources: row.resourceCount,
          "Metadata Updated": row.metadataUpdated,
          "Dataset ID": row.datasetId,
          Formats: row.formats,
          License: row.license,
          Notes: row.notes
        }));
        const columns = [
          { key: "Title", label: "Title", align: "left" },
          { key: "Organization", label: "Organization", align: "left" },
          { key: "Resources", label: "Resources", align: "right" },
          { key: "Metadata Updated", label: "Metadata Updated", align: "left" },
          { key: "Dataset ID", label: "Dataset ID", align: "left" }
        ];
        const markdownTable = buildMarkdownTable(columns, tableRows);
        const htmlTable = buildHtmlTable(columns, tableRows);
        const title =
          tableRows.length > 0
            ? `**Canada Open Data results for "${query}"**`
            : `**No Canada Open Data results for "${query}"**`;

        return {
          content: [
            {
              type: "text",
              text: [
                `Summary: ${tableRows.length} dataset(s) returned out of ${result.total} matching result(s).`,
                `Data source: ${result.source}`,
                `Endpoint: ${result.endpoint}`,
                "",
                title,
                "",
                markdownTable
              ].join("\n")
            }
          ],
          _meta: {
            "openai/outputTemplate": WIDGET_URI
          },
          structuredContent: {
            source: result.source,
            endpoint: result.endpoint,
            query: result.query,
            total: result.total,
            columns: columns.map((column) => column.label),
            rows: tableRows,
            rawRows: result.rows,
            markdownTable,
            htmlTable,
            widgetType: "table",
            widget: {
              type: "table",
              title: stripMarkdownBold(title),
              columns: columns.map((column) => ({
                key: column.key,
                label: column.label,
                align: column.align
              })),
              rows: tableRows
            }
          }
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to query open database: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  return server;
}
