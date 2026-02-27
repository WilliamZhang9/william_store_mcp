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

function formatNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return value ?? "";
}

function buildMarkdownTable(columns, rows) {
  const header = `| ${columns.map((column) => escapeMarkdownCell(column.label)).join(" | ")} |`;
  const divider = `| ${columns
    .map((column) => (column.align === "right" ? "---:" : "---"))
    .join(" | ")} |`;
  const body = rows.map((row) => {
    const cells = columns.map((column) => escapeMarkdownCell(row[column.key] ?? ""));
    return `| ${cells.join(" | ")} |`;
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

async function fetchWorldBankIndicator({
  countryCode = "CAN",
  indicatorCode = "SP.POP.TOTL",
  startYear = 2018,
  endYear = 2024,
  limit = 10
}) {
  const requestedLimit = Math.max(1, Math.min(limit, 20));
  const endpoint =
    "https://api.worldbank.org/v2/country/" +
    `${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicatorCode)}` +
    `?format=json&date=${startYear}:${endYear}&per_page=${requestedLimit}`;

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`World Bank API request failed: ${response.status}`);
  }

  const payload = await response.json();
  const entries = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
  const rows = entries
    .filter((item) => item && item.value !== null)
    .slice(0, requestedLimit)
    .map((item) => ({
      year: item.date,
      value: item.value,
      country: item.country?.value ?? countryCode,
      indicator: item.indicator?.value ?? indicatorCode
    }));

  return {
    source: "World Bank Open Data API",
    endpoint,
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
    "Fetches open data from World Bank and returns both raw rows and a Markdown table widget.",
    {
      databaseId: z
        .literal("world_bank")
        .default("world_bank")
        .describe("Open database identifier. Currently supports only world_bank."),
      countryCode: z
        .string()
        .length(3)
        .default("CAN")
        .describe("ISO-3 country code, e.g. CAN, USA, FRA."),
      indicatorCode: z
        .string()
        .min(3)
        .default("SP.POP.TOTL")
        .describe("World Bank indicator code, e.g. SP.POP.TOTL for population."),
      startYear: z
        .number()
        .int()
        .min(1960)
        .max(2100)
        .default(2018),
      endYear: z
        .number()
        .int()
        .min(1960)
        .max(2100)
        .default(new Date().getFullYear()),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
    },
    async ({ countryCode, indicatorCode, startYear, endYear, limit }) => {
      if (startYear > endYear) {
        return {
          content: [
            {
              type: "text",
              text: "Invalid range: startYear must be less than or equal to endYear."
            }
          ],
          isError: true
        };
      }

      try {
        const result = await fetchWorldBankIndicator({
          countryCode,
          indicatorCode,
          startYear,
          endYear,
          limit
        });
        const sortedRows = [...result.rows].sort((a, b) => Number(b.year) - Number(a.year));
        const tableRows = sortedRows.map((row) => ({
          Year: row.year,
          Value: formatNumber(row.value),
          Country: row.country,
          Indicator: row.indicator
        }));
        const columns = [
          { key: "Year", label: "Year", align: "left" },
          { key: "Value", label: "Value", align: "right" },
          { key: "Country", label: "Country", align: "left" },
          { key: "Indicator", label: "Indicator", align: "left" }
        ];
        const markdownTable = buildMarkdownTable(columns, tableRows);
        const htmlTable = buildHtmlTable(columns, tableRows);
        const years = sortedRows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year));
        const minYear = years.length > 0 ? Math.min(...years) : startYear;
        const maxYear = years.length > 0 ? Math.max(...years) : endYear;
        const title =
          tableRows.length > 0
            ? `**${tableRows[0].Country} - ${tableRows[0].Indicator} (${minYear}-${maxYear})**`
            : `**${countryCode} - ${indicatorCode} (${startYear}-${endYear})**`;

        return {
          content: [
            {
              type: "text",
              text: [
                `Summary: ${tableRows.length} row(s) returned.`,
                `Data source: ${result.source}`,
                `Endpoint: ${result.endpoint}`,
                "",
                title,
                "",
                markdownTable,
                "",
                "HTML table:",
                htmlTable
              ].join("\n")
            }
          ],
          structuredContent: {
            source: result.source,
            endpoint: result.endpoint,
            columns: columns.map((column) => column.label),
            rows: tableRows,
            rawRows: sortedRows,
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
