#!/usr/bin/env node
// Regenerates data/site.json from a checkout of the TaskSiddhi website repo
// (the tasksiddhi.com website repository, trunk main). Read-only on the checkout.
//   node scripts/sync-from-site.mjs <path-to-site-checkout>
// Sources: public/llms.txt (pages), lib/alternatives.ts (comparisons),
// lib/constants.ts (plans, company), lib/templates.ts (template summaries).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
if (!root) { console.error("usage: sync-from-site.mjs <site checkout>"); process.exit(2); }
const read = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");

// ---- llms.txt ----
const llms = read("public/llms.txt").replace(/\r\n/g, "\n");
const lines = llms.split("\n");
const intro = (lines.find((l) => l.startsWith("> ")) || "").slice(2).trim();
const para = (prefix) => (llms.split("\n\n").find((p) => p.startsWith(prefix)) || "").trim();
const does = para("What TaskSiddhi does:");
const doesNot = para("What TaskSiddhi does not do:");
const pages = [];
let section = "", sub = "";
for (const l of lines) {
  if (l.startsWith("## ")) { section = l.slice(3).trim(); sub = ""; continue; }
  if (l.startsWith("### ")) { sub = l.slice(4).trim(); continue; }
  const m = l.match(/^- \[([^\]]+)\]\((https:\/\/tasksiddhi\.com[^)]*)\)(?:: (.*))?$/);
  if (m) pages.push({ section, subsection: sub, title: m[1], url: m[2], description: (m[3] || "").trim() });
}
const pricingNote = (llms.match(/## Pricing\n([^\n-][^\n]*)/) || [])[1] || "";

// ---- template summaries (regex over the source; llms.txt decides which are live) ----
const tsrc = read("lib/templates.ts");
const summaries = {};
for (const m of tsrc.matchAll(/\n {2,6}slug: "([a-z0-9-]+)",\n {2,6}name: "([^"]+)",[\s\S]*?\n {2,6}summary: "([^"]*)"/g)) {
  summaries[m[1]] = { name: m[2], summary: m[3] };
}
for (const p of pages) {
  const t = p.url.match(/^https:\/\/tasksiddhi\.com\/templates\/([a-z0-9-]+)$/);
  if (t && summaries[t[1]]) { p.description = p.description || summaries[t[1]].summary; p.slug = t[1]; }
}

// ---- constants (plan blocks) ----
const csrc = read("lib/constants.ts");
function grabArray(name) {
  const i = csrc.indexOf(`export const ${name}`);
  if (i < 0) return [];
  const start = csrc.indexOf("= [", i) + 2;
  const end = csrc.indexOf("\n];", start);
  return new Function(`return ${csrc.slice(start, end + 2)}`)();
}
const customPlan = grabArray("customPlan");
const planComparison = grabArray("planComparison");
const promise = (csrc.match(/export const noRemovalPromise = "([^"]+)"/) || [])[1] || "";

// ---- alternatives ----
const alt = await import(pathToFileURL(join(root, "lib/alternatives.ts")).href);
const alternatives = alt.alternatives.map((a) => ({
  slug: a.slug, name: a.name, checked: a.checked, checked_iso: alt.checkedIso(a.checked),
  url: `https://tasksiddhi.com/alternatives/${a.slug}`,
  sources: a.sources, summary: a.summary, rows: a.rows, they_win: a.theyWin, we_win: a.weWin, switch_note: a.switchNote,
}));

let commit = "unknown";
try { commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch {}
const out = {
  generated_from: { source: "tasksiddhi.com website, trunk main", commit },
  intro, does, does_not: doesNot, pricing_note: pricingNote, no_removal_promise: promise,
  plans: { free: "Free Forever", custom: "Custom" }, custom_plan: customPlan, plan_comparison: planComparison,
  pages, alternatives,
};
writeFileSync(new URL("../data/site.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`pages=${pages.length} alternatives=${alternatives.length} custom=${customPlan.length} cmp=${planComparison.length} commit=${commit}`);
