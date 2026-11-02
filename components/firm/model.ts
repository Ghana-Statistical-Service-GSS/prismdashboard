// The form's local copy of the interview and the operations that save it.
// Operations are exactly the phone's (backend ppi/services/editing.service.js):
// each record is saved whole, with the version last seen (null to create).
// The firm never sends CPC codes, the removal recommendation, the GPS reason
// or region/district/questionnaire (the server refuses them).
import type { Amount, Category, Coded, Doc, FirmFormResponse, Operation, Price, Product, QuestionnaireType, Seasonality, Series, Spec } from "./types";

// crypto.randomUUID exists only on secure pages (https, localhost) and in
// browsers from 2021-22; a firm's older phone, or the form opened over a LAN
// address in development, has only getRandomValues: a v4 UUID from that.
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const blank = (v: string | null | undefined) => v ?? "";
const coded = (c: Coded | null | undefined): Coded => ({ code: c?.code ?? null, otherText: c?.otherText ?? "" });

// "1,250.50" or "1 250.5" as typed -> "1250.50"; the server checks the rest.
export const cleanNumber = (value: string) => value.replace(/[\s,]/g, "");

// ------------------------------------------------------------------ revenue check
// Exact, as the server's check (backend ppi/services/readiness.service.js
// revenueCheck): amounts in pesewas, percentages in thousandths of a percent,
// a percentage counting as that share of the total (half-up).
const ZERO = BigInt(0);
const PERCENT = BigInt(100000);

// "1,250.5" -> 125050 (dp 2); null when it is not a plain non-negative
// number with at most `dp` decimals (the server refuses it too).
export function units(value: string, dp: number): bigint | null {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(cleanNumber(value));
  if (!m || (m[2] ?? "").length > dp) return null;
  return BigInt(m[1] + (m[2] ?? "").padEnd(dp, "0"));
}
const divRound = (a: bigint, b: bigint) => (a * BigInt(2) + b) / (BigInt(2) * b);

// 125050 -> "1,250.50"
export function money(cents: bigint) {
  const digits = (cents < ZERO ? -cents : cents).toString().padStart(3, "0");
  return `${cents < ZERO ? "-" : ""}${digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${digits.slice(-2)}`;
}
// 33333 -> "33.3%" (shown to one decimal; the check itself is exact)
export const percentText = (milli: bigint) =>
  `${(Number(milli) / 1000).toLocaleString("en-GH", { maximumFractionDigits: 1 })}%`;

export type RevenueRow = { valueCents: bigint | null; percentMilli: bigint | null; shareMilli: bigint | null; amountCents: bigint | null };
export type RevenueSummary = {
  totalCents: bigint | null; rows: Map<string, RevenueRow>; missing: number;
  sumCents: bigint; sumPercentMilli: bigint | null; productCount: number;
  // total - categories; null without a total (a total of 0 counts)
  remainingCents: bigint | null;
};

export function revenueSummary(doc: Doc, basis: "VALUE" | "PERCENT"): RevenueSummary {
  const totalCents = units(doc.annual, 2);
  // Shares and calculated amounts need a total above zero; the check itself
  // (remaining) works with any reported total, 0 included, as the server's.
  const total = totalCents !== null && totalCents > ZERO ? totalCents : null;
  const rows = new Map<string, RevenueRow>();
  let valueCents = ZERO;
  let percentMilli = ZERO;
  let missing = 0;
  let productCount = 0;
  for (const c of doc.categories) {
    productCount += Number.parseInt(c.productCount, 10) || 0;
    const v = basis === "VALUE" ? units(c.revenueValue, 2) : null;
    const p = basis === "PERCENT" ? units(c.revenuePercent, 3) : null;
    if (v === null && p === null) missing += 1;
    if (v !== null) valueCents += v;
    if (p !== null) percentMilli += p;
    rows.set(c.id, {
      valueCents: v,
      percentMilli: p,
      shareMilli: v !== null && total ? divRound(v * PERCENT, total) : p,
      amountCents: p !== null && total ? divRound(total * p, PERCENT) : v,
    });
  }
  const sumCents = basis === "VALUE" ? valueCents : total ? divRound(total * percentMilli, PERCENT) : ZERO;
  return {
    totalCents, rows, missing, sumCents, productCount,
    sumPercentMilli: basis === "PERCENT" ? percentMilli : total ? divRound(valueCents * PERCENT, total) : null,
    remainingCents: totalCents !== null ? totalCents - sumCents : null,
  };
}
const amountOf = (value: string): Amount => (value.trim() === "" ? { state: "NOT_RECORDED" } : { state: "REPORTED", amount: cleanNumber(value) });
const amountText = (a: Amount | undefined) => (a?.state === "REPORTED" ? blank(a.amount ?? "") : "");
const textOrNull = (v: string) => (v.trim() === "" ? null : v);

