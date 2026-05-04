import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpStoreServer } from "./mcp-server.js";

const port = Number(process.env.PORT || 3000);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON request body"));
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(payload));
}

function writeJsonRpcError(res, statusCode, message) {
  writeJson(res, statusCode, {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message
    },
    id: null
  });
}

async function handleMcpRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id"
    });
    res.end();
    return;
  }

  if (req.method === "GET") {
    writeJson(res, 200, {
      name: "open-database-mcp-server",
      status: "ok",
      transport: "streamable-http",
      endpoint: "/mcp"
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    writeJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const server = createMcpStoreServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    const body = await readJsonBody(req);
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) {
      writeJsonRpcError(res, 500, error.message || "Internal server error");
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    writeJson(res, 200, {
      name: "open-database-mcp-server",
      status: "ok",
      mcpEndpoint: "/mcp"
    });
    return;
  }

  if (url.pathname === "/mcp" || url.pathname === "/api/mcp") {
    await handleMcpRequest(req, res);
    return;
  }

  writeJson(res, 404, { error: "Not found" });
});

httpServer.listen(port, () => {
  console.error(`MCP HTTP server listening on http://localhost:${port}/mcp`);
});
