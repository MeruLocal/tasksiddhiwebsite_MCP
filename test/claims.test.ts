import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { site } from "../src/data.js";
import { capabilities } from "../src/capabilities.js";

const root = join(import.meta.dirname, "..");

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "research"].includes(f)) continue;
    const p = join(dir, f);
    statSync(p).isDirectory() ? files(p, out) : out.push(p);
  }
  return out;
}

describe("brand isolation (entity is Soor LLC)", () => {
  // Built so this file does not contain the forbidden words contiguously.
  const banned = [["Hello", "Growth"], ["hello", "crm"], ["Hello", "Books"], ["Me", "ru"], ["Kanchan", "Flow"]].map((p) => new RegExp(p.join(""), "i"));
  it("no repo file or served datum names a sibling brand or the parent company", () => {
    const targets = files(root).filter((f) => /\.(ts|json|md|mjs|yaml|yml|txt)$/.test(f) && !f.endsWith("package-lock.json") && !f.endsWith("claims.test.ts"));
    for (const f of targets) {
      const text = readFileSync(f, "utf8").replace(/MeruLocal\/tasksiddhiwebsite_MCP|github\.com\/MeruLocal/g, "");
      for (const re of banned) expect(re.test(text), `${f} matches ${re}`).toBe(false);
    }
  });
});

describe("pricing decision D1 (no price, no currency, no trial, no per-user figure)", () => {
  const own = JSON.stringify({ intro: site.intro, does: site.does, does_not: site.does_not, c: site.custom_plan, p: site.plan_comparison, caps: capabilities.map(({ keywords, ...c }) => c) });
  it("site mirror carries no currency figure outside competitor comparisons", () => {
    expect(own).not.toMatch(/[$₹£€]\s?\d|\bUSD\b|\bINR\b|per user per month|per seat/i);
    expect(site.intro).toMatch(/no per-user price/);
  });
  it("our side of every comparison row states no price figure", () => {
    for (const a of site.alternatives) for (const r of a.rows) expect(r.us, `${a.slug}/${r.label}`).not.toMatch(/[$₹£€]\s?\d/);
  });
});

describe("capability table agrees with the mirror", () => {
  const dn = site.does_not.toLowerCase();
  it("every NO capability is stated in the site's does-not-do paragraph", () => {
    const need: Record<string, string> = {
      gantt: "gantt", guests: "guest access", "import-competitors": "importer", "pdf-export": "pdf export",
      "scheduled-reports": "scheduled report", billable: "billable", ios: "native ios", offline: "offline", "customer-messaging": "sends customers nothing",
    };
    for (const [id, phrase] of Object.entries(need)) {
      expect(capabilities.find((c) => c.id === id)?.verdict, id).toBe("no");
      expect(dn, `site must say: ${phrase}`).toContain(phrase);
    }
  });
  it("every YES capability is stated in the site's does paragraph or its feature pages", () => {
    const d = site.does.toLowerCase();
    for (const [id, phrase] of Object.entries({ "time-tracking": "time tracking", reports: "burndown", views: "kanban", recurring: "recurring", roles: "roles", export: "10,000 rows", "spreadsheet-import": "spreadsheet import", android: "android" })) {
      expect(capabilities.find((c) => c.id === id)?.verdict, id).toBe("yes");
      expect(d, `site must say: ${phrase}`).toContain(phrase);
    }
  });
});

describe("links", () => {
  it("every canonical URL in the mirror and capability table is on tasksiddhi.com over https", () => {
    const urls = [...site.pages.map((p) => p.url), ...site.alternatives.map((a) => a.url), ...capabilities.map((c) => c.url)];
    for (const u of urls) expect(u).toMatch(/^https:\/\/tasksiddhi\.com(\/|$)/);
  });
  it("comparison facts are dated", () => {
    for (const a of site.alternatives) expect(a.checked_iso, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
