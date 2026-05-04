import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpStoreServer } from "../mcp-server.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};

function writeJsonRpcError(res, statusCode, message) {
  res.status(statusCode).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message
    },
    id: null
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      name: "open-database-mcp-server",
      status: "ok",
      transport: "streamable-http",
      endpoint: "/api/mcp"
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const server = createMcpStoreServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      writeJsonRpcError(res, 500, "Internal server error");
    }
  } finally {
    await transport.close();
    await server.close();
  }
}
