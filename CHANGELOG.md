# Changelog

## 1.0.0
- First release: 11 read-only tools (`<area>_<verb>_<noun>`), 7 resources, 3 prompts, stateless Streamable HTTP and stdio.
- Discovery: server card (`/.well-known/mcp.json`), `llms.txt`, `robots.txt`, `/health`, `/version`.
- Content mirror of the website (`npm run sync`), tests for pricing decision, brand isolation and capability truth, 10-question evaluation set.
- Hardening after adversarial review: malformed-target 400, validated env limits, bounded rate limiter (health exempt, rightmost X-Forwarded-For), media-type parsing, CORS and security headers on MCP responses, late-failure response termination, Jira-import and dependencies capability matching.
