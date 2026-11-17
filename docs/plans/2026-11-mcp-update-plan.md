# Plan: TaskSiddhi MCP update from the 2026-11 site research

Status: **plan only**. No code, tool or data change is made by this PR. A human merges.
Date: 2026-11-17.

Inputs (pinned, because the research session may still be adding commits):

| Input | Repo / path | Commit |
|---|---|---|
| MCP update brief | site repo `Task-Siddhi-Web`, branch `research/loops-2026-11`, `docs/research/mcp-update-brief.md` | `078aaa5` (branch tip when read: `8f21d54`) |
| Market page plan | same branch, `docs/research/pages/market-page-plan-2026-11.md` + `market-page-inventory.csv` (271 rows) | `4bdf46d` |
| Site research PR | site repo PR #186 | open |
| Site trunk compared | site repo `origin/main` | `b099878` (2026-11-17) |
| This repo, trunk | `origin/scaffold-base` | `382d412` (LICENSE + README only) |
| This repo, in-flight server | PR #1, branch `feat/mcp-server-v1` | `b807317` (draft, 2026-10-22) |

If the brief changes after `078aaa5`, re-read it and fold the delta in before building.

---

## 1. Claim / Mechanism / Observable / Risk

| | |
|---|---|
| **Claim** | Assistants describe TaskSiddhi correctly (a task-management product for teams of 5 to 30, Free Forever plus quoted Custom, what it does and does not do, made by Soor LLC, never a CRM) when the MCP serves records generated from the site's single sources of truth with status, `last_verified` and `publication_status`. |
| **Mechanism** | Build on the server in PR #1 (generated mirror of the site trunk, 11 read-only tools, claims tests). Add the record envelope, `search` + `fetch`, market / page / dataset records from the market-page plan, and the brief's contradiction checks as pre-release tests. |
| **Observable** | The 10-prompt eval (section 6) passes. The section-4 contradiction test of the brief runs in `npm test` and fails on any price, per-user figure, trial, CRM wording or "not available" feature drift. |
| **Risk** | (a) Trunk has no server yet: this plan depends on PR #1. (b) Holiday datasets are regulated-adjacent data; serving a date list without an official dated source would be wrong for a whole region. (c) Planned pages served as live. |

## 2. Current server state (verified)

**Trunk (`scaffold-base` at `382d412`):** README ("Public, read-only MCP server for TaskSiddhi (by Soor LLC). Scaffold base; the server lands in the feature branch.") and LICENSE. No tools, no tests.

**PR #1 (`feat/mcp-server-v1` at `b807317`, draft, not merged):**

- Stateless Streamable HTTP (`POST /mcp`) plus stdio; no outbound calls at request time.
- **11 tools** (`<area>_<verb>_<noun>`, read-only annotations, `outputSchema`): `product_get_overview`, `product_check_capability`, `pricing_get_plans`, `site_search_pages`, `templates_search_templates`, `templates_get_template`, `calculators_search_tools`, `markets_list_countries`, `alternatives_list_competitors`, `alternatives_get_comparison`, `company_get_contact`. 7 resources, 3 prompts. (The PR title says 8 tools; the body and `src/server.ts` say 11.)
- Data: `data/site.json` generated from the site trunk at commit `5543b17` (129 pages, 9 alternatives).
- Tests: 37 (claims, completeness, hardening), including D1 pricing guards, "Gantt / guests / iOS / offline answered NO", unknown capability = `not_stated`, an encoded sibling-brand / parent-company deny list.
- Discovery: `/.well-known/mcp.json`, server card, `/llms.txt`, `/robots.txt`, `/health`, `/version`; registry packets in `docs/submissions/` (not submitted).

**Contradictions and staleness against the site (brief section 4 checklist):**