export function fromServer(form: FirmFormResponse): Doc {
  const i = form.initiation;
  const doc: Doc = {
    qt: form.questionnaireType,
    establishmentId: form.establishment.establishmentId,
    establishmentVersion: form.establishment.version,
    general: Object.fromEntries(Object.entries(form.establishment.general).map(([k, v]) => [k, blank(v)])),
    initiationId: i.initiationId,
    initiationVersion: i.version,
    info: { ghanaPostGps: blank(i.establishmentInfo.ghanaPostGps), farmType: i.establishmentInfo.farmType, sector: i.establishmentInfo.sector },
    currency: coded(i.revenue.currency.code ? i.revenue.currency : { code: "GHS", otherText: "" }),
    annual: amountText(i.revenue.annual),
    referencePeriod: i.revenue.referencePeriod,
    categories: [],
    products: [],
    specs: [],
    prices: [],
    seasonality: [],
    quarters: i.revenue.quarterly.map((q) => ({ id: q.id, version: q.version, year: q.year, quarter: q.quarter, amount: q.amount })),
  };
  for (const c of i.categories) {
    doc.categories.push({
      id: c.id, version: c.version, name: c.name, productCount: c.productCount == null ? "" : String(c.productCount),
      revenueBasis: c.revenueBasis, revenueValue: amountText(c.revenueValue), revenuePercent: amountText(c.revenuePercent), referencePeriod: c.referencePeriod,
    });
    for (const p of c.products) {
      doc.products.push({
        id: p.id, categoryId: c.id, version: p.version, name: p.name, otherUnitsRemain: p.followUp.otherUnitsRemain,
        otherArrangementsRemain: p.followUp.otherArrangementsRemain, revenuePercent: amountText(p.revenuePercent),
      });
      if (p.seasonality) {
        const s = p.seasonality;
        doc.seasonality.push({
          productId: p.id, version: s.version, producedAllYear: s.producedAllYear, availableMonths: s.availableMonths,
          highProductionMonths: s.highProductionMonths, lowProductionMonths: s.lowProductionMonths, pricesSeasonal: s.pricesSeasonal,
          hasNoSalePeriods: s.hasNoSalePeriods, noSaleMonths: s.noSaleMonths, salesLocationCodes: s.salesLocations.codes,
          salesLocationOther: s.salesLocations.otherText, mainBuyer: coded(s.mainBuyer),
        });
      }
      for (const s of p.specifications) {
        const t = s.terms;
        doc.specs.push({
          id: s.id, productId: p.id, version: s.version, origin: s.origin, sourceSpecId: s.sourceSpecId,
          description: blank(s.details.description), unit: coded(s.details.unit), priceCurrency: s.priceCurrency ? coded(s.priceCurrency) : null,
          terms: {
            customerMarket: t.customerMarket.code, discount: coded(t.discount), paymentTerms: coded(t.paymentTerms),
            transactionSizeText: blank(t.transactionSizeText), packaging: coded(t.packaging), quantitySold: blank(t.quantitySold),
            saleFrequency: coded(t.saleFrequency), contractRegionId: t.contractRegionId, contractDistrictId: t.contractDistrictId,
            materialType: blank(t.materialType), contractCustomer: blank(t.contractCustomer),
            bridges: t.bridges == null ? "" : String(t.bridges), culverts: t.culverts == null ? "" : String(t.culverts),
            bridgesNotApplicable: t.bridgesNotApplicable, culvertsNotApplicable: t.culvertsNotApplicable, soilType: blank(t.soilType),
            contractSpecification: blank(t.contractSpecification),
          },
        });
        for (const pr of s.prices) {
          doc.prices.push({ id: pr.id, specId: s.id, series: pr.series, kind: pr.kind, month: pr.month, amount: pr.amount, reason: blank(pr.reason), version: pr.version });
        }
      }
    }
  }
  return doc;
}

// ------------------------------------------------------------------ record keys

