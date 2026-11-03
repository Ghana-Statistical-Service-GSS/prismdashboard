"use client";

// PPI: review shapes returned by /api/v1/ppi/dashboard/* (prism_backend/ppi),
// the module's fetch helper and its cache keys (dashboard shapes are in
// ./dashboard/types.ts). Nothing here is shared with the Market Reading or
// Market Initiation modules.

export type Amount = { state: "NOT_RECORDED" | "REPORTED" | "NOT_AVAILABLE" | "NOT_APPLICABLE"; amount?: string | null; enteredAt?: string | null };
export type Coded = { code: string | null; otherText: string };

export type QueueItem = {
  initiationId: string;
  workflowStatus: "IN_PROGRESS" | "SUBMITTED" | "RETURNED" | "APPROVED";
  reviewStage: "SUPERVISOR" | "RS" | "HQ" | null;
  submissionNo: number;
  currentSubmissionId: string | null;
  version: number;
  questionnaireType: string;
  establishmentId: string;
  establishmentCode: string;
  establishmentName: string;
  regionName: string | null;
  districtName: string | null;
  enumeratorName: string | null;
  submittedAt: string | null;
  roundLabel: string;
  canDecide: boolean;
  // The stage the reviewer's decision is recorded at: ahead of reviewStage
  // when they decide before an earlier stage (RS before the Supervisor, HQ at any).
  decidesAt?: "SUPERVISOR" | "RS" | "HQ" | null;
};

// `reason`: the enumerator's explanation where a price check asked for one
// (e.g. selling below purchase, a large change).
export type Price = { id: string; series: string; kind: "CURRENT" | "HISTORY"; month: string; amount: Amount; currency: Coded; version: number; reason?: string | null };
// prism_backend ppi/dto/tree.dto.js specificationDto terms. Optional: a
// snapshot keeps the shape of the day it was submitted, so fields added
// since are missing from older ones.
export type SpecificationTerms = {
  customerMarket?: Coded | null;
  discount?: Coded | null;
  paymentTerms?: Coded | null;
  transactionSizeText?: string | null;
  packaging?: Coded | null;
  quantitySold?: string | null; // NUMERIC as text
  saleFrequency?: Coded | null;
  contractRegionId?: string | null;
  contractDistrictId?: string | null;
  materialType?: string | null;
  contractCustomer?: string | null;
  bridges?: number | null;
  culverts?: number | null;
  bridgesNotApplicable?: boolean;
  culvertsNotApplicable?: boolean;
  soilType?: string | null;
  contractSpecification?: string | null;
};
export type Specification = {
  id: string; origin: string; isDraft: boolean; lastStep: string;
  details: { description: string; unit: Coded };
  priceCurrency: Coded | null;
  terms: SpecificationTerms;
  prices: Price[];
};
export type Seasonality = {
  producedAllYear: boolean | null; availableMonths: number[]; highProductionMonths: number[]; lowProductionMonths: number[];
  pricesSeasonal: boolean | null; hasNoSalePeriods: boolean | null; noSaleMonths: number[];
  salesLocations: { codes: string[]; otherText: string }; mainBuyer: Coded;
};
export type Product = { id: string; name: string; cpcCode?: string | null; followUp: { otherUnitsRemain: boolean | null; otherArrangementsRemain: boolean | null }; seasonality: Seasonality | null; specifications: Specification[] };
export type Category = { id: string; name: string; cpcCode?: string | null; productCount: number | null; revenueBasis: "VALUE" | "PERCENT" | null; revenueValue: Amount; revenuePercent: Amount; products: Product[] };
export type InterviewSnapshot = {
  initiationId: string;
  questionnaireType: string;
  establishmentInfo: { ghanaPostGps: string | null; farmType: string | null; sector: string | null; gpsDistanceReason?: string | null };
  revenue: { currency: Coded; referencePeriod: string; annual: Amount; quarterly: { id: string; year: number; quarter: number; amount: Amount }[] };
  categories: Category[];
  gpsChecks: { id: string; capturedAt: string; accuracyM: number | null; distanceM: string | null; clientDistanceM: number | null }[];
  // The firm entered answers on its web form (self-completed); absent in
  // snapshots made before the firm web form.
  selfCompleted?: boolean;
};
export type Snapshot = {
  schemaVersion: number;
  optionsVersion: number;
  options: Record<string, { code: string; label: string }[]>;
  establishment: {
    establishmentId: string;
    establishmentCode: string;
    general: Record<string, string | null>;
    referenceLatitude: string | null;
    referenceLongitude: string | null;
  };
  initiation: InterviewSnapshot;
  gpsVerdict: { accuracyOk: boolean; distanceOk: boolean | null; verified: boolean } | null;
  revenueCheck: { status: string; total?: string; sum?: string; difference?: string };
};

