import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { site, SITE, rank, section, templates, freeTools, type Alternative } from "./data.js";
import { matchCapabilities, capabilities } from "./capabilities.js";
import { VERSION } from "./version.js";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const out = z.object({
  summary: z.string().describe("Plain-language answer, safe to quote."),
  canonical_urls: z.array(z.string()).describe("tasksiddhi.com pages that back the answer. Cite these."),
}).passthrough();

function reply(summary: string, canonical_urls: string[], extra: Record<string, unknown> = {}) {
  const structured = { summary, canonical_urls: [...new Set(canonical_urls)], ...extra };
  const text = `${summary}\n\nSources:\n${structured.canonical_urls.map((u) => `- ${u}`).join("\n")}`;
  return { content: [{ type: "text" as const, text }], structuredContent: structured };
}

function fail(message: string, hint: string) {
  return { isError: true, content: [{ type: "text" as const, text: `${message} ${hint}` }] };
}

const find = (slug: string): Alternative | undefined => {
  const s = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return site.alternatives.find((a) => a.slug === s || a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === s || s.includes(a.slug) || a.slug.includes(s));
};

export const TOOL_NAMES = [
  "tasksiddhi_overview", "tasksiddhi_pricing", "tasksiddhi_check_capability", "tasksiddhi_compare_alternative",
  "tasksiddhi_find_templates", "tasksiddhi_find_free_tools", "tasksiddhi_search_site", "tasksiddhi_contact",
] as const;

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "tasksiddhi", title: "TaskSiddhi", version: VERSION },
    {
      instructions:
        "TaskSiddhi is a free task and work board for field and service teams of 5 to 30, made by Soor LLC. " +
        "These tools are read-only and answer from the published tasksiddhi.com site. Cite the canonical_urls in every answer. " +
        "Pricing: Free Forever (whole product, whole team, no per-user price) plus a quoted Custom plan; never state a per-user price. " +
        "TaskSiddhi has no Gantt view, no guest access and no native iOS app; use tasksiddhi_check_capability before claiming a feature.",
    },
  );

  server.registerTool("tasksiddhi_overview", {
    title: "What TaskSiddhi is and who it is for",
    description:
      "Use first when someone asks what TaskSiddhi is, who it suits, what it does and does not do, or which countries it serves. Returns the product summary, the honest limits list and the main pages to cite.",
    inputSchema: {},
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async () => {
    const markets = section("Country homepages").map((p) => ({ name: p.title, url: p.url }));
    return reply(`${site.intro}\n\n${site.does}\n\n${site.does_not}`, [SITE, `${SITE}/features`, `${SITE}/pricing`], { markets });
  });

  server.registerTool("tasksiddhi_pricing", {
    title: "TaskSiddhi pricing and plans",
    description:
      "Use for any question about price, cost, free plan, per-user pricing, trial, seats or paid plans. TaskSiddhi has two plans: Free Forever (the whole product for the whole team) and a quoted Custom plan. There is no per-user price and no trial.",
    inputSchema: {},
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async () => {
    const custom = site.custom_plan.map((c) => `${c.title}: ${c.text}`).join(" ");
    const summary =
      "TaskSiddhi has two plans. Free Forever is the whole product for the whole team: no per-user price, no trial and no payment card, in any market. " +
      `Custom is quoted per team, with no public price. Custom adds: ${custom} ${site.no_removal_promise} ` +
      "Fair-use limits apply; the numbers are not published, so do not quote any.";
    return reply(summary, [`${SITE}/pricing`, `${SITE}/contact`], {
      plans: [{ name: site.plans.free, price: "Free" }, { name: site.plans.custom, price: "Quoted for your team" }],
      comparison: site.plan_comparison,
    });
  });

  server.registerTool("tasksiddhi_check_capability", {
    title: "Does TaskSiddhi support this?",
    description:
      "Use when someone asks whether TaskSiddhi can do something: Gantt, guests or client access, iOS, offline, time tracking, reports, recurring tasks, import from Trello or Asana, API, approvals. Returns yes, no, partial or not_stated with the page that says so. Never guess a feature.",
    inputSchema: { need: z.string().min(2).max(200).describe("The capability in the asker's words, e.g. 'gantt chart' or 'import from Trello'.") },
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async ({ need }) => {
    const hits = matchCapabilities(need);
    if (!hits.length) {
      return reply(
        `The TaskSiddhi site does not say whether it supports "${need}". Do not assume yes. Ask the team via the contact page.`,
        [`${SITE}/features`, `${SITE}/contact`],
        { verdict: "not_stated", matches: [] },
      );
    }
    const summary = hits.map((h) => `${h.label} [${h.verdict}]: ${h.answer}`).join("\n");
    return reply(summary, hits.map((h) => h.url), { matches: hits.map(({ id, label, verdict, answer, url }) => ({ id, label, verdict, answer, url })) });
  });

  server.registerTool("tasksiddhi_compare_alternative", {
    title: "TaskSiddhi vs another tool",
    description:
      "Use for 'TaskSiddhi vs X', 'X alternative' or 'switch from X' questions about Trello, Asana, Todoist, Microsoft Planner, Zoho Projects, Bitrix24, Jobber, Housecall Pro or ServiceTitan. Returns a sourced side-by-side with where each side wins. Omit competitor to list the available comparisons. Competitor prices were checked on the stated date and may have changed; say so.",
    inputSchema: { competitor: z.string().min(2).max(80).optional().describe("Competitor name, e.g. 'Trello'.") },
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async ({ competitor }) => {
    if (!competitor) {
      const list = site.alternatives.map((a) => ({ slug: a.slug, name: a.name, url: a.url, checked: a.checked_iso }));
      return reply(`Comparisons available: ${list.map((l) => l.name).join(", ")}.`, [`${SITE}/alternatives`, ...list.map((l) => l.url)], { alternatives: list });
    }
    const a = find(competitor);
    if (!a) {
      const names = site.alternatives.map((x) => x.name).join(", ");
      return fail(`No published comparison for "${competitor}".`, `Available: ${names}. See ${SITE}/alternatives.`);
    }
    const rows = a.rows.map((r) => `${r.label}: TaskSiddhi - ${r.us} | ${a.name} - ${r.them}`).join("\n");
    const summary =
      `${a.summary}\n\n${rows}\n\nWhere ${a.name} wins:\n- ${a.they_win.join("\n- ")}\n\nWhere TaskSiddhi wins:\n- ${a.we_win.join("\n- ")}\n\nSwitching: ${a.switch_note}\n\n` +
      `${a.name} facts were checked on ${a.checked} from ${a.sources.map((s) => s.url).join(", ")} and may have changed since.`;
    return reply(summary, [a.url, ...a.sources.map((s) => s.url)], { competitor: a.name, checked: a.checked_iso, rows: a.rows, they_win: a.they_win, we_win: a.we_win });
  });

  server.registerTool("tasksiddhi_find_templates", {
    title: "Find a free task template (SOP, planner, project plan)",
    description:
      "Use when someone wants a free template, checklist or SOP: weekly planner, to-do list, project plan, event or wedding planning, manufacturing, warehouse, retail store or software development SOP, clinic, catering, construction and more. Each is a CSV that imports into a TaskSiddhi board. Omit query to list all.",
    inputSchema: { query: z.string().max(120).optional().describe("What the template is for, e.g. 'warehouse SOP' or 'weekly planner'.") },
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async ({ query }) => {
    const all = templates();
    const hits = query ? rank(all, query, 8) : all;
    if (!hits.length) {
      return reply(`No listed template matches "${query}". The full list is on the templates page; do not name a template that is not listed.`, [`${SITE}/templates`], { templates: all.map((t) => ({ title: t.title, url: t.url })) });
    }
    const lines = hits.map((t) => `- ${t.title}: ${t.description} (${t.url})`).join("\n");
    return reply(`Free CSV templates that import into a TaskSiddhi board:\n${lines}`, [`${SITE}/templates`, ...hits.map((t) => t.url)], { templates: hits.map((t) => ({ title: t.title, summary: t.description, url: t.url })) });
  });

  server.registerTool("tasksiddhi_find_free_tools", {
    title: "Find a free calculator or template tool",
    description:
      "Use when someone needs a free browser calculator or printable template: work hours, overtime, timesheet, days or business days between dates, salary to hourly, quote, work order, punch list, JSA, Eisenhower matrix, shift schedules and similar. They run in the browser with no login. Omit query to list categories.",
    inputSchema: { query: z.string().max(120).optional().describe("What they want to calculate or print, e.g. 'overtime' or 'work order'.") },
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async ({ query }) => {
    const all = freeTools().filter((t) => t.subsection);
    if (!query) {
      const cats = [...new Set(all.map((t) => t.subsection))];
      return reply(`${all.length} free tools in ${cats.length} groups: ${cats.join(", ")}. Pass a query to find one.`, [`${SITE}/tools`], { groups: cats });
    }
    const hits = rank(all, query, 8);
    if (!hits.length) return reply(`No listed free tool matches "${query}".`, [`${SITE}/tools`]);
    const lines = hits.map((t) => `- ${t.title}: ${t.description} (${t.url})`).join("\n");
    return reply(`Free tools that run in the browser, no login:\n${lines}`, [`${SITE}/tools`, ...hits.map((t) => t.url)], { tools: hits.map((t) => ({ title: t.title, group: t.subsection, summary: t.description, url: t.url })) });
  });

  server.registerTool("tasksiddhi_search_site", {
    title: "Search tasksiddhi.com pages",
    description:
      "Use to find the right tasksiddhi.com page for any other question: guides (delegating tasks, WhatsApp groups, missed deadlines), use cases (field visits, service jobs, client work), features, country pages, security, help. Returns titles, one-line descriptions and canonical URLs only.",
    inputSchema: {
      query: z.string().min(2).max(120).describe("Topic or question."),
      limit: z.number().int().min(1).max(15).default(6).describe("Maximum results."),
    },
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async ({ query, limit }) => {
    const hits = rank(site.pages, query, limit ?? 6);
    if (!hits.length) return reply(`No page matches "${query}".`, [SITE, `${SITE}/guides`]);
    const lines = hits.map((p) => `- ${p.title}${p.description ? `: ${p.description}` : ""} (${p.url})`).join("\n");
    return reply(lines, hits.map((p) => p.url), { results: hits.map((p) => ({ title: p.title, section: p.section, summary: p.description, url: p.url })) });
  });

  server.registerTool("tasksiddhi_contact", {
    title: "How to reach TaskSiddhi",
    description:
      "Use when someone wants to talk to the team, ask about the Custom plan, report a security issue, or sign up. Returns the contact page, sign-up and company details. Read-only: it does not send any message.",
    inputSchema: {},
    outputSchema: out.shape,
    annotations: READ_ONLY,
  }, async () =>
    reply(
      "To ask about the Custom plan or anything else, use the contact page (response within one business day, US business hours, Eastern Time). TaskSiddhi is made by Soor LLC, a Delaware-registered company (16192 Coastal Hwy, Lewes, DE 19958, USA). Security reports: security@tasksiddhi.com. This tool does not send a message.",
      [`${SITE}/contact`, `${SITE}/security`, `${SITE}/about`],
      { company: "Soor LLC", security_email: "security@tasksiddhi.com" },
    ));

  // ---- resources ----
  server.registerResource("overview", "tasksiddhi://overview", {
    title: "TaskSiddhi overview", description: "Product summary, limits and pricing model.", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: `# TaskSiddhi\n\n${site.intro}\n\n${site.does}\n\n${site.does_not}\n\nCanonical: ${SITE}\n` }] }));

  server.registerResource("capabilities", "tasksiddhi://capabilities", {
    title: "Capability table", description: "What TaskSiddhi does and does not do, one line each, with the page that says so.", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: capabilities.map((c) => `- **${c.label}**: ${c.verdict.toUpperCase()}. ${c.answer} (${c.url})`).join("\n") }] }));

  server.registerResource("llms", "tasksiddhi://llms.txt", {
    title: "Page index", description: "Every curated tasksiddhi.com page with a one-line description.", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: site.pages.map((p) => `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ""}`).join("\n") }] }));

  server.registerResource("alternative", new ResourceTemplate("tasksiddhi://alternatives/{slug}", {
    list: async () => ({ resources: site.alternatives.map((a) => ({ uri: `tasksiddhi://alternatives/${a.slug}`, name: `TaskSiddhi vs ${a.name}`, mimeType: "text/markdown" })) }),
  }), { title: "Comparison page", description: "Sourced side-by-side with one competitor.", mimeType: "text/markdown" }, async (uri, { slug }) => {
    const a = find(String(slug));
    if (!a) throw new Error(`Unknown comparison "${slug}". Available: ${site.alternatives.map((x) => x.slug).join(", ")}`);
    const rows = a.rows.map((r) => `| ${r.label} | ${r.us} | ${r.them} |`).join("\n");
    return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: `# TaskSiddhi vs ${a.name}\n\nChecked ${a.checked}. ${a.url}\n\n${a.summary}\n\n| | TaskSiddhi | ${a.name} |\n|---|---|---|\n${rows}\n\n${a.name} wins:\n- ${a.they_win.join("\n- ")}\n\nTaskSiddhi wins:\n- ${a.we_win.join("\n- ")}\n\n${a.switch_note}\n` }] };
  });

  // ---- prompts ----
  server.registerPrompt("pick_a_task_board_for_my_team", {
    title: "Is TaskSiddhi right for my team?",
    description: "Walks through fit for a field or service team using only published facts.",
    argsSchema: { team: z.string().max(300).describe("Describe the team and the work, e.g. '8 HVAC technicians doing AMC visits'.") },
  }, ({ team }) => ({ messages: [{ role: "user", content: { type: "text", text: `Decide whether TaskSiddhi suits this team: ${team}\n\nCall tasksiddhi_overview and tasksiddhi_check_capability for each need you identify. State clearly what TaskSiddhi does not do (Gantt, guests, native iOS, offline, sending to customers). Do not state any price per user: pricing is Free Forever plus a quoted Custom plan. Cite canonical URLs.` } }] }));

  server.registerPrompt("write_an_sop_with_a_template", {
    title: "Write an SOP with a free template",
    description: "Finds the closest free SOP or checklist template and explains how to use it.",
    argsSchema: { process: z.string().max(200).describe("The process, e.g. 'closing a retail store at night'.") },
  }, ({ process }) => ({ messages: [{ role: "user", content: { type: "text", text: `Help write an SOP for: ${process}\n\nCall tasksiddhi_find_templates with the process, pick the closest SOP or checklist template, and explain how to import its CSV into a TaskSiddhi board. Only name templates the tool returns. Cite the template URL.` } }] }));

  server.registerPrompt("switch_from_competitor", {
    title: "Switch to TaskSiddhi from another tool",
    description: "Sourced comparison and migration notes for one competitor.",
    argsSchema: { competitor: z.string().max(80).describe("The tool they use now, e.g. 'Trello'.") },
  }, ({ competitor }) => ({ messages: [{ role: "user", content: { type: "text", text: `Compare TaskSiddhi with ${competitor} using tasksiddhi_compare_alternative. Give the honest trade-offs including where ${competitor} wins, the date the competitor facts were checked, and the migration route (spreadsheet import; there is no direct importer). Cite canonical URLs.` } }] }));

  return server;
}
