import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export type Page = { section: string; subsection: string; title: string; url: string; description: string; slug?: string };
export type Alternative = {
  slug: string; name: string; checked: string; checked_iso: string; url: string;
  sources: { label: string; url: string }[]; summary: string;
  rows: { label: string; us: string; them: string }[];
  they_win: string[]; we_win: string[]; switch_note: string;
};
export type SiteData = {
  generated_from: { source: string; commit: string };
  intro: string; does: string; does_not: string; pricing_note: string; no_removal_promise: string;
  plans: { free: string; custom: string };
  custom_plan: { title: string; text: string }[];
  plan_comparison: { label: string; free: string | boolean; custom: string | boolean }[];
  pages: Page[];
  alternatives: Alternative[];
};

const here = dirname(fileURLToPath(import.meta.url));
export const packageRoot = join(here, "..");

export function loadSite(): SiteData {
  return JSON.parse(readFileSync(join(packageRoot, "data", "site.json"), "utf8")) as SiteData;
}

export const SITE = "https://tasksiddhi.com";
export const site = loadSite();

export const section = (prefix: string) => site.pages.filter((p) => p.section.startsWith(prefix));
export const templates = () => section("Templates");
export const freeTools = () => section("Free tools");

/** Words that carry no search signal. */
const STOP = new Set(["the", "a", "an", "for", "to", "of", "and", "in", "on", "with", "is", "does", "do", "how", "what", "free", "template", "templates", "tool", "tools", "software", "app"]);

export function tokens(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
}

/** Simple, deterministic relevance: title hits weigh more than description or URL hits. */
export function score(p: Page, toks: string[]): number {
  if (!toks.length) return 0;
  const title = p.title.toLowerCase();
  const desc = p.description.toLowerCase();
  const url = p.url.toLowerCase();
  let s = 0;
  for (const t of toks) {
    if (title.includes(t)) s += 3;
    if (url.includes(t)) s += 2;
    if (desc.includes(t)) s += 1;
  }
  return s;
}

export function rank(pages: Page[], query: string, limit: number): Page[] {
  const toks = tokens(query);
  if (!toks.length) return pages.slice(0, limit);
  return pages
    .map((p) => ({ p, s: score(p, toks) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}
