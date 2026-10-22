#!/usr/bin/env node
// Read-only conformance probe for a running server. Zero dependencies.
//   node scripts/probe.mjs http://localhost:3000
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
let fails = 0;
const ok = (name, cond, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); if (!cond) fails++; };
const rpc = async (method, params = {}, id = 1) => {
  const r = await fetch(`${base}/mcp`, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) };
};
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe", version: "1" } });
ok("initialize returns serverInfo", !!init.body?.result?.serverInfo?.name);
const list = await rpc("tools/list");
const tools = list.body?.result?.tools ?? [];
ok("tools/list non-empty", tools.length > 0, `${tools.length} tools`);
ok("every tool has title + readOnlyHint + outputSchema", tools.every((t) => t.title && t.annotations?.readOnlyHint === true && t.outputSchema));
ok("unknown method -> -32601", (await rpc("nope/nope")).body?.error?.code === -32601);
ok("GET /mcp -> 405", (await fetch(`${base}/mcp`)).status === 405);
for (const p of ["/health", "/version", "/.well-known/mcp.json", "/llms.txt", "/robots.txt"]) ok(`GET ${p} -> 200`, (await fetch(base + p)).status === 200);
process.exit(fails ? 1 : 0);