// One outbox entry per record: INIT, EST, CAT:<id>, PROD:<id>, SEAS:<productId>,
// SPEC:<id>, PRICE:<id>, QTR:<id>, and DEL-CAT|DEL-PROD|DEL-SPEC:<id>.
export const key = {
  init: "INIT",
  est: "EST",
  cat: (id: string) => `CAT:${id}`,
  prod: (id: string) => `PROD:${id}`,
  seas: (productId: string) => `SEAS:${productId}`,
  spec: (id: string) => `SPEC:${id}`,
  price: (id: string) => `PRICE:${id}`,
  qtr: (id: string) => `QTR:${id}`,
};

export const recordIdOf = (k: string) => (k.includes(":") ? k.slice(k.indexOf(":") + 1) : k);

const SECTION_B: Record<QuestionnaireType, ("ghanaPostGps" | "farmType" | "sector")[]> = {
  AGRICULTURE: ["farmType"],
  WHOLESALE_RETAIL: ["ghanaPostGps"],
  OTHER: ["ghanaPostGps", "sector"],
  CONSTRUCTION: ["ghanaPostGps"],
};

function termsPayload(qt: QuestionnaireType, t: Spec["terms"]) {
  const int = (v: string) => (v.trim() === "" ? null : Number(cleanNumber(v)));
  switch (qt) {
    case "AGRICULTURE":
      return {
        packaging: t.packaging, customerMarket: { code: t.customerMarket }, discount: t.discount, paymentTerms: t.paymentTerms,
        quantitySold: textOrNull(cleanNumber(t.quantitySold)), saleFrequency: t.saleFrequency,
      };
    case "WHOLESALE_RETAIL":
      return { transactionSizeText: textOrNull(t.transactionSizeText), customerMarket: { code: t.customerMarket }, discount: t.discount, paymentTerms: t.paymentTerms };
    case "OTHER":
      return { customerMarket: { code: t.customerMarket }, discount: t.discount, paymentTerms: t.paymentTerms };
    default:
      return {
        contractRegionId: t.contractRegionId, contractDistrictId: t.contractDistrictId, materialType: textOrNull(t.materialType),
        contractCustomer: textOrNull(t.contractCustomer), bridges: t.bridgesNotApplicable ? null : int(t.bridges),
        culverts: t.culvertsNotApplicable ? null : int(t.culverts), bridgesNotApplicable: t.bridgesNotApplicable,
        culvertsNotApplicable: t.culvertsNotApplicable, soilType: textOrNull(t.soilType), contractSpecification: textOrNull(t.contractSpecification),
      };
  }
}

