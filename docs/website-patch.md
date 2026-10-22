# Changes for the website repo (owner to apply; not applied by this PR)

The MCP is only useful if people and crawlers can find it from tasksiddhi.com.

1. **New page `/mcp`** (indexable, in `lib/routes.ts`, linked from the footer Resources column):
   - H1: "TaskSiddhi for AI assistants (MCP)"
   - Body: what it answers, the connect command `claude mcp add --transport http tasksiddhi https://mcp.tasksiddhi.com/mcp`, the tool list (see README), and the honest limits. No price figures.
2. **`public/llms.txt`** add under "Company": `- [MCP server for AI assistants](https://tasksiddhi.com/mcp): read-only tools that answer from this site, endpoint https://mcp.tasksiddhi.com/mcp`
3. **`/.well-known/mcp.json`** on tasksiddhi.com: either redirect to `https://mcp.tasksiddhi.com/.well-known/mcp.json` or serve the same card (some clients probe the product domain first).
4. The claims guard (`scripts/claims-register.mjs`) should treat `/mcp` like other pages: no price, no currency, no "unlimited".
