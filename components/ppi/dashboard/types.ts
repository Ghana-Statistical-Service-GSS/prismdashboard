// Shapes returned by /api/v1/ppi/dashboard/{overview,breakdown,activity,
// attention,initiations/:id/breakdown} (prism_backend/ppi/services/
// dashboard.service.js, where every figure is defined).

export type ScopeLevel = "NATIONAL" | "REGION" | "SUPERVISED" | "READER";
export type GroupLevel = "region" | "district" | "supervisor" | "reader";
export type ViewLevel = GroupLevel | "establishment";
export type Stage = "SUPERVISOR" | "RS" | "HQ";
export type Series = "SELLING" | "PURCHASE" | "CONTRACT";
export type WorkflowStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "RETURNED" | "APPROVED";
export type SyncState = "NEVER" | "STALE" | "INACTIVE" | "CURRENT";

export type Round = { roundId: string; roundCode: string; label: string; status: "PLANNED" | "OPEN" | "CLOSED"; reviewStages: Stage[] };

export type Scope = {
  level: ScopeLevel;
  primaryLevel: ViewLevel;
  levels: ViewLevel[];
  regionId: string | null;
  regionName: string | null;
  supervisorId: string | null;
  enumeratorId: string | null;
};

export type Observations = {
  total: number;
  currentTotal: number;
  historyTotal: number;
  current: Record<Series, number>;
  history: Record<Series, number>;
  historyNotAvailable: number;
};

export type ReaderSync = {
  state: SyncState;
  openWork: number;
  lastDownloadAt: string | null;
  lastUploadAt: string | null;
  lastChangeAt: string | null;
  lastUploadRefused: number;
  lastRefusalAt: string | null;
  lastRefusalCode: string | null;
  followUp: boolean;
};

export type GroupRow = {
  key: string | null;
  name: string | null;
  parentId: string | null;
  parentName: string | null;
  assigned: number;
  started: number;
  submitted: number;
  events: number;
  resubmissions: number;
  notStarted: number;
  inProgress: number;
  awaiting: number;
  awaitingByStage: Record<Stage, number>;
  returned: number;
  returnedRepeat: number;
  approved: number;
  coverage: number | null;
  approvedCoverage: number | null;
  observations: Observations;
  unmeasured: number;
  readers: { assigned: number; reporting: number; rate: number | null };
  syncFollowUp: number;
  lastSubmittedAt: string | null;
  oldestWaitingSince: string | null;
  oldestWaitingDays: number | null;
  oldestReturnSince: string | null;
  oldestReturnDays: number | null;
  regionNames: string | null;
  supervisorNames: string | null;
  sync?: ReaderSync;
};

export type EstablishmentRow = {
  establishmentId: string;
  initiationId: string | null;
  establishmentCode: string;
  establishmentName: string;
  questionnaireType: string;
  regionId: string | null;
  regionName: string | null;
  districtId: string | null;
  districtName: string | null;
  enumeratorId: string;
  readerName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  status: WorkflowStatus;
  reviewStage: Stage | null;
  submissions: number;
  returns: number;
  firstSubmittedAt: string | null;
  lastSubmittedAt: string | null;
  waitingSince: string | null;
  waitingDays: number | null;
  currentSubmissionId: string | null;
  lastChangeAt: string | null;
  observations: Observations;
  measured: boolean;
  outstanding: number | null;
  revenueCheck: string | null;
  gpsStatus: string | null;
  currencyMismatches: number | null;
  noReference: boolean;
  readerSync: { state: SyncState; lastContactAt: string | null } | null;
  // Warning only: specifications whose current price differs from the same
  // month in the history (server copy); null until measured.
  priceMonthMismatches: number | null;
};

export type Ratio = { done: number; expected: number; pct: number | null };

export type Completeness = {
  questionnaireType: string;
  assigned: number;
  started: number;
  submitted: number;
  measured: number;
  categoriesEntered: Ratio;
  categories: number;
  productCountsEntered: Ratio;
  productsAgainstDeclared: Ratio;
  productsSpecified: Ratio;
  specificationsComplete: Ratio;
  draftSpecifications: number;
  series: { series: Series; current: Ratio; historyDue: Ratio }[];
  historyLate: Ratio;
  historyNotAvailable: number;
  revenue: { match: number; mismatch: number; incomplete: number };
  outstandingItems: number;
  seasonality?: Ratio;
  quantitySold?: Ratio;
  saleFrequency?: Ratio;
  contractDetails?: Ratio;
  quarterlyRevenue?: Ratio;
};

export type Bottleneck = {
  stage: Stage;
  waiting: number;
  bands: [number, number, number, number];
  oldestSince: string | null;
  oldestDays: number | null;
  oldest: { establishmentName: string; establishmentCode: string; submissionId: string; regionName: string | null; readerName: string | null } | null;
};

export type Option = { id: string; name: string; regionId?: string | null; regionIds?: string[]; supervisorIds?: string[] };

export type Filters = {
  regionId: string | null;
  districtId: string | null;
  supervisorId: string | null;
  enumeratorId: string | null;
  questionnaireType: string | null;
};

