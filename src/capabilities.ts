import { SITE } from "./data.js";

export type Verdict = "yes" | "no" | "partial" | "not_stated";
export type Capability = {
  id: string;
  label: string;
  keywords: string[];
  verdict: Verdict;
  answer: string;
  url: string;
};

/**
 * Every row restates a line the website publishes (public/llms.txt, the feature
 * pages and /pricing). Nothing here is inferred. scripts/check-claims.mjs and the
 * tests fail if a row contradicts data/site.json. If the site does not say it,
 * the answer is "not_stated", never a guess.
 */
export const capabilities: Capability[] = [
  { id: "gantt", label: "Gantt or Timeline view", keywords: ["gantt", "timeline", "roadmap chart", "bars"], verdict: "no",
    answer: "No. TaskSiddhi has no Timeline or Gantt view. Dates are due dates and schedule dates on tasks; the Gantt chart template is a phased plan as a task board, not a chart.", url: `${SITE}/templates/gantt-chart` },
  { id: "guests", label: "Guest access or client share links", keywords: ["guest", "client access", "share link", "external", "client portal", "share board"], verdict: "no",
    answer: "No. There is no guest access and no client share links; everyone on a board is a member of the workspace.", url: `${SITE}/features/safety-and-control` },
  { id: "import-competitors", label: "Direct importer from Trello, Asana or Jira", keywords: ["trello import", "asana import", "jira import", "migrate", "migration", "importer", "switch from"], verdict: "no",
    answer: "No direct importer from Trello, Asana or Jira. Export to a spreadsheet (CSV or Excel) and use TaskSiddhi's spreadsheet import.", url: `${SITE}/features/capture` },
  { id: "spreadsheet-import", label: "Spreadsheet import", keywords: ["import", "csv import", "excel import", "spreadsheet", "upload"], verdict: "yes",
    answer: "Yes. Spreadsheet import (CSV or Excel) is built in.", url: `${SITE}/features/capture` },
  { id: "export", label: "CSV or Excel export", keywords: ["export", "download data", "csv export", "excel export", "backup"], verdict: "yes",
    answer: "Yes. CSV or Excel export, up to 10,000 rows per export.", url: `${SITE}/features/capture` },
  { id: "pdf-export", label: "PDF export", keywords: ["pdf"], verdict: "no", answer: "No. There is no PDF export.", url: `${SITE}/features` },
  { id: "scheduled-reports", label: "Scheduled report delivery", keywords: ["scheduled report", "email report", "report delivery", "weekly report email"], verdict: "no",
    answer: "No. Reports are viewed in the app; there is no scheduled report delivery.", url: `${SITE}/features/reporting` },
  { id: "billable", label: "Billable or utilisation reporting", keywords: ["billable", "utilisation", "utilization", "invoice time", "timesheet billing"], verdict: "no",
    answer: "No. There is no billable or utilisation report. Time tracking records time per task and per person.", url: `${SITE}/features/time-tracking` },
  { id: "time-tracking", label: "Time tracking", keywords: ["time tracking", "timer", "timesheet", "hours", "track time"], verdict: "yes",
    answer: "Yes. Time tracking is built in, with hours per day and time by person in the reports.", url: `${SITE}/features/time-tracking` },
  { id: "reports", label: "Burndown, velocity and cycle-time reports", keywords: ["report", "reporting", "burndown", "velocity", "cycle time", "analytics", "dashboard"], verdict: "yes",
    answer: "Yes. Burndown, weekly velocity, cycle time, hours per day, time by person and cross-board reports.", url: `${SITE}/features/reporting` },
  { id: "views", label: "Table, Kanban and Calendar views", keywords: ["kanban", "table view", "calendar", "board", "views", "sprint"], verdict: "yes",
    answer: "Yes. Table, Kanban, Calendar, Analytics, Activity, Sprints and Files views, plus My Work across boards.", url: `${SITE}/features/boards-and-views` },
  { id: "recurring", label: "Recurring tasks", keywords: ["recurring", "repeat", "amc", "scheduled job", "maintenance schedule"], verdict: "yes",
    answer: "Yes. Recurring tasks are supported, which is how AMC and service schedules are run.", url: `${SITE}/use-cases/service-jobs` },
  { id: "automation", label: "Automation (stage rules and actions)", keywords: ["automation", "rules", "workflow automation", "reminder", "stage rule"], verdict: "partial",
    answer: "Partly. Stage rules and three internal stage actions: create a rep task, send a reminder, schedule the next service. Dependencies warn but do not block.", url: `${SITE}/features/automation` },
  { id: "approvals", label: "Approvals", keywords: ["approval", "approve", "sign-off", "sign off"], verdict: "partial",
    answer: "Partly. Approvals record a decision but do not move the card.", url: `${SITE}/features/approvals` },
  { id: "roles", label: "Roles and permissions", keywords: ["role", "permission", "access control", "audit", "security"], verdict: "yes",
    answer: "Yes. Roles and per-stage permissions, a 60-second undo and an audit log.", url: `${SITE}/features/safety-and-control` },
  { id: "api", label: "REST API and webhooks", keywords: ["api", "webhook", "integration", "integrate"], verdict: "partial",
    answer: "A REST API and outbound webhooks are available. Custom integrations with your systems are part of the Custom plan.", url: `${SITE}/features/capture` },
  { id: "android", label: "Android app and web", keywords: ["android", "mobile", "phone", "web app"], verdict: "yes",
    answer: "Yes. Android and web.", url: `${SITE}/features/mobile` },
  { id: "ios", label: "Native iOS app", keywords: ["ios", "iphone", "ipad", "apple"], verdict: "no",
    answer: "No native iOS app. TaskSiddhi runs in the browser on iPhone.", url: `${SITE}/features/mobile` },
  { id: "offline", label: "Offline mode", keywords: ["offline", "no internet", "no signal"], verdict: "no",
    answer: "No. TaskSiddhi needs a connection.", url: `${SITE}/features/mobile` },
  { id: "customer-messaging", label: "Sending messages, quotes or invoices to customers", keywords: ["whatsapp", "send email", "email customers", "quote", "invoice", "customer message", "crm", "call"], verdict: "no",
    answer: "No. TaskSiddhi sends customers nothing: no WhatsApp, calls, email, quotes or invoices to customers. It is for the team's own work.", url: `${SITE}/about` },
  { id: "price", label: "Price per user", keywords: ["price", "pricing", "cost", "per user", "per seat", "free", "paid", "trial", "plan"], verdict: "yes",
    answer: "Free Forever is the whole product for the whole team: no per-user price, no trial, no payment card, in any market. Custom is quoted per team. Use the tasksiddhi_pricing tool.", url: `${SITE}/pricing` },
];

export function matchCapabilities(need: string): Capability[] {
  const q = need.toLowerCase();
  const hits = capabilities.filter((c) => c.keywords.some((k) => q.includes(k)) || q.includes(c.label.toLowerCase()));
  return hits;
}
