"use client";

// Shapes returned by /api/v1/rebasing/dashboard/* (prism_backend/rebasing).

export type Period = {
  period_id: string;
  year: number;
  month: number;
  period_number: number | null;
  period_type: "NORMAL" | "BACKFILL";
  observation_month: string;
  collection_open_date: string | null;
  collection_close_date: string | null;
  status: "UPCOMING" | "OPEN" | "CLOSED";
  reference_fix_open: boolean;
  reference_fix_changed_at: string | null;
  week_count: number;
  market_plan_count: number;
  total_outlets: number;
};

export type MarketPlan = {
  plan_id: string;
  market_id: string;
  region_name: string;
  district_name: string;
  market_code: string | null;
  market_name: string;
  total_outlets: number;
  week1_target: number | null;
  week2_target: number | null;
  week3_target: number | null;
};

export type CloseReadiness = {
  ready: boolean;
  checks: Record<string, number>;
  blockers: { check: string; count: number }[];
};

export type Week = {
  week_id: string;
  week_no: number;
  week_type: "NORMAL" | "CATCH_UP";
  start_date: string;
  end_date: string;
  status: "UPCOMING" | "OPEN" | "CLOSED";
  effective_status: "CLOSED" | "NOT_OPEN" | "NOT_STARTED" | "ENDED" | "ACTIVE";
  collectable_now: boolean;
};

export type MetricRow = {
  region_id?: string;
  region_name?: string;
  market_id?: string;
  market_name?: string;
  markets?: number;
  original_target: number;
  completed_outlets: number;
  approved_outlet_carryforward: number;
  incoming_carryforward: number;
  operational_workload: number;
  accounted_outlets: number;
  quotes_submitted: number;
  pending_supervisor: number;
  pending_rs: number;
  pending_hq: number;
  rejected: number;
  final_approved: number;
  not_available: number;
  carryover_pending: number;
  carryover_obligations: number;
  duplicate_attempts: number;
  assignment_overrides: number;
  gps_outlets_checked: number;
  gps_outlets_far: number;
  gps_outlets_no_reference: number;
  reference_fixes: number;
};

export type ReaderMetricRow = {
  reader_id: string;
  reader_name: string;
  market_name: string;
  region_name: string;
  assignment_status: string;
  outlets_completed: number;
  quotes_submitted: number;
  rejected: number;
  final_approved: number;
  not_available: number;
  duplicate_attempts: number;
  gps_outlets_far: number;
};

export type ReviewStatus = "PENDING_SUPERVISOR" | "PENDING_RS" | "PENDING_HQ" | "REJECTED" | "FINAL_APPROVED";

export type ReviewQuote = {
  quote_id: string;
  period_id: string;
  week_no: number;
  review_status: ReviewStatus;
  revision_no: number;
  reader_name: string;
  region_name: string;
  district_name: string;
  market_id: string;
  market_name: string;
  outlet_code: string | null;
  outlet_name: string;
  item_code: string | null;
  item_name: string;
  product_name: string;
  price: string;
  previous_price: string | null;
  price_change_pct: string | null;
  price_change_flagged: boolean;
  weight_change_pct: string | null;
  weight_change_flagged: boolean;
  weight: string | null;
  previous_weight: string | null;
  uom_local: string | null;
  uom_standard: string | null;
  description: string | null;
  brand: string | null;
  reason_for_change: string | null;
  reference_source: "BASELINE" | "PERIOD" | null;
  // Reader's fix of the reference (HQ-controlled window). previous_price is
  // the fixed value; original_previous_price what the reader was shown. The
  // baseline_* fields are the untouched frozen reference.
  reference_fixed: boolean;
  reference_fix_reason: string | null;
  original_previous_price: string | null;
  original_previous_weight: string | null;
  baseline_uom_local: string | null;
  baseline_uom_standard: string | null;
  baseline_description: string | null;
  baseline_brand: string | null;
  frame_id: string;
  reference_image_available: boolean;
  captured_at: string | null;
  submitted_at: string | null;
  review_count: number;
};

export type QuoteReview = {
  review_id: string;
  quote_revision_no: number;
  stage: "SUPERVISOR" | "RS" | "HQ";
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  comment: string | null;
  reviewed_by_name: string;
  reviewed_at: string;
};

export type QuoteRevision = {
  revision_id: string;
  revision_no: number;
  price: string | null;
  weight: string | null;
  previous_price: string | null;
  brand: string | null;
  reference_fixed: boolean | null;
  reason_for_change: string | null;
  created_at: string;
};

export type Carryover = {
  carryover_id: string;
  source_week_no: number;
  target_week_no: number;
  market_name: string;
  outlet_name: string;
  outlet_code: string | null;
  scope_type: "OUTLET" | "ITEM" | "PRODUCT";
  item_name: string | null;
  product_name: string | null;
  reason: string;
  requested_by_name: string;
  requested_at: string;
  supervisor_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  supervisor_at: string | null;
  supervisor_comment: string | null;
  rs_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  rs_at: string | null;
  rs_comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
};

export class RebasingApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public blockers?: { check: string; count: number }[]) {
    super(message);
  }
}

export async function rebasingApi<T>(path: string, init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(`/api/dashboard/rebasing${path}`, {
    method: init?.method || "GET",
    cache: "no-store",
    signal: init?.signal,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new RebasingApiError(data?.error?.message || "The Market Reading service could not complete the request.", response.status, data?.error?.code, data?.error?.blockers);
  }
  return data as T;
}

export const number = new Intl.NumberFormat("en-GH");
const money = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `GHS ${money.format(parsed)}` : "—";
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  // Date-only strings are calendar dates; format them without a timezone shift.
  return new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function periodLabel(period: Pick<Period, "observation_month" | "period_type">) {
  const month = new Intl.DateTimeFormat("en-GH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period.observation_month}T00:00:00Z`));
  return period.period_type === "BACKFILL" ? `${month} · Backfill` : month;
}

export function percent(part: number, whole: number) {
  return whole > 0 ? Math.min((part / whole) * 100, 100) : 0;
}