// The operation that saves record `k` as it is now (null: nothing to send).
// `tombstones`: versions of records deleted here, for their DELETE.
export function buildOp(doc: Doc, k: string, operationId: string, editable: string[], tombstones: Map<string, number | null>): Operation | null {
  const base = (type: string, recordId: string, expectedVersion: number | null, payload: Record<string, unknown>): Operation =>
    ({ operationId, type, initiationId: doc.initiationId, recordId, expectedVersion, payload });
  const id = recordIdOf(k);
  if (k === key.init) {
    const info = Object.fromEntries(SECTION_B[doc.qt].map((f) => [f, f === "ghanaPostGps" ? textOrNull(doc.info.ghanaPostGps) : doc.info[f]]));
    return base("INITIATION_UPDATE", doc.initiationId, doc.initiationVersion, { establishmentInfo: info, revenue: { currency: doc.currency, annual: amountOf(doc.annual) } });
  }
  if (k === key.est) {
    const fields = Object.fromEntries(editable.map((f) => [f, textOrNull(doc.general[f] ?? "")]));
    return base("ESTABLISHMENT_CORRECT", doc.establishmentId, doc.establishmentVersion, { fields });
  }
  if (k.startsWith("DEL-")) {
    const type = { "DEL-CAT": "CATEGORY_DELETE", "DEL-PROD": "PRODUCT_DELETE", "DEL-SPEC": "SPECIFICATION_DELETE" }[k.slice(0, k.indexOf(":"))]!;
    const version = tombstones.get(id);
    return version == null ? null : base(type, id, version, {});
  }
  if (k.startsWith("CAT:")) {
    const c = doc.categories.find((x) => x.id === id);
    if (!c) return null;
    const count = c.productCount.trim() === "" ? null : Number(c.productCount);
    return base("CATEGORY_UPSERT", id, c.version, {
      name: c.name, productCount: count == null || Number.isFinite(count) ? count : c.productCount, revenueBasis: c.revenueBasis,
      revenueValue: c.revenueBasis === "VALUE" ? amountOf(c.revenueValue) : { state: "NOT_RECORDED" },
      revenuePercent: c.revenueBasis === "PERCENT" ? amountOf(c.revenuePercent) : { state: "NOT_RECORDED" },
      referencePeriod: c.referencePeriod,
    });
  }
  if (k.startsWith("PROD:")) {
    const p = doc.products.find((x) => x.id === id);
    if (!p) return null;
    return base("PRODUCT_UPSERT", id, p.version, {
      categoryId: p.categoryId, name: p.name,
      followUp: { otherUnitsRemain: doc.qt === "CONSTRUCTION" ? false : p.otherUnitsRemain, otherArrangementsRemain: p.otherArrangementsRemain },
      revenuePercent: amountOf(p.revenuePercent),
    });
  }
  if (k.startsWith("SEAS:")) {
    const s = doc.seasonality.find((x) => x.productId === id);
    if (!s) return null;
    return base("SEASONALITY_UPSERT", id, s.version, {
      producedAllYear: s.producedAllYear, availableMonths: s.producedAllYear === false ? s.availableMonths : [],
      highProductionMonths: s.highProductionMonths, lowProductionMonths: s.lowProductionMonths, pricesSeasonal: s.pricesSeasonal,
      hasNoSalePeriods: s.hasNoSalePeriods, noSaleMonths: s.hasNoSalePeriods ? s.noSaleMonths : [],
      salesLocations: { codes: s.salesLocationCodes, otherText: s.salesLocationOther }, mainBuyer: s.mainBuyer,
    });
  }
  if (k.startsWith("SPEC:")) {
    const s = doc.specs.find((x) => x.id === id);
    if (!s) return null;
    return base("SPECIFICATION_UPSERT", id, s.version, {
      productId: s.productId, origin: s.origin, sourceSpecId: s.sourceSpecId, isDraft: false, lastStep: "PRICES",
      details: { description: s.description, unit: doc.qt === "CONSTRUCTION" ? null : s.unit },
      priceCurrency: s.priceCurrency?.code ? s.priceCurrency : null,
      terms: termsPayload(doc.qt, s.terms),
    });
  }
  if (k.startsWith("PRICE:")) {
    const p = doc.prices.find((x) => x.id === id);
    if (!p) return null;
    const month = p.kind === "CURRENT" ? currentMonth() : p.month;
    return base("PRICE_UPSERT", id, p.version, {
      specificationId: p.specId, series: p.series, kind: p.kind, month, amount: normalAmount(p.amount), reason: textOrNull(p.reason),
    });
  }
  if (k.startsWith("QTR:")) {
    const q = doc.quarters.find((x) => x.id === id);
    if (!q) return null;
    return base("QUARTERLY_UPSERT", id, q.version, { year: q.year, quarter: q.quarter, amount: normalAmount(q.amount) });
  }
  return null;
}

const normalAmount = (a: Amount): Amount => (a.state === "REPORTED"
  ? (String(a.amount ?? "").trim() === "" ? { state: "NOT_RECORDED" } : { state: "REPORTED", amount: cleanNumber(String(a.amount)) })
  : { state: a.state });

// Records the version the server answered with.
export function withVersion(doc: Doc, k: string, version: number | null | undefined) {
  if (version == null) return;
  const id = recordIdOf(k);
  if (k === key.init) doc.initiationVersion = version;
  else if (k === key.est) doc.establishmentVersion = version;
  else {
    const list = k.startsWith("CAT:") ? doc.categories : k.startsWith("PROD:") ? doc.products : k.startsWith("SPEC:") ? doc.specs
      : k.startsWith("PRICE:") ? doc.prices : k.startsWith("QTR:") ? doc.quarters : null;
    if (list) {
      const r = (list as { id: string; version: number | null }[]).find((x) => x.id === id);
      if (r) r.version = version;
    } else if (k.startsWith("SEAS:")) {
      const s = doc.seasonality.find((x) => x.productId === id);
      if (s) s.version = version;
    }
  }
}

// ------------------------------------------------------------------ months and price checks