| # | Check (brief §4) | PR #1 | Site trunk `b099878` | Finding |
|---|---|---|---|---|
| T1 | Plan names and "no trial" | Free Forever + Custom; "no trial" | same (`public/llms.txt`, `lib/constants.ts`) | Consistent |
| T2 | Any price or per-user figure | none; guarded by tests | D1: no price on market pages | Consistent |
| T3 | SOC 2 wording | not served | live `/security` says no certification; founder fact is plain "SOC 2" (claim C-SOC2); repo gate governs | Nothing served; target serves plain wording only once the gate allows |
| T4 | Entity | Soor LLC, with registered address | Soor LLC | Consistent |
| T5 | CRM wording | competitor rows mention CRM suites; product never called a CRM | never a CRM | Consistent; keep a test |
| T6 | Not-available features (Gantt, importers, native iOS, guest access, scheduled reports) | answered NO | listed as not available | Consistent |
| T7 | hreflang / locale claims | `markets_list_countries` | markets US, GB, CA, AU, DE, FR, JP, IT plus IN; availability statement, no local price (D1) | To verify after re-sync: the market plan adds DE, FR, JP, IT pages that PR #1 cannot express yet |
| T8 | Page counts | 129 pages at `5543b17` | trunk has moved 3 commits since | Re-sync before merge; counts must be generated |
| T9 | FAQPage | not used as a data source | site emits FAQPage JSON-LD today (`components/long-page.tsx`, several templates); founder decision: off | MCP does not depend on it (good); site-side change proposal belongs to the site repo |
| T10 | Contact details | `company_get_contact` returns the registered address and security email | `public/llms.txt` also carries a phone number (founder question in the brief) | Serve only what the founder confirms for machine access |

## 3. Target contract: a public read-only knowledge layer

**Principles.** Read-only; no write tools, no authentication to competitors, no competitor prices. Numbers and plan facts come only from the site's `lib/constants.ts`, `lib/markets.ts`, `lib/limits.ts` and `public/llms.txt`, via `npm run sync`, at a recorded commit. Only `verified_public` records are served.

**Tools (2 retrieval + 8 verb-entity).** The brief's list, mapped onto PR #1 names where one exists so nothing is renamed without need. Each description states what / when / returns / not-for.

