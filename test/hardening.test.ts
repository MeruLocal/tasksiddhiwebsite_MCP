import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, optionsFromEnv } from "../src/http.js";

let srv: Server;
let base: string;
let port: number;
const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const rpc = async (method: string, params: unknown = {}) =>
  (await (await fetch(`${base}/mcp`, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json());
const call = async (name: string, args: Record<string, unknown> = {}) => (await rpc("tools/call", { name, arguments: args })).result;

beforeAll(async () => {
  srv = createApp({ ...optionsFromEnv({}), publicUrl: "http://localhost:0", rateLimitPerMinute: 10_000 });
  await new Promise<void>((r) => srv.listen(0, r));
  port = (srv.address() as AddressInfo).port;
  base = `http://localhost:${port}`;
});
afterAll(() => new Promise<void>((r) => srv.close(() => r())));

describe("input hardening (from the adversarial review)", () => {
  it("a malformed request target returns 400 and the server keeps serving", async () => {
    const reply = await new Promise<string>((resolve) => {
      const s = net.connect(port, "127.0.0.1", () => s.write("POST //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"));
      let buf = "";
      s.on("data", (d) => (buf += d.toString()));
      s.on("close", () => resolve(buf));
      s.setTimeout(5000, () => s.destroy());
    });
    expect(reply).toMatch(/^HTTP\/1\.1 400/);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it("media type is parsed, not substring-matched", async () => {
    const ok = await fetch(`${base}/mcp`, { method: "POST", headers: { ...H, "Content-Type": "Application/JSON; charset=utf-8" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    expect(ok.status).toBe(200);
    for (const bad of ["application/jsonp", "text/plain; x=application/json"]) {
      expect((await fetch(`${base}/mcp`, { method: "POST", headers: { ...H, "Content-Type": bad }, body: "{}" })).status, bad).toBe(415);
    }
  });

  it("successful MCP responses carry CORS and security headers", async () => {
    const r = await fetch(`${base}/mcp`, { method: "POST", headers: { ...H, Origin: "https://example.org" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("body cap is exact at the boundary: exactly the limit is not 413, limit+1 is", async () => {
    const max = 65536;
    const pad = (n: number) => JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { x: "a".repeat(n) } });
    const base0 = pad(0).length;
    const exact = pad(max - base0);
    expect(exact.length).toBe(max);
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: H, body: exact })).status).not.toBe(413);
    const over = pad(max - base0 + 1);
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: H, body: over })).status).toBe(413);
  });
});

describe("configuration is validated, never silently disabled", () => {
  it("rejects non-numeric, zero, negative, fractional and out-of-range limits", () => {
    for (const v of ["abc", "NaN", "Infinity", "0", "-5", "1.5", "99999999"]) {
      expect(() => optionsFromEnv({ RATE_LIMIT_PER_MINUTE: v }), v).toThrow(/RATE_LIMIT_PER_MINUTE/);
      expect(() => optionsFromEnv({ MAX_BODY_BYTES: v }), v).toThrow(/MAX_BODY_BYTES/);
    }
    expect(() => optionsFromEnv({ PUBLIC_URL: "not a url" })).toThrow(/PUBLIC_URL/);
    expect(optionsFromEnv({}).maxBodyBytes).toBe(65536);
  });
});

describe("rate limiter", () => {
  it("throttles an address, exempts /health, and does not trust a spoofed leftmost X-Forwarded-For", async () => {
    const s = createApp({ ...optionsFromEnv({}), publicUrl: "http://localhost:0", rateLimitPerMinute: 3, trustProxy: true });
    await new Promise<void>((r) => s.listen(0, r));
    const b = `http://localhost:${(s.address() as AddressInfo).port}`;
    const hit = (xff: string) => fetch(`${b}/llms.txt`, { headers: { "X-Forwarded-For": xff } }).then((r) => r.status);
    // The proxy appends the real client (rightmost). Varying the spoofable leftmost entry must not reset the quota.
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push(await hit(`10.0.0.${i}, 203.0.113.9`));
    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes.slice(3)).toEqual([429, 429]);
    expect((await fetch(`${b}/health`, { headers: { "X-Forwarded-For": "203.0.113.9" } })).status).toBe(200);
    await new Promise<void>((r) => s.close(() => r()));
  });
});

describe("capability matching (regressions)", () => {
  it("'Can I import from Jira?' surfaces the no-direct-importer answer first", async () => {
    const m = (await call("product_check_capability", { need: "Can I import from Jira?" })).structuredContent.matches;
    expect(m[0].id).toBe("import-competitors");
    expect(m[0].verdict).toBe("no");
  });
  it("'Do dependencies block tasks?' answers partial: warn, do not block", async () => {
    const m = (await call("product_check_capability", { need: "Do dependencies block tasks?" })).structuredContent.matches;
    expect(m[0].id).toBe("dependencies");
    expect(m[0].answer).toMatch(/do not block/);
  });
  it("per-user price is answered no, and the answer names a tool that exists", async () => {
    const m = (await call("product_check_capability", { need: "price per user" })).structuredContent.matches.find((x: { id: string }) => x.id === "price");
    expect(m.verdict).toBe("no");
    const names = (await rpc("tools/list")).result.tools.map((t: { name: string }) => t.name);
    for (const ref of m.answer.match(/\b[a-z]+_[a-z]+_[a-z]+\b/g) ?? []) expect(names).toContain(ref);
  });
});
