# TaskSiddhi MCP server

Public, read-only [Model Context Protocol](https://modelcontextprotocol.io) server for [TaskSiddhi](https://tasksiddhi.com), a free task and work board for field and service teams, made by Soor LLC.

It lets an AI assistant answer buyer questions from the published tasksiddhi.com content and cite canonical URLs:

- what TaskSiddhi is, who it suits, and what it does **not** do (no Gantt view, no guest access, no native iOS app, no offline mode)
- pricing model: **Free Forever** (whole product, whole team, no per-user price, no trial, no card) plus a quoted **Custom** plan
- sourced side-by-side comparisons (Trello, Asana, Todoist, Microsoft Planner, Zoho Projects, Bitrix24, Jobber, Housecall Pro, ServiceTitan), each dated
- free CSV templates and SOP checklists that import into a board, and free browser calculators

No authentication, no writes, no user data. Nothing the server returns is invented: the content is a generated mirror of the website (`data/site.json`).

## Tools

| Tool | Use it for |
|---|---|
| `product_get_overview` | what it is, who it is for, honest limits |
| `pricing_get_plans` | any price, free-plan, per-user or trial question |
| `product_check_capability` | "does it support X?" returns yes / no / partial / not_stated |
| `alternatives_list_competitors` | which competitors are covered, with checked dates |
| `alternatives_get_comparison` | "X alternative", "TaskSiddhi vs X" |
| `templates_search_templates` | SOP, planner, checklist and project-plan templates |
| `templates_get_template` | one template: page, CSV link, how to import |
| `calculators_search_tools` | free calculators and printable templates |
| `markets_list_countries` | country pages (pricing is the same everywhere) |
| `site_search_pages` | any other topic, returns canonical pages |
| `company_get_contact` | Custom plan, sales and security contact |

All tools carry `title`, `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` and an `outputSchema`. List tools take `limit` and `offset` and return `has_more` / `next_offset`. Also: 7 resources (including a `tasksiddhi://alternatives/{slug}` template) and 3 prompts.

## Run

```bash
npm install
npm run build
npm start                 # HTTP on :3000, endpoint POST /mcp
node dist/index.js --stdio
```

Connect from Claude Code:

```bash
claude mcp add --transport http tasksiddhi https://mcp.tasksiddhi.com/mcp
```

Transport is Streamable HTTP, **stateless** (no `Mcp-Session-Id`; each request is independent), so it is compatible with the spec direction that removes sessions. `GET /mcp` returns `405` with `Allow: POST`.

Discovery: `/.well-known/mcp.json` (also `/.well-known/mcp/server-card.json`), `/llms.txt`, `/robots.txt`, `/health`, `/version`.

## Connect from your client

Endpoint: `https://mcp.tasksiddhi.com/mcp` (Streamable HTTP, no sign-in). Ready-made configs are in `examples/`.

| Client | How |
|---|---|
| Claude Code | `claude mcp add --transport http tasksiddhi https://mcp.tasksiddhi.com/mcp` |
| Claude Desktop | merge `examples/claude-desktop.json` into `claude_desktop_config.json` (uses the `mcp-remote` bridge) |
| Cursor | `examples/cursor.mcp.json` as `.cursor/mcp.json` |
| VS Code | `examples/vscode.mcp.json` as `.vscode/mcp.json` |
| Windsurf | `examples/windsurf.mcp_config.json` |
| Anything else | `sh examples/curl.sh`; no handshake is needed (stateless) |

## Try these questions

- "Does TaskSiddhi have a Gantt view, and can clients get guest access?"
- "Is there a free SOP template for a warehouse?" then "How do I import it?"
- "TaskSiddhi vs Trello for a 10-person service team: where does Trello win?"
- "What does TaskSiddhi cost per user?"

An evaluation set of 10 questions with checkable answers is in `evals/tasksiddhi.xml`.

## Keep the content true

```bash
npm run sync -- "<path to a checkout of the website repo, trunk main>"
npm run verify
```

`sync` regenerates `data/site.json` from the website's `public/llms.txt`, `lib/alternatives.ts`, `lib/constants.ts` and `lib/templates.ts`. `npm test` fails if the capability table disagrees with the site's own "does / does not do" statements, if a price, currency or per-user figure appears on TaskSiddhi's side, or if a sibling brand is named anywhere in the repo.

Re-run `sync` whenever the website changes pricing, limits or comparisons, and at least monthly: competitor facts are dated and go stale.

## Configuration

See `.env.example`. `PUBLIC_URL` is what the server card and landing page advertise (default `https://mcp.tasksiddhi.com`). Set `TRUST_PROXY=1` only behind a proxy that sets `X-Forwarded-For`.

## Security

Read-only; no credentials; no outbound calls at request time; 64 KB body limit; per-IP rate limit; no stack traces or internals in errors. Report issues to security@tasksiddhi.com.

Licence: MIT. Operator: Soor LLC, Delaware, USA.
