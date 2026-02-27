import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function escapeMarkdownCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function buildMarkdownTable(columns, rows) {
  const header = `| ${columns.map(escapeMarkdownCell).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const cells = columns.map((column) => escapeMarkdownCell(row[column] ?? ""));
    return `| ${cells.join(" | ")} |`;
  });

  return [header, divider, ...body].join("\n");
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
        const columns = ["year", "value", "country", "indicator"];
        const markdownTable = buildMarkdownTable(columns, result.rows);

        return {
          content: [
            {
              type: "text",
              text: [
                `Data source: ${result.source}`,
                `Endpoint: ${result.endpoint}`,
                "",
                "Table widget:",
                markdownTable
              ].join("\n")
            }
          ],
          structuredContent: {
            source: result.source,
            endpoint: result.endpoint,
            columns,
            rows: result.rows,
            widgetType: "table"
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
