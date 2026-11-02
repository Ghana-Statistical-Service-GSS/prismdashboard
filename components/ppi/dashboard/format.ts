import type { AttentionKind, Series, Stage, SyncState, ViewLevel, WorkflowStatus } from "./types";

// Number and date formatting as on the CPI dashboards (en-GH).
export const number = new Intl.NumberFormat("en-GH");

export function count(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : number.format(value);
}

// A percentage the server could not compute (no denominator) is shown as
// unavailable, never as 0% or 100%.
export function pctText(value: number | null | undefined) {
  return value === null || value === undefined ? "n/a" : `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function day(value: string) {
  return new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function age(days: number | null | undefined) {
  if (days === null || days === undefined) return "—";
  if (days < 1) return "under 1 day";
  const whole = Math.floor(days);
  return `${whole} day${whole === 1 ? "" : "s"}`;
}

// CPI's coverage bands (OverviewPanel): red < 50, yellow < 80, green < 100.
export function tone(value: number | null | undefined) {
  if (value === null || value === undefined) return "bg-slate-100 text-prism-muted";
  return value < 50 ? "bg-red-100 text-red-700" : value < 80 ? "bg-yellow-100 text-yellow-800" : value < 100 ? "bg-emerald-100 text-emerald-800" : "bg-emerald-600 text-white";
}

export const STAGE_SHORT: Record<Stage, string> = { SUPERVISOR: "Supervisor", RS: "RS", HQ: "HQ" };
export const STAGE_LONG: Record<Stage, string> = { SUPERVISOR: "Supervisor", RS: "Regional Statistician", HQ: "HQ" };
export const SERIES_LABEL: Record<Series, string> = { SELLING: "Selling", PURCHASE: "Purchase", CONTRACT: "Contract" };
export const QUESTIONNAIRE_SHORT: Record<string, string> = {
  AGRICULTURE: "Agriculture", CONSTRUCTION: "Construction", OTHER: "Other sub-sectors", WHOLESALE_RETAIL: "Wholesale and retail",
};
export const LEVEL_LABEL: Record<ViewLevel, { one: string; many: string }> = {
  region: { one: "Region", many: "Regions" },
  district: { one: "District", many: "Districts" },
  supervisor: { one: "Supervisor", many: "Supervisors" },
  reader: { one: "Reader", many: "Readers" },
  establishment: { one: "Establishment", many: "Establishments" },
};

export const STATUS: Record<WorkflowStatus, { label: string; style: string }> = {
  NOT_STARTED: { label: "Not started", style: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "In progress", style: "bg-sky-100 text-sky-800" },
  SUBMITTED: { label: "Awaiting review", style: "bg-amber-100 text-amber-900" },
  RETURNED: { label: "Returned", style: "bg-rose-100 text-rose-800" },
  APPROVED: { label: "Finally approved", style: "bg-emerald-100 text-emerald-800" },
};

export function statusText(status: WorkflowStatus, stage?: Stage | null) {
  return status === "SUBMITTED" && stage ? `Awaiting ${STAGE_SHORT[stage]}` : STATUS[status].label;
}

export const SYNC: Record<SyncState, { label: string; hint: string; style: string }> = {
  CURRENT: { label: "In contact", hint: "Synced recently", style: "bg-emerald-100 text-emerald-800" },
  INACTIVE: { label: "No new work", hint: "Syncs, but has sent no change for days while work is open", style: "bg-amber-100 text-amber-900" },
  STALE: { label: "Stale sync", hint: "Not heard from for days: unsynced work on the phone is unknown", style: "bg-rose-100 text-rose-800" },
  NEVER: { label: "Never synced", hint: "No download or upload recorded", style: "bg-slate-200 text-slate-800" },
};

// Every attention kind the backend emits, in its order of urgency (the
// Record type makes a kind added to AttentionKind need a label here).
// warning: never blocks submission, shown in the warning style.
export const ATTENTION: Record<AttentionKind, { label: string; warning?: boolean }> = {
  REVIEW_WAITING: { label: "Waiting for review" },
  RETURNED: { label: "Correction outstanding" },
  NO_REFERENCE: { label: "No preloaded location" },
  REVENUE_MISMATCH: { label: "Revenue does not reconcile" },
  GPS_FAILED: { label: "Location check failed" },
  CURRENCY_MISMATCH: { label: "Prices in another currency" },
  PRICE_MONTH_MISMATCH: { label: "Current price differs from its history month", warning: true },
};
export const ATTENTION_KINDS = Object.keys(ATTENTION) as AttentionKind[];

export function isAttentionKind(kind: string): kind is AttentionKind {
  return Object.hasOwn(ATTENTION, kind);
}

// A kind this screen does not know yet (a newer backend) still gets a
// readable label rather than an empty one: "SOME_NEW_KIND" -> "Some new kind".
export function attentionLabel(kind: string) {
  if (isAttentionKind(kind)) return ATTENTION[kind].label;
  const words = kind.toLowerCase().replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Other issue";
}

export const ENTITY_LABEL: Record<string, string> = {
  ESTABLISHMENT: "General information", INITIATION: "Establishment / revenue", CATEGORY: "Major product category", PRODUCT: "Product",
  SEASONALITY: "Seasonality", SPECIFICATION: "Pricing specification", PRICE: "Price", QUARTERLY_REVENUE: "Quarterly revenue", GPS_CHECK: "GPS check",
  UNSPECIFIED: "Unspecified",
};

export const SECTION_LABEL: Record<string, string> = {
  GENERAL: "General information", ESTABLISHMENT: "Establishment and location", CATEGORIES: "Revenue and categories",
  PRODUCTS: "Products and prices", QUARTERLY: "Quarterly revenue", SEASONALITY: "Seasonality",
};
