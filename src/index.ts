#!/usr/bin/env node
/**
 * TaskSiddhi MCP server entry point.
 *   node dist/index.js            -> HTTP on $PORT (default 3000), endpoint POST /mcp
 *   node dist/index.js --stdio    -> stdio, for local clients and registry checks
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createApp, optionsFromEnv } from "./http.js";

if (process.argv.includes("--stdio")) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT || 3000);
  const opts = optionsFromEnv();
  const app = createApp(opts);
  app.listen(port, () => console.log(JSON.stringify({ evt: "listening", port, endpoint: `${opts.publicUrl}/mcp` })));
  const stop = () => app.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