| Tool | Maps to (PR #1) | What | When | Returns | Not for |
|---|---|---|---|---|---|
| `search` | extends `site_search_pages` | Ranked search over records, `market?`, `family?`, `locale?` | First call | top N records | Planned pages as live |
| `fetch` | new | One record by canonical URL or id | To cite | full record | Arbitrary URLs |
| `pricing_get_plans` (`get_plan_summary`) | existing | Free Forever + Custom | Pricing | `plan[]` (no prices, no limits) | Quotes |
| `product_list_features` (`list_features`) | new | Features by status `available` / `not_available` | "What can it do / not do" | `feature[]` | Roadmap promises |
| `product_check_capability` (`get_feature`) | existing | One feature with its explaining page | "Does it do X" | `feature` | Unstated features (returns `not_stated`) |
| `markets_get_market` (`list_markets` / `get_market`) | extends `markets_list_countries` | Availability statement, language, hreflang group, status | "Can we use it in X" | `market` | Local prices (none exist, D1) |
| `pages_list_pages` (`list_pages`) | new | Page records by market, family, status | "Which page covers X in Y" | `page[]` | Planned pages as live |
| `templates_get_template` / `templates_search_templates` | existing | Template files and formats | Templates | `template` | Files that do not exist |
| `datasets_get_dataset` (`list_datasets` / `get_dataset`) | new | Holiday and working-day datasets by region and year | "UK bank holidays for sprint planning" | `dataset` | Any dataset without official source, Astra check, as-of and refresh dates |
| `claims_get_status` (`get_claim_status`) | new | Standing facts and held claims in plain wording | SOC 2, entity, CRM | `claim` | Details not on record |

`company_get_contact`, `calculators_search_tools` and the two `alternatives_*` tools from PR #1 stay; comparison output stays English-only, dated, sourced and price-free.

**Common record envelope:**

```ts
{
  id: string;                         // inventory page_id where one exists
  type: "page" | "dataset" | "feature" | "plan" | "market" | "claim" | "template" | "comparison";
  title: string;
  summary: string;
  canonical_url: Record<Locale, string>;
  market: "US" | "GB" | "CA" | "AU" | "DE" | "FR" | "JP" | "IT" | "IN" | "global";
  locale: string;
  family?: string;
  hreflang_group: string | null;      // only where an equivalent exists
  status: "available" | "beta" | "integration" | "coming_soon" | "unavailable";
  page_status?: "published" | "planned";
  last_verified: string;
  publication_status: "draft" | "verified_public" | "held";
  source_url: string;
  source_commit: string;
}
```

`dataset` adds `region`, `year`, `fields[]`, `source_url` (official), `source_date`, `as_of`, `refresh_date`, `astra_check: "passed" | "pending"`. Feature `available` / `not_available` from the site map to `available` / `unavailable`; the site's not-available wording is served verbatim.

**Output schemas.** Every tool declares an `outputSchema` (PR #1 already does) and returns validating `structuredContent`.

## 4. Record types: one per page family

From the market page plan section 2 at `4bdf46d` (8 families; the inventory splits tools into `calculator`, `template` and `dataset/template` rows):

| Page family (plan / inventory label, rows) | Record type | Fields beyond the envelope | Gate |
|---|---|---|---|
| Regional holiday planning (`regional-holiday-planning`, 102) | `holiday_planning_page` + linked `dataset` | `region`, `year`, `dataset_id`, `worked_example` | NEEDS-DATA; dataset needs official source + Astra check |
| National regulation guides (`regulation-guide`, 31) | `regulation_guide` | `jurisdiction`, `source_url`, `as_of`, `refresh_date`, `not_legal_advice: true` | BLOCKED-legal for "to verify" sources |
| Tools and templates with local inputs (`calculator` 16, `template` 16, `dataset/template` 8) | `local_tool` (`kind`: calculator / template / holiday_calendar) | `inputs[]`, `file_url`, `format`, `dataset_id` | NEEDS-DATA |
| Glossary (`glossary`, 8) | `glossary_page` | `terms[]`, `usage_evidence` | NEEDS-DATA / NEEDS-ASTRA-REVIEW |
| Research franchise (`research-franchise`, 16) | `research_dataset` | `method`, `computed_from[]`, `period` | official holiday sources first |
| Native-demand pages, DE / FR / JP / IT (`native-demand`, 19) | `native_page` | `keyword_evidence`, `astra_review` | NEEDS-ASTRA-REVIEW |
| Local competitor alternatives, English only (`local-competitor-alternative-en`, 7) | `comparison` | `competitor`, `rows[]` with `source_url`, `captured_on` | not per market; no prices |
| Local industry or role (`local-industry-role`, 48) | `industry_role_page` | `local_standard`, `source_url` | held (not counted) until a named local standard exists |

**8 family record types.** Core types: `plan`, `feature`, `market`, `claim`, `page`.

## 5. Change proposals for existing content (proposals only; nothing is removed)

Founder rule: ask before removing anything.

| # | Proposal | Why |
|---|---|---|
| P1 | Re-sync `data/site.json` from site trunk `b099878` (or later) before PR #1 merges; generate all counts | T8 |
| P2 | Fix the PR #1 title to match its 11 tools (or the body to match the title) | count drift |
| P3 | Add `last_verified` and `publication_status` to every PR #1 tool result | brief §6 |
| P4 | Add the brief's section-4 contradiction checklist as a pre-release test | brief §6 |
| P5 | Ask the founder whether machine-readable contact output may include the phone number the site's `llms.txt` carries; until then serve address and security email only | T10 |
| P6 | Serve SOC 2 only via `claims_get_status`, plain wording "SOC 2", once the site's repo gate allows it | T3 |
| P7 | Keep all existing PR #1 content; nothing in this plan removes a tool, resource or prompt | founder rule |

## 6. Eval suite (from the brief, section 5)

Pass = facts from the brief's section 1 only, `not_verified` when unknown, correct tool and URL.

| # | Prompt | Expected tool | Expected record | Expected URL / answer |
|---|---|---|---|---|
| 1 | Does TaskSiddhi have a free plan, and is there a trial? | `pricing_get_plans` | `plan: free-forever` | `/pricing`; Free Forever, no trial, no card |
| 2 | What does the Custom plan add? | `pricing_get_plans` | `plan: custom` | `/pricing`; custom integrations, higher fair-use limits, guided onboarding, priority support; no price |
| 3 | Does TaskSiddhi have a Gantt view? | `product_check_capability` | `feature: timeline-gantt` (unavailable) | No; the template page exists |
| 4 | Can I import from Trello directly? | `product_check_capability` | `feature: importer` (unavailable) | No; spreadsheet import |
| 5 | Is there a native iPhone app? | `product_check_capability` | `feature: native-ios` (unavailable) | No; the web app installs on iPhone |
| 6 | Who makes TaskSiddhi? | `claims_get_status` or `company_get_contact` | `claim: entity` | Soor LLC |
| 7 | Is TaskSiddhi a CRM? | `claims_get_status` / `product_get_overview` | `claim: positioning` | No; a task-management product |
| 8 | Is it SOC 2? | `claims_get_status` | `claim: C-SOC2` | plain wording from the claim register only; no type, scope or date |
| 9 | Show UK bank-holiday planning for England and Wales. | `datasets_get_dataset` | `dataset: GB-ENG-WLS-<year>` | served only with official source, passed Astra check and dates; otherwise `planned` |
| 10 | Compare TaskSiddhi with Trello. | `alternatives_get_comparison` | `comparison: trello` | dated, sourced facts; no prices; English only |

## 7. Security and MCP Registry readiness

- **No write or customer-action tools.** No sign-up, board creation, message sending or account access. `company_get_contact` returns links and addresses; it sends nothing.
- All tools keep read-only annotations; record set is closed.
- PR #1 hardening tests (body cap, media type, CORS on real responses, bounded limiter, env validation) stay mandatory.
- **MCP Registry listing only after a security review** of the hosted endpoint and the discovery files. The packets in PR #1 `docs/submissions/` stay unsubmitted until then.

## 8. Sequencing and gates

| Step | Work | Gate |
|---|---|---|
| 0 | Re-sync and land PR #1 (P1, P2) | Human merge; 37 tests green |
| 1 | Record envelope on every tool + contradiction test (P3, P4) | Eval 1–8 pass |
| 2 | `search` + `fetch`, `pages_list_pages` | No planned page linked as live |
| 3 | `claims_get_status` (P6) | Eval 6–8 pass |
| 4 | `datasets_get_dataset` + holiday planning records, US 3-state pilot first | Official dated source, blind Astra check, as-of and refresh dates per dataset |
| 5 | Regulation guide, tool, glossary, research records | Same figure rule; counsel read where the source is "to verify" |
| 6 | DE, FR, JP, IT native records | Astra language review; support language; Impressum for DE |
| 7 | Security review, then Registry submission | Section 7 |

**Facts fixed by founder decisions (do not reopen):**

- **SOC 2:** plain wording "SOC 2" only. No type, scope, date or auditor.
- **Legal entity:** Soor LLC.
- **Regulated figures** (tax, rates, incentives, legal thresholds, e-invoicing rules, and any holiday data used as a rule): official dated source plus an Astra check, with as-of and refresh dates; never from memory.
- **FAQPage markup is off.** The MCP does not read or emit it.

## 9. Open founder questions

1. Does D1 stand for the MCP too (availability statement only, no currency fields)?
2. May machine-readable contact output include the phone number (P5)?
3. Accept the honest page ceiling (US about 64 to 70, others 16 to 41) and the US 3-state pilot before state-by-state records?
4. When does the site's SOC 2 gate allow the plain "SOC 2" wording, so the MCP can serve it?
5. IN scope: inventory the existing India pages before adding IN records?
