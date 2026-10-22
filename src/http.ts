import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, TOOL_NAMES, COUNTS } from "./server.js";
import { site, SITE } from "./data.js";
import { VERSION } from "./version.js";
import { serverCard, landingHtml, llmsTxt, robotsTxt } from "./discovery.js";

export type HttpOptions = {
  publicUrl: string;
  rateLimitPerMinute: number;
  trustProxy: boolean;
  maxBodyBytes: number;
};

function intEnv(name: string, raw: string | undefined, def: number, min: number, max: number): number {
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}"`);
  return n;
}

export function optionsFromEnv(env: NodeJS.ProcessEnv = process.env): HttpOptions {
  const publicUrl = (env.PUBLIC_URL || "https://mcp.tasksiddhi.com").replace(/\/$/, "");
  try { new URL(publicUrl); } catch { throw new Error(`PUBLIC_URL is not a valid URL: "${publicUrl}"`); }
  return {
    publicUrl,
    rateLimitPerMinute: intEnv("RATE_LIMIT_PER_MINUTE", env.RATE_LIMIT_PER_MINUTE, 120, 1, 100000),
    trustProxy: env.TRUST_PROXY === "1",
    maxBodyBytes: intEnv("MAX_BODY_BYTES", env.MAX_BODY_BYTES, 65536, 1024, 1048576),
  };
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};
const SECURITY: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
};

function send(res: ServerResponse, status: number, body: string, type: string, extra: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...CORS, ...SECURITY, ...extra });
  res.end(body);
}
const json = (res: ServerResponse, status: number, obj: unknown, extra: Record<string, string> = {}) =>
  send(res, status, JSON.stringify(obj), "application/json; charset=utf-8", extra);
const rpcError = (res: ServerResponse, status: number, code: number, message: string, extra: Record<string, string> = {}) =>
  json(res, status, { jsonrpc: "2.0", error: { code, message }, id: null }, extra);

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) { chunks.length = 0; if (size - c.length <= max) reject(Object.assign(new Error("too large"), { code: "E2BIG" })); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createApp(opts: HttpOptions): Server {
  const hits = new Map<string, { n: number; reset: number }>();
  const MAX_TRACKED = 10_000;
  let lastSweep = Date.now();
  const limited = (ip: string) => {
    const now = Date.now();
    // Sweep on a clock, independent of which branch the request takes, and hard-cap the map.
    if (now - lastSweep > 30_000 || hits.size >= MAX_TRACKED) {
      for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
      lastSweep = now;
      if (hits.size >= MAX_TRACKED) hits.clear();
    }
    const h = hits.get(ip);
    if (!h || now > h.reset) { hits.set(ip, { n: 1, reset: now + 60_000 }); return false; }
    h.n += 1;
    return h.n > opts.rateLimitPerMinute;
  };

  return createHttpServer(async (req, res) => {
    const started = Date.now();
    let url: URL;
    try { url = new URL(req.url || "/", opts.publicUrl); }
    catch { return rpcError(res, 400, -32600, "Malformed request target."); }
    // Behind one trusted proxy the proxy appends the real client address last; the first entry is client-controlled.
    const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
    const ip = (opts.trustProxy && xff[xff.length - 1]) || req.socket.remoteAddress || "unknown";
    try {
      if (req.method === "OPTIONS") return send(res, 204, "", "text/plain");
      if (url.pathname !== "/health" && limited(ip)) return rpcError(res, 429, -32000, "Rate limit exceeded. Retry in a minute.", { "Retry-After": "60" });

      if (url.pathname === "/mcp" || url.pathname === "/") {
        if (url.pathname === "/" && req.method === "GET") return send(res, 200, landingHtml(opts.publicUrl), "text/html; charset=utf-8", { "Cache-Control": "public, max-age=300" });
        if (req.method !== "POST") {
          // Stateless server: no standalone SSE stream and no sessions to delete.
          return rpcError(res, 405, -32000, "Method not allowed. POST JSON-RPC to /mcp.", { Allow: "POST, OPTIONS" });
        }
        const ct = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (ct !== "application/json") return rpcError(res, 415, -32000, "Content-Type must be application/json.");
        let parsed: unknown;
        try { parsed = JSON.parse(await readBody(req, opts.maxBodyBytes)); }
        catch (e) {
          if ((e as { code?: string }).code === "E2BIG") { res.once("finish", () => req.destroy()); return rpcError(res, 413, -32000, "Request body too large.", { Connection: "close" }); }
          return rpcError(res, 400, -32700, "Parse error.");
        }
        // Stateless: a fresh server and transport per request, nothing shared between callers.
        for (const [k, v] of Object.entries({ ...CORS, ...SECURITY, "Cache-Control": "no-store" })) res.setHeader(k, v);
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
        await server.connect(transport);
        await transport.handleRequest(req, res, parsed);
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "method_not_allowed" }, { Allow: "GET, HEAD, OPTIONS" });

      switch (url.pathname) {
        case "/health": return json(res, 200, { status: "ok" });
        case "/version": return json(res, 200, { name: "tasksiddhi", version: VERSION, mcp_endpoint: `${opts.publicUrl}/mcp`, tools: TOOL_NAMES.length, ...COUNTS, site_mirror: site.generated_from });
        case "/.well-known/mcp.json":
        case "/.well-known/mcp/server-card.json":
          return json(res, 200, serverCard(opts.publicUrl), { "Cache-Control": "public, max-age=3600" });
        case "/llms.txt": return send(res, 200, llmsTxt(opts.publicUrl), "text/plain; charset=utf-8", { "Cache-Control": "public, max-age=3600" });
        case "/robots.txt": return send(res, 200, robotsTxt(opts.publicUrl), "text/plain; charset=utf-8", { "Cache-Control": "public, max-age=3600" });
        default: return json(res, 404, { error: "not_found", hint: `MCP endpoint: POST ${opts.publicUrl}/mcp. Site: ${SITE}` });
      }
    } catch (err) {
      // Never echo internals to the caller.
      console.error(JSON.stringify({ evt: "http.error", path: url.pathname, msg: (err as Error).message }));
      if (!res.headersSent) rpcError(res, 500, -32603, "Internal error.");
      else if (!res.writableEnded) res.end();
    } finally {
      console.log(JSON.stringify({ evt: "http", m: req.method, p: url.pathname, s: res.statusCode, ms: Date.now() - started }));
    }
  });
}
