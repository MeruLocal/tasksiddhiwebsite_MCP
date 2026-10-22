# Official MCP Registry

- Registry: https://registry.modelcontextprotocol.io (publisher CLI: `mcp-publisher`)
- Name: `com.tasksiddhi/mcp` (reverse-DNS of tasksiddhi.com)
- Type: remote server, Streamable HTTP, no authentication. `server.json` in this repo is already in that shape (no package/npm entry, so no `mcp-name` marker is needed).

## Steps (owner)

1. Prove the domain. `mcp-publisher login dns --domain tasksiddhi.com` prints a TXT record; add it at the DNS host for tasksiddhi.com; run the login again.
2. `mcp-publisher publish` from the repo root.
3. Verify: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=com.tasksiddhi"`.

## Pre-checks

- `npm run check:versions` passes (package.json, server.json, src/version.ts agree).
- `npm run probe -- https://mcp.tasksiddhi.com` all PASS.
- Server description (<=100 chars suggested): "Read-only answers about TaskSiddhi: capabilities, limits, pricing model, comparisons, free templates."