export const currentMonth = () => new Date().toISOString().slice(0, 7);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export function monthRange(first: string, last: string) {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export const quarterAllowsNotAvailable = (fieldworkStartMonth: string, year: number, quarter: number) =>
  `${year}-${String(quarter * 3).padStart(2, "0")}` > fieldworkStartMonth;

// Prices that need a reason (the server's readiness rule, priceFlags):
// wholesale/retail - a purchase price above the selling price of the same
// month (reason on the selling price); others - a month more than 20% up or
// down from the previous recorded month. Keys: price ids.
export function flaggedPrices(prices: Price[], qt: QuestionnaireType, months: string[], series: Series[]) {
  const out = new Map<string, string>();
  const find = (s: Series, kind: "CURRENT" | "HISTORY", month: string) =>
    prices.find((p) => p.series === s && p.kind === kind && (kind === "CURRENT" || p.month === month));
  const value = (p: Price | undefined) => (p?.amount.state === "REPORTED" && String(p.amount.amount ?? "").trim() !== "" ? Number(cleanNumber(String(p.amount.amount))) : null);
  if (qt === "WHOLESALE_RETAIL") {
    for (const k of ["CURRENT", ...months]) {
      const kind = k === "CURRENT" ? "CURRENT" : "HISTORY";
      const sellRow = find("SELLING", kind, k);
      const sell = value(sellRow);
      const buy = value(find("PURCHASE", kind, k));
      if (sellRow && sell != null && buy != null && buy > sell) out.set(sellRow.id, `The purchase price (${buy}) is higher than the selling price (${sell}). Please give the reason.`);
    }
    return out;
  }
  for (const s of series) {
    let previous: { month: string; amount: number } | null = null;
    for (const m of months) {
      const row = find(s, "HISTORY", m);
      const amount = value(row);
      if (amount == null || !row) continue;
      if (previous && previous.amount > 0) {
        const change = (amount - previous.amount) / previous.amount;
        if (Math.abs(change) > 0.2 + 1e-9) {
          out.set(row.id, `This price is ${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100)}% from ${monthLabel(previous.month)}. Please give the reason.`);
        }
      }
      previous = { month: m, amount };
    }
  }
  return out;
}

// ------------------------------------------------------------------ new records

export const newCategory = (doc: Doc, basis: "VALUE" | "PERCENT"): Category =>
  ({ id: uuid(), version: null, name: "", productCount: "", revenueBasis: basis, revenueValue: "", revenuePercent: "", referencePeriod: doc.referencePeriod });
export const newProduct = (categoryId: string): Product =>
  ({ id: uuid(), categoryId, version: null, name: "", otherUnitsRemain: null, otherArrangementsRemain: null, revenuePercent: "" });
// Seasonality questions still to answer, as the server counts them
// (backend ppi/services/readiness.service.js seasonalityErrors).
export function seasonalityLeft(record: Seasonality | undefined): number {
  const s = record ?? newSeasonality("");
  let left = 0;
  if (s.producedAllYear === null || (!s.producedAllYear && !s.availableMonths.length)) left += 1;
  if (!s.highProductionMonths.length) left += 1;
  if (!s.lowProductionMonths.length) left += 1;
  if (s.pricesSeasonal === null) left += 1;
  if (s.hasNoSalePeriods === null || (s.hasNoSalePeriods && !s.noSaleMonths.length)) left += 1;
  if (!s.salesLocationCodes.length || (s.salesLocationCodes.includes("OTHER") && !s.salesLocationOther.trim())) left += 1;
  if (!s.mainBuyer.code || (s.mainBuyer.code === "OTHER" && !s.mainBuyer.otherText.trim())) left += 1;
  return left;
}

export const newSeasonality = (productId: string): Seasonality => ({
  productId, version: null, producedAllYear: null, availableMonths: [], highProductionMonths: [], lowProductionMonths: [],
  pricesSeasonal: null, hasNoSalePeriods: null, noSaleMonths: [], salesLocationCodes: [], salesLocationOther: "", mainBuyer: { code: null, otherText: "" },
});
export const newSpec = (productId: string, origin = "NEW"): Spec => ({
  id: uuid(), productId, version: null, origin, sourceSpecId: null, description: "", unit: { code: null, otherText: "" }, priceCurrency: null,
  terms: {
    customerMarket: null, discount: { code: null, otherText: "" }, paymentTerms: { code: null, otherText: "" }, transactionSizeText: "",
    packaging: { code: null, otherText: "" }, quantitySold: "", saleFrequency: { code: null, otherText: "" }, contractRegionId: null,
    contractDistrictId: null, materialType: "", contractCustomer: "", bridges: "", culverts: "", bridgesNotApplicable: false,
    culvertsNotApplicable: false, soilType: "", contractSpecification: "",
  },
});
