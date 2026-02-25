import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpStoreServer } from "../mcp-server.js";

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
