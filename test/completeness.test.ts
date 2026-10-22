import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, optionsFromEnv } from "../src/http.js";
import { site, templates, freeTools, section } from "../src/data.js";

let srv: Server;
let base: string;
const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const rpc = async (method: string, params: unknown = {}) =>
  (await (await fetch(`${base}/mcp`, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json());
const call = async (name: string, args: Record<string, unknown> = {}) => (await rpc("tools/call", { name, arguments: args })).result;

beforeAll(async () => {
  srv = createApp({ ...optionsFromEnv({}), publicUrl: "http://localhost:0", rateLimitPerMinute: 10_000 });
  await new Promise<void>((r) => srv.listen(0, r));
  base = `http://localhost:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => srv.close(() => r())));

describe("naming and pagination", () => {
  it("every tool is <area>_<verb>_<noun> snake_case", async () => {
    const tools = (await rpc("tools/list")).result.tools as { name: string }[];
    for (const t of tools) expect(t.name, t.name).toMatch(/^[a-z]+_[a-z]+_[a-z]+$/);
    expect(tools.length).toBe(11);
  });

  it("templates paginate with has_more / next_offset and no overlap", async () => {
    const a = (await call("templates_search_templates", { limit: 10, offset: 0 })).structuredContent;
    const b = (await call("templates_search_templates", { limit: 10, offset: a.next_offset })).structuredContent;
    expect(a.total).toBe(19);
    expect(a.has_more).toBe(true);
    expect(b.has_more).toBe(false);
    const urls = new Set([...a.templates, ...b.templates].map((t: { url: string }) => t.url));
    expect(urls.size).toBe(19);
  });

  it("rejects out-of-range pagination with a JSON-RPC or tool error", async () => {
    const r = await rpc("tools/call", { name: "site_search_pages", arguments: { query: "tasks", limit: 500 } });
    expect(r.error ?? r.result.isError).toBeTruthy();
  });
});

describe("new tools", () => {
  it("templates_get_template returns page, CSV and import route", async () => {
    const r = (await call("templates_get_template", { slug: "warehouse" })).structuredContent;
    expect(r.page).toBe("https://tasksiddhi.com/templates/warehouse");
    expect(r.csv).toBe("https://tasksiddhi.com/templates/warehouse.csv");
    expect(r.summary).toMatch(/spreadsheet import/);
  });
  it("templates_get_template gives an actionable error for an unknown slug", async () => {
    const r = await call("templates_get_template", { slug: "nope" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/templates_search_templates/);
  });
  it("alternatives_list_competitors lists nine, dated", async () => {
    const r = (await call("alternatives_list_competitors")).structuredContent;
    expect(r.alternatives).toHaveLength(9);
    for (const a of r.alternatives) expect(a.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("markets_list_countries lists the seven country pages", async () => {
    expect((await call("markets_list_countries")).structuredContent.countries).toHaveLength(7);
  });
  it("new resources are readable", async () => {
    const uris = ["tasksiddhi://pricing", "tasksiddhi://templates", "tasksiddhi://free-tools", "tasksiddhi://capabilities"];
    for (const uri of uris) {
      const text = (await rpc("resources/read", { uri })).result.contents[0].text as string;
      expect(text.length, uri).toBeGreaterThan(50);
    }
    expect((await rpc("resources/read", { uri: "tasksiddhi://pricing" })).result.contents[0].text).toMatch(/No per-user price/);
  });
});

describe("evaluation answers still match the mirror", () => {
  it("the facts behind evals/tasksiddhi.xml hold", () => {
    const xml = readFileSync(join(import.meta.dirname, "..", "evals", "tasksiddhi.xml"), "utf8");
    expect((xml.match(/<qa_pair>/g) ?? []).length).toBe(10);
    expect(site.alternatives.find((a) => a.slug === "microsoft-planner")?.checked_iso).toBe("2026-09-23");
    expect(site.alternatives.length).toBe(9);
    expect(templates().length).toBe(19);
    expect(freeTools().filter((t) => t.subsection).length).toBe(57);
    expect(section("Country homepages").length).toBe(7);
    expect(site.does).toContain("10,000 rows");
    expect(site.intro).toContain("no per-user price");
  });
});
