import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

  server.tool(
    "queryOpenDatabase",
    "Searches the Government of Canada Open Data portal and returns dataset metadata as raw rows and a table widget.",
    {
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
          "Dataset ID": row.datasetId
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
