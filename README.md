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
| `tasksiddhi_overview` | what it is, who it is for, honest limits |
| `tasksiddhi_pricing` | any price, free-plan, per-user or trial question |
| `tasksiddhi_check_capability` | "does it support X?" returns yes / no / partial / not_stated |
| `tasksiddhi_compare_alternative` | "X alternative", "TaskSiddhi vs X" |
| `tasksiddhi_find_templates` | SOP, planner, checklist and project-plan templates |
| `tasksiddhi_find_free_tools` | free calculators and printable templates |
| `tasksiddhi_search_site` | any other topic, returns canonical pages |
| `tasksiddhi_contact` | Custom plan, sales and security contact |

All tools carry `title`, `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` and an `outputSchema`. Also: 4 resources (including a `tasksiddhi://alternatives/{slug}` template) and 3 prompts.

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
