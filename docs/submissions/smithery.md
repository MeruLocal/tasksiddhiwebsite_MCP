# Smithery

- Site: https://smithery.ai , "Publish a server" -> remote (hosted) server.
- Endpoint: `https://mcp.tasksiddhi.com/mcp` (Streamable HTTP, no auth). `smithery.yaml` in the repo declares it.
- Display name: TaskSiddhi
- Short description: Answers buyer questions about TaskSiddhi, a free task board for field and service teams: what it does and does not do, pricing model, comparisons, free SOP templates.
- Categories/tags to select: productivity, project management, templates, comparison.
- Icon: use the site's `https://tasksiddhi.com/icon-512.png` (served by the website).
- Scan expectation: 8 tools, 4 resources, 3 prompts, all read-only. Smithery's scanner calls `tools/list` unauthenticated; that works.
