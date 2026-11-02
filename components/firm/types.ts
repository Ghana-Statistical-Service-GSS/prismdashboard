// Shapes of the firm's form API (backend ppi/services/firm-access.service.js)
// and the form's local copy of the interview.

export type QuestionnaireType = "AGRICULTURE" | "WHOLESALE_RETAIL" | "CONSTRUCTION" | "OTHER";
export type Series = "SELLING" | "PURCHASE" | "CONTRACT";
export type AmountState = "NOT_RECORDED" | "REPORTED" | "NOT_AVAILABLE" | "NOT_APPLICABLE";
export type Amount = { state: AmountState; amount?: string | null; enteredAt?: string | null };
export type Coded = { code: string | null; otherText: string };
export type Option = { code: string; label: string; only?: QuestionnaireType[] };

export type ApiError = { code?: string; message?: string; closedReason?: string | null; attemptsLeft?: number; retryAfterSeconds?: number; errors?: FieldError[] };
export type FieldError = { field: string; message: string };

export type OperationResult = {
  operationId: string;
  status: "APPLIED" | "CONFLICT" | "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "REJECTED" | "ERROR";
  code?: string;
  message?: string;
  id?: string;
  version?: number | null;
  errors?: FieldError[];
  closedReason?: string | null;
  initiation?: { initiationId: string; version: number };
};

export type Operation = {
  operationId: string;
  type: string;
  initiationId: string;
  recordId: string;
  expectedVersion: number | null;
  payload: Record<string, unknown>;
};

type TreePrice = { id: string; series: Series; kind: "CURRENT" | "HISTORY"; month: string; amount: Amount; reason: string | null; version: number };
type TreeSpec = {
  id: string; origin: string; sourceSpecId: string | null; isDraft: boolean; lastStep: string;
  details: { description: string | null; unit: Coded }; priceCurrency: Coded | null;
  terms: {
    customerMarket: Coded; discount: Coded; paymentTerms: Coded; transactionSizeText: string | null; packaging: Coded;
    quantitySold: string | null; saleFrequency: Coded; contractRegionId: string | null; contractDistrictId: string | null;
    materialType: string | null; contractCustomer: string | null; bridges: number | null; culverts: number | null;
    bridgesNotApplicable: boolean; culvertsNotApplicable: boolean; soilType: string | null; contractSpecification: string | null;
  };
  prices: TreePrice[]; version: number;
};
type TreeSeasonality = {
  producedAllYear: boolean | null; availableMonths: number[]; highProductionMonths: number[]; lowProductionMonths: number[];
  pricesSeasonal: boolean | null; hasNoSalePeriods: boolean | null; noSaleMonths: number[];
  salesLocations: { codes: string[]; otherText: string }; mainBuyer: Coded; version: number;
};
type TreeProduct = {
  id: string; name: string; followUp: { otherUnitsRemain: boolean | null; otherArrangementsRemain: boolean | null };
  revenuePercent: Amount; seasonality: TreeSeasonality | null; version: number; specifications: TreeSpec[];
};
type TreeCategory = {
  id: string; name: string; productCount: number | null; revenueBasis: "VALUE" | "PERCENT" | null; revenueValue: Amount;
  revenuePercent: Amount; referencePeriod: string; version: number; products: TreeProduct[];
};

export type ReadinessIssue = {
  id: string; message: string;
  target?: { step?: string; categoryId?: string; productId?: string; specId?: string; field?: string };
};
// PRICE_MONTH_MISMATCH: the current price against the latest month's price.
export type ReadinessWarning = {
  id: string; message: string; kind?: string; where?: string; series?: Series; month?: string; current?: string; history?: string;
  target?: ReadinessIssue["target"];
};
export type Contact = { name?: string; phone?: string | null; email?: string | null; hours?: string };

export type FirmFormResponse = {
  invite: { status: string; label: string; expiresAt: string; link: { slug: string; url: string; display: string } };
  questionnaireType: QuestionnaireType;
  establishment: { establishmentId: string; version: number; general: Record<string, string | null>; editableFields: string[] };
  initiation: {
    initiationId: string; version: number; questionnaireType: QuestionnaireType;
    establishmentInfo: { ghanaPostGps: string | null; farmType: string | null; sector: string | null };
    revenue: { currency: Coded; referencePeriod: string; annual: Amount; quarterly: { id: string; year: number; quarter: number; amount: Amount; version: number }[] };
    categories: TreeCategory[];
  };
  config: {
    revenueReferenceYear: number; priceHistory: { firstMonth: string; lastMonth: string }; fieldworkStartMonth: string;
    quarterlyRevenueYears: number[]; quarterlyRevenueRequired: boolean; productSeasonality: boolean; priceSeries: Series[];
    priceBasis: Partial<Record<Series, { label: string; basis: string }>>;
  };
  options: Record<string, Option[]>;
  reference: null | { regions: { regionId: string; regionName: string }[]; districts: { districtId: string; districtName: string; regionId: string }[] };
  readiness: { count: number; issues: Record<string, ReadinessIssue[]>; warnings: ReadinessWarning[] };
  // Who the firm can ask for help; offices only where the server configures them.
  contacts?: { enumerator: Contact | null; regionalOffice: Contact | null; hq: Contact | null };
};

// ------------------------------------------------------------------ local copy

export type Price = { id: string; specId: string; series: Series; kind: "CURRENT" | "HISTORY"; month: string; amount: Amount; reason: string; version: number | null };
export type Spec = {
  id: string; productId: string; version: number | null; origin: string; sourceSpecId: string | null;
  description: string; unit: Coded; priceCurrency: Coded | null;
  terms: {
    customerMarket: string | null; discount: Coded; paymentTerms: Coded; transactionSizeText: string; packaging: Coded;
    quantitySold: string; saleFrequency: Coded; contractRegionId: string | null; contractDistrictId: string | null;
    materialType: string; contractCustomer: string; bridges: string; culverts: string;
    bridgesNotApplicable: boolean; culvertsNotApplicable: boolean; soilType: string; contractSpecification: string;
  };
};
export type Seasonality = {
  productId: string; version: number | null; producedAllYear: boolean | null; availableMonths: number[]; highProductionMonths: number[];
  lowProductionMonths: number[]; pricesSeasonal: boolean | null; hasNoSalePeriods: boolean | null; noSaleMonths: number[];
  salesLocationCodes: string[]; salesLocationOther: string; mainBuyer: Coded;
};
export type Product = {
  id: string; categoryId: string; version: number | null; name: string; otherUnitsRemain: boolean | null;
  otherArrangementsRemain: boolean | null; revenuePercent: string;
};
export type Category = {
  id: string; version: number | null; name: string; productCount: string; revenueBasis: "VALUE" | "PERCENT" | null;
  revenueValue: string; revenuePercent: string; referencePeriod: string;
};
export type Quarter = { id: string; version: number | null; year: number; quarter: number; amount: Amount };

export type Doc = {
  qt: QuestionnaireType;
  establishmentId: string;
  establishmentVersion: number;
  general: Record<string, string>;
  initiationId: string;
  initiationVersion: number;
  info: { ghanaPostGps: string; farmType: string | null; sector: string | null };
  currency: Coded;
  annual: string;
  referencePeriod: string;
  categories: Category[];
  products: Product[];
  specs: Spec[];
  prices: Price[];
  seasonality: Seasonality[];
  quarters: Quarter[];
};