export type Overview = {
  generatedAt: string;
  scope: Scope;
  round: Round | null;
  thresholds: { reviewAgeBandsDays: number[]; reviewAttentionDays: number; correctionAgeBandsDays: number[]; syncStaleDays: number };
  filters: {
    applied: Filters;
    options: { regions: Option[]; districts: Option[]; supervisors: Option[]; readers: Option[]; questionnaireTypes: string[] } | null;
  };
  headline?: GroupRow & { unassignedInitiations: number };
  // open: recommendations waiting for HQ; removed: cases HQ removed from the
  // round, left out of every other figure.
  removalRecommendations?: { open: number; removed: number };
  workflow?: { status: WorkflowStatus; stage?: Stage; count: number }[];
  groups?: { level: ViewLevel; rows: (GroupRow | EstablishmentRow)[]; total: number };
  bottlenecks?: Bottleneck[];
  corrections?: {
    returned: number;
    bands: [number, number, number, number];
    oldestSince: string | null;
    oldestDays: number | null;
    everReturned: number;
    cycles: { once: number; twice: number; threePlus: number };
    returnDecisions: number;
    approvedAfterReturn: number;
    commentsByRecordType: { entityType: string; comments: number; returns: number }[];
    returnsWithoutComments: number;
    reasonsCoded: boolean;
  };
  completeness?: Completeness[];
  quality?: {
    working: number;
    workingMeasured: number;
    withOutstanding: number;
    outstandingItems: number;
    outstandingBySection: Record<string, number>;
    revenueMismatch: number;
    // awayWithReason: captured more than 20 m away with the reader's reason (may be submitted), not yet approved.
    gps: { notCaptured: number; lowAccuracy: number; tooFar: number; unverified: number; noReference: number; awayWithReason?: number };
    currencyMismatch: number;
    // Warning only (never blocks submission): current price differs from the
    // same month in the history; working copies and cases under review.
    priceMonthMismatch: number;
    priceExceptionRules: null;
  };
  sync?: {
    readers: number;
    current: number;
    inactive: number;
    stale: number;
    staleWithOpenWork: number;
    never: number;
    refused: number;
    followUp: number;
    lastUploadAt: string | null;
    lastDownloadAt: string | null;
    lastChangeAt: string | null;
  };
  freshness?: {
    generatedAt: string;
    lastSubmittedAt: string | null;
    lastUploadAt: string | null;
    progressPending: number;
    progressRefreshed: number;
    // Another request held the refresh lock (it was recomputing while this
    // one counted); refreshLimit: what one request recomputes at most.
    refreshSkipped: boolean;
    refreshLimit: number;
    submissionsUnmeasured: number;
    refreshFailures: number;
  };
};

export type Breakdown<T> = { level: ViewLevel; rows: T[]; total: number; page: number; pageSize: number; status?: string | null };

export type ActivityDay = { day: string; firstSubmissions: number; resubmissions: number; finalApprovals: number; stageApprovals: number; returns: number };
export type Activity = { from: string; to: string; timeZone: string; days: ActivityDay[]; totals: Omit<ActivityDay, "day"> | null };

// The kinds the backend emits (prism_backend ppi/repositories/
// dashboard.repository.js ATTENTION; its dashboard test pins the list).
// A kind the screen does not know yet is still listed, with a neutral label.
export type AttentionKind =
  | "REVIEW_WAITING" | "RETURNED" | "NO_REFERENCE" | "REVENUE_MISMATCH" | "GPS_FAILED" | "CURRENCY_MISMATCH" | "PRICE_MONTH_MISMATCH";
export type AttentionRow = {
  // An AttentionKind, or one this screen does not know yet.
  kind: string;
  since: string | null;
  ageDays: number | null;
  establishmentId: string;
  initiationId: string | null;
  establishmentCode: string;
  establishmentName: string;
  questionnaireType: string;
  regionName: string | null;
  districtName: string | null;
  readerName: string | null;
  supervisorName: string | null;
  status: WorkflowStatus;
  reviewStage: Stage | null;
  submissions: number;
  returns: number;
  currentSubmissionId: string | null;
  outstanding: number | null;
  gpsStatus: string | null;
  priceMonthMismatches: number | null;
};
export type Attention = { rows: AttentionRow[]; total: number; page: number; pageSize: number; kinds: Record<string, number> };

export type SpecObservations = Partial<Record<Series, { current: number; history: number; notAvailable: number }>>;
// prism_backend ppi/dto/tree.dto.js removalRequestDto.
export type RemovalRequest = {
  reason: "CLOSED_PERMANENTLY" | "DUPLICATE" | "OUT_OF_SCOPE" | "CANNOT_LOCATE" | "OTHER";
  note: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  withdrawnAt: string | null;
  state: "OPEN" | "WITHDRAWN" | "APPROVED" | "DECLINED";
  active: boolean;
  decision: "APPROVED" | "DECLINED" | null;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
};
export type InitiationDetail = {
  source: "SUBMISSION" | "WORKING_COPY";
  initiation: {
    initiationId: string; workflowStatus: WorkflowStatus; reviewStage: Stage | null; submissionNo: number; currentSubmissionId: string | null; questionnaireType: string; lastChangeAt: string;
    // Removed from the round by HQ: outside every dashboard figure.
    removed: boolean;
    removalRequest: RemovalRequest | null;
  };
  establishment: {
    establishmentCode: string; establishmentName: string; regionId: string | null; regionName: string | null; districtId: string | null; districtName: string | null;
    enumeratorId: string | null; readerName: string | null; supervisorId: string | null; supervisorName: string | null;
  };
  submissions: { submissionId: string; submissionNo: number; submittedAt: string; submittedByName: string }[];
  measures: Record<string, number | string | Record<string, number>>;
  outstanding: string[];
  categories: {
    id: string; name: string; productCount: number | null; productsRecorded: number; issues: string[];
    products: { id: string; name: string; issues: string[]; specifications: { id: string; description: string; isDraft: boolean; observations: SpecObservations; issues: string[] }[] }[];
  }[];
};
