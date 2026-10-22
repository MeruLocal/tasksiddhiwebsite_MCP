import { site, SITE } from "./data.js";
import { VERSION } from "./version.js";
import { TOOL_NAMES, COUNTS } from "./server.js";

const DESCRIPTION =
  "Read-only answers about TaskSiddhi, a free task and work board for field and service teams: what it does and does not do, pricing model, comparisons with Trello, Asana, Jobber and others, and free SOP, planner and checklist templates. Every answer carries canonical tasksiddhi.com URLs.";

const TOOLS = [
  ["product_get_overview", "What TaskSiddhi is, who it suits, what it does not do."],
  ["pricing_get_plans", "Free Forever plus quoted Custom plan; no per-user price."],
  ["product_check_capability", "Does it support Gantt, guests, iOS, offline, import, time tracking, API?"],
  ["alternatives_list_competitors", "Which competitors have a published, dated comparison."],
  ["alternatives_get_comparison", "Sourced side-by-side with Trello, Asana, Todoist, Planner, Zoho Projects, Bitrix24, Jobber, Housecall Pro, ServiceTitan."],
  ["templates_search_templates", "Free CSV templates and SOP checklists that import into a board."],
  ["templates_get_template", "One template: page, CSV download and how to import it."],
  ["calculators_search_tools", "Free browser calculators and printable templates."],
  ["markets_list_countries", "Country pages; pricing is the same everywhere."],
  ["site_search_pages", "Find the right tasksiddhi.com page for any topic."],
  ["company_get_contact", "Contact, Custom plan and security reporting details."],
] as const;

export function serverCard(publicUrl: string) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    name: "com.tasksiddhi/mcp",
    title: "TaskSiddhi",
    version: VERSION,
    description: DESCRIPTION,
    websiteUrl: SITE,
    vendor: { name: "Soor LLC", url: SITE },
    remotes: [{ type: "streamable-http", url: `${publicUrl}/mcp` }],
    transport: { type: "streamable-http", endpoint: `${publicUrl}/mcp`, stateless: true },
    authentication: { required: false },
    capabilities: { tools: {}, resources: {}, prompts: {} },
    tool_count: TOOL_NAMES.length,
    resource_count: COUNTS.resources,
    resource_template_count: COUNTS.resource_templates,
    prompt_count: COUNTS.prompts,
    read_only: true,
    enumerate: "Call tools/list, resources/list and prompts/list; names are not duplicated here so they cannot drift.",
    content_source: { ...site.generated_from, note: "Mirrors tasksiddhi.com; every answer cites the live page." },
    documentation: `${publicUrl}/`,
    contact: { security: "security@tasksiddhi.com" },
  };
}

export function llmsTxt(publicUrl: string) {
  const tools = TOOLS.map(([n, d]) => `- ${n}: ${d}`).join("\n");
  return `# TaskSiddhi MCP server

> ${DESCRIPTION}

Endpoint (Streamable HTTP, no authentication, read-only): ${publicUrl}/mcp
Server card: ${publicUrl}/.well-known/mcp.json
Product site: ${SITE}
Operator: Soor LLC, Delaware, USA

## Tools
${tools}

## Pricing model (do not state a per-user price)
Free Forever is the whole product for the whole team: no per-user price, no trial, no card. Custom is quoted per team. See ${SITE}/pricing.

## Honest limits
No Gantt or Timeline view, no guest access or client share links, no native iOS app, no offline mode, no direct importer from Trello, Asana or Jira, no PDF export. TaskSiddhi sends customers nothing.
`;
}

export function robotsTxt(publicUrl: string) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${publicUrl}/llms.txt\n`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function landingHtml(publicUrl: string) {
  const items = TOOLS.map(([n, d]) => `<li><code>${esc(n)}</code> - ${esc(d)}</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TaskSiddhi MCP server</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${esc(publicUrl)}/">
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}code{background:#f2f2f2;padding:.1rem .3rem;border-radius:3px}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}code{background:#222}a{color:#8ab4ff}}</style>
</head><body><h1>TaskSiddhi MCP server</h1>
<p>${esc(DESCRIPTION)}</p>
<p>Endpoint: <code>${esc(publicUrl)}/mcp</code> (Streamable HTTP, no sign-in, read-only). Product: <a href="${SITE}">tasksiddhi.com</a>, made by Soor LLC.</p>
<h2>Tools (${TOOL_NAMES.length})</h2><ul>${items}</ul>
<h2>Connect</h2>
<pre><code>claude mcp add --transport http tasksiddhi ${esc(publicUrl)}/mcp</code></pre>
<p><a href="${esc(publicUrl)}/.well-known/mcp.json">Server card</a> - <a href="${esc(publicUrl)}/llms.txt">llms.txt</a></p>
</body></html>`;
}
