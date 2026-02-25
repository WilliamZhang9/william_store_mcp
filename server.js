import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpStoreServer } from "./mcp-server.js";

const transport = new StdioServerTransport();
const server = createMcpStoreServer();
await server.connect(transport);