export type ReviewIssue = { entityType: string; recordId: string; field: string | null; comment: string };
export type ReviewEvent = {
  reviewEventId: string; submissionId: string; submissionNo: number; stage: string; decision: "APPROVED" | "RETURNED";
  reason: string | null; comment: string | null; issues: ReviewIssue[]; reviewerName: string; reviewedAt: string;
  // "SUBMITTED:<stage>": where the case waited when it was decided.
  statusBefore?: string;
};
export type SubmissionDetail = {
  submission: {
    submissionId: string; submissionNo: number; submittedByName: string; submittedAt: string; configVersion: number;
    snapshot: Snapshot; preload: Record<string, unknown>; config: Record<string, unknown>;
  };
  initiation: { initiationId: string; workflowStatus: string; reviewStage: string | null; version: number; submissionNo: number; currentSubmissionId: string | null };
  isCurrent: boolean;
  canDecide: boolean;
  decidesAt?: "SUPERVISOR" | "RS" | "HQ" | null;
  submissions: { submissionId: string; submissionNo: number; submittedByName: string; submittedAt: string }[];
  // Names of the contract regions/districts the snapshot refers to by id.
  places?: { regions: Record<string, string>; districts: Record<string, string> };
  reviewEvents: ReviewEvent[];
};
export type AuditChange = {
  changeId: number; entityType: string; recordId: string; operation: string;
  changes: Record<string, { old: unknown; new: unknown; oldDisplay?: string | null; newDisplay?: string | null }>;
  previousVersion: number | null; newVersion: number | null; actorName: string; loggedAt: string;
  // FIRM: entered by the firm on its web form (actorName is then the
  // enumerator who invited it).
  source?: "FIRM" | "ENUMERATOR";
};

export class PpiApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public errors?: { field: string; message: string }[]) {
    super(message);
  }
}

export async function ppiApi<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(`/api/dashboard/ppi${path}`, {
    method: init?.method || "GET",
    cache: "no-store",
    signal: init?.signal,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => null);
  // Session over: back to sign-in rather than an error no refresh can fix.
  if (response.status === 401 && typeof window !== "undefined") window.location.assign("/");
  if (!response.ok) {
    throw new PpiApiError(data?.error?.message || "The PPI service could not complete the request.", response.status, data?.error?.code, data?.error?.errors);
  }
  return data as T;
}

// Module-scoped cache keys: invalidating PPI never touches another module.
// Dashboard keys carry the signed-in user (whose scope the server applies)
// and every parameter of the request.
export const ppiKeys = {
  queue: (params: string) => `ppi:queue:${params}`,
  submission: (submissionId: string) => `ppi:submission:${submissionId}`,
  audit: (initiationId: string, filter: string) => `ppi:audit:${initiationId}:${filter}`,
  dashboard: (part: "overview" | "breakdown" | "activity" | "attention" | "initiation", userId: string, params: string) =>
    `ppi:dashboard:${part}:${userId}:${params}`,
};

export const STAGE_LABEL: Record<string, string> = { SUPERVISOR: "Supervisor", RS: "Regional Statistician", HQ: "HQ" };
export const QUESTIONNAIRE_LABEL: Record<string, string> = {
  AGRICULTURE: "Agriculture", WHOLESALE_RETAIL: "Wholesale and Retail", CONSTRUCTION: "Construction", OTHER: "Other sub-sectors",
};

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

// Decimal strings shown exactly as stored (thousands separators only).
export function formatDecimal(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const [whole, fraction] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

export function amountText(a: Amount | undefined, prefix = "") {
  switch (a?.state) {
    case "REPORTED": return `${prefix}${formatDecimal(a.amount ?? null)}`;
    case "NOT_AVAILABLE": return "Not available";
    case "NOT_APPLICABLE": return "Not applicable (legacy)";
    default: return "Not recorded";
  }
}

export function codedText(options: Snapshot["options"], list: string, value: Coded | null | undefined) {
  if (!value?.code) return "—";
  if (value.code === "OTHER") return value.otherText ? `Other: ${value.otherText}` : "Other (not specified)";
  return options[list]?.find((o) => o.code === value.code)?.label ?? value.code;
}
