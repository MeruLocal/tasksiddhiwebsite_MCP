import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, optionsFromEnv } from "../src/http.js";
import { TOOL_NAMES } from "../src/server.js";

let srv: Server;
let base: string;

const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
async function rpc(method: string, params: unknown = {}, id: number | undefined = 1) {
  const res = await fetch(`${base}/mcp`, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  return { res, body: res.status === 202 ? null : await res.json() };
}
const call = async (name: string, args: Record<string, unknown> = {}) => (await rpc("tools/call", { name, arguments: args })).body.result;

beforeAll(async () => {
  srv = createApp({ ...optionsFromEnv({}), publicUrl: "http://localhost:0", rateLimitPerMinute: 10_000 });
  await new Promise<void>((r) => srv.listen(0, r));
  base = `http://localhost:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => srv.close(() => r())));

describe("protocol", () => {
  it("initializes and negotiates a protocol version", async () => {
    const { body } = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
    expect(body.result.serverInfo.name).toBe("tasksiddhi");
    expect(body.result.protocolVersion).toBeTruthy();
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.instructions).toMatch(/Free Forever/);
  });

  it("lists exactly the declared tools, each annotated read-only with a title and output schema", async () => {
    const { body } = await rpc("tools/list");
    const tools = body.result.tools as any[];
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const t of tools) {
      expect(t.title, t.name).toBeTruthy();
      expect(t.annotations.readOnlyHint, t.name).toBe(true);
      expect(t.annotations.destructiveHint, t.name).toBe(false);
      expect(t.outputSchema, t.name).toBeDefined();
      expect(t.description.length, t.name).toBeGreaterThan(80);
    }
  });

  it("returns JSON-RPC errors for unknown methods and invalid params, not crashes", async () => {
    expect((await rpc("nope/nope")).body.error.code).toBe(-32601);
    const bad = await rpc("tools/call", { name: "site_search_pages", arguments: { query: "x" } });
    expect(bad.body.error ?? bad.body.result.isError).toBeTruthy();
  });

  it("returns an isError result (not a transport error) for an unknown competitor", async () => {
    const r = await call("alternatives_get_comparison", { competitor: "Nonexistent Tool 9000" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Available:/);
  });

  it("is stateless: no session id issued, and GET/DELETE are refused with 405 + Allow", async () => {
    const { res } = await rpc("tools/list");
    expect(res.headers.get("mcp-session-id")).toBeNull();
    const g = await fetch(`${base}/mcp`, { method: "GET", headers: { Accept: "text/event-stream" } });
    expect(g.status).toBe(405);
    expect(g.headers.get("allow")).toMatch(/POST/);
    expect((await fetch(`${base}/mcp`, { method: "DELETE" })).status).toBe(405);
  });

  it("rejects bad content-type, malformed JSON and oversized bodies", async () => {
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" })).status).toBe(415);
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: H, body: "{nope" })).status).toBe(400);
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: H, body: "x".repeat(70_000) })).status).toBe(413);
  });

  it("lists and reads resources and prompts", async () => {
    const r = (await rpc("resources/list")).body.result.resources.map((x: any) => x.uri);
    expect(r).toContain("tasksiddhi://overview");
    const read = (await rpc("resources/read", { uri: "tasksiddhi://alternatives/trello" })).body.result.contents[0].text;
    expect(read).toMatch(/TaskSiddhi vs Trello/);
    const prompts = (await rpc("prompts/list")).body.result.prompts.map((p: any) => p.name);
    expect(prompts).toContain("switch_from_competitor");
    const p = (await rpc("prompts/get", { name: "switch_from_competitor", arguments: { competitor: "Asana" } })).body.result;
    expect(p.messages[0].content.text).toMatch(/Asana/);
  });
});

describe("answers", () => {
  it("pricing states no per-user price and no trial", async () => {
    const r = await call("pricing_get_plans");
    expect(r.structuredContent.summary).toMatch(/no per-user price/);
    expect(r.structuredContent.canonical_urls).toContain("https://tasksiddhi.com/pricing");
  });

  it("Gantt is answered NO, guests NO, time tracking YES, unknown is not_stated", async () => {
    expect((await call("product_check_capability", { need: "gantt chart" })).structuredContent.matches[0].verdict).toBe("no");
    expect((await call("product_check_capability", { need: "guest access for clients" })).structuredContent.matches[0].verdict).toBe("no");
    expect((await call("product_check_capability", { need: "time tracking" })).structuredContent.matches[0].verdict).toBe("yes");
    expect((await call("product_check_capability", { need: "SAML single sign-on" })).structuredContent.verdict).toBe("not_stated");
  });

  it("finds SOP templates and only returns listed URLs", async () => {
    const r = await call("templates_search_templates", { query: "warehouse SOP" });
    expect(r.structuredContent.templates[0].url).toBe("https://tasksiddhi.com/templates/warehouse");
    for (const u of r.structuredContent.canonical_urls) expect(u).toMatch(/^https:\/\/tasksiddhi\.com\//);
  });

  it("comparison carries the checked date and where the competitor wins", async () => {
    const r = await call("alternatives_get_comparison", { competitor: "trello" });
    expect(r.structuredContent.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.structuredContent.they_win.length).toBeGreaterThan(0);
    expect(r.content[0].text).toMatch(/may have changed/);
  });
});

describe("discovery surfaces", () => {
  it("serves health, version, server card, llms.txt, robots and the landing page", async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await (await fetch(`${base}/version`)).json()).tools).toBe(TOOL_NAMES.length);
    for (const p of ["/.well-known/mcp.json", "/.well-known/mcp/server-card.json"]) {
      const card = await (await fetch(`${base}${p}`)).json();
      expect(card.tool_count).toBe(TOOL_NAMES.length);
      const listed = (await rpc("tools/list")).body.result.tools;
      expect(listed.length).toBe(card.tool_count);
      const rl = (await rpc("resources/list")).body.result.resources.filter((r: any) => !r.uri.startsWith("tasksiddhi://alternatives/"));
      expect(rl.length).toBe(card.resource_count);
      expect((await rpc("prompts/list")).body.result.prompts.length).toBe(card.prompt_count);
      const llms = await (await fetch(`${base}/llms.txt`)).text();
      for (const n of TOOL_NAMES) expect(llms, n).toContain(n);
      expect(card.authentication.required).toBe(false);
    }
    expect((await (await fetch(`${base}/llms.txt`)).text())).toMatch(/Free Forever/);
    expect((await fetch(`${base}/robots.txt`)).status).toBe(200);
    expect((await (await fetch(`${base}/`)).text())).toMatch(/<title>TaskSiddhi MCP server<\/title>/);
    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });
});
