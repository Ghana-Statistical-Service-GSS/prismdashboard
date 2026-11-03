"use client";

// Steps 1, 2 and 4 of the firm's form: about the business (sections A and
// B), revenue and major product categories, quarterly revenue. Wording
// follows the questionnaires and the enumerator's app.
import { useId, useState } from "react";
import { AmountField, Button, Card, CodedField, errorFor, inputClass, NumberField, otherErrors, RecordStatus, SelectField, TextField } from "./fields";
import { incompleteEmail, key, money, newCategory, percentText, quarterAllowsNotAvailable, revenueSummary, uuid, type RevenueSummary } from "./model";
import type { Amount, Category, FirmFormResponse, QuestionnaireType } from "./types";
import type { useFirmForm } from "./useFirmForm";

export type Form = ReturnType<typeof useFirmForm>;

export const CATEGORY_NOUN = (qt: QuestionnaireType) => (qt === "CONSTRUCTION" ? "type of construction activity" : "major product category");
export const PRODUCT_NOUN = (qt: QuestionnaireType) => (qt === "CONSTRUCTION" ? "construction activity" : qt === "AGRICULTURE" ? "commodity" : "product");
export const CATEGORY_PLURAL = (qt: QuestionnaireType) => (qt === "CONSTRUCTION" ? "types of construction activity" : "major product categories");
export const PRODUCT_PLURAL = (qt: QuestionnaireType) => (qt === "CONSTRUCTION" ? "construction activities" : qt === "AGRICULTURE" ? "commodities" : "products");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function currencySymbol(code: string | null, other: string) {
  if (code === "OTHER") return other.trim() || "other currency";
  return ({ GHS: "GH₵", USD: "US$", GBP: "£", EUR: "€", CNY: "CN¥" } as Record<string, string>)[code || "GHS"] || code || "GH₵";
}

export const GENERAL_LABELS: Record<string, string> = {
  establishmentName: "Name of establishment",
  townLocality: "Town / locality",
  suburb: "Suburb",
  locationDescription: "Description of exact location",
  tin: "TIN (Taxpayer Identification Number)",
  contactPersonName: "Contact person's name",
  contactPersonPhone: "Contact person's telephone",
  contactPersonEmail: "Contact person's email",
  establishmentPhone: "Telephone of establishment",
  establishmentEmail: "Email of establishment",
  website: "Website",
};
const OPTIONAL = new Set(["suburb", "tin", "contactPersonEmail", "establishmentPhone", "establishmentEmail", "website"]);
const INPUT: Record<string, { type?: string; inputMode?: "tel" | "email"; autoComplete?: string }> = {
  contactPersonPhone: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  establishmentPhone: { type: "tel", inputMode: "tel" },
  contactPersonEmail: { type: "email", inputMode: "email", autoComplete: "email" },
  establishmentEmail: { type: "email", inputMode: "email" },
  website: { type: "url" },
};

export function GeneralStep({ f, form }: { f: Form; form: FirmFormResponse }) {
  const { doc } = f;
  const estErrors = f.errors.get(key.est);
  const initErrors = f.errors.get(key.init);
  const g = form.establishment.general;
  // Email fields left with a half-typed address: a hint, not a server error
  // (such an address is not sent until it is complete).
  const [left, setLeft] = useState<Set<string>>(() => new Set());
  const setGeneral = (field: string, value: string) => f.update((d) => { d.general[field] = value; }, [key.est]);
  const emailHint = (field: string) => (field.endsWith("Email") && left.has(field) && incompleteEmail(doc.general[field] ?? "")
    ? "Enter the full email address, e.g. name@example.com. It is saved once complete."
    : undefined);
  const setInfo = (field: "ghanaPostGps" | "farmType" | "sector", value: string | null) =>
    f.update((d) => { (d.info as Record<string, string | null>)[field] = field === "ghanaPostGps" ? value ?? "" : value; }, [key.init]);
  return (
    <div className="space-y-5">
      <Card title="A. General information" level={2} status={<RecordStatus pending={f.isPending(key.est)} error={estErrors?.message} />}>
        <p className="text-sm text-prism-muted">Please check these details and correct anything that is wrong.</p>
        {estErrors && !estErrors.errors.length ? <p className="text-sm font-medium text-red-700" role="alert">{estErrors.message}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {form.establishment.editableFields.map((field) => (
            <div key={field} className={field === "locationDescription" ? "sm:col-span-2" : ""}>
              <TextField
                label={doc.qt === "AGRICULTURE" && field === "establishmentName" ? "Farm name" : GENERAL_LABELS[field] || field}
                value={doc.general[field] ?? ""}
                optional={OPTIONAL.has(field)}
                multiline={field === "locationDescription"}
                error={emailHint(field) || errorFor(estErrors?.errors, `fields.${field}`)}
                onChange={(v) => setGeneral(field, v)}
                onBlur={field.endsWith("Email") ? () => setLeft((s) => new Set(s).add(field)) : undefined}
                testId={`general-${field}`}
                {...INPUT[field]}
              />
            </div>
          ))}
        </div>
        <dl className="grid gap-3 rounded-xl bg-prism-bg p-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Region</dt><dd>{g.regionName || "Not recorded"}</dd></div>
          <div><dt className="font-semibold">District</dt><dd>{g.districtName || "Not recorded"}</dd></div>
          <p className="text-prism-muted sm:col-span-2">If the region or district is wrong, tell your enumerator; they will correct it.</p>
        </dl>
      </Card>
      <Card title="B. Establishment information" level={2} status={<RecordStatus pending={f.isPending(key.init)} error={initErrors?.message} />}>
        {doc.qt !== "AGRICULTURE" ? (
          <TextField label="GhanaPost GPS address" placeholder="e.g. GA-184-9021" value={doc.info.ghanaPostGps} testId="info-ghanaPostGps"
            hint="The digital address of the establishment." error={errorFor(initErrors?.errors, "establishmentInfo.ghanaPostGps")}
            onChange={(v) => setInfo("ghanaPostGps", v)} />
        ) : null}
        {doc.qt === "AGRICULTURE" ? (
          <SelectField label="Type of agricultural activity" value={doc.info.farmType} options={form.options.farmType} testId="info-farmType"
            error={errorFor(initErrors?.errors, "establishmentInfo.farmType")} onChange={(v) => setInfo("farmType", v)} />
        ) : null}
        {doc.qt === "OTHER" ? (
          <SelectField label="Sector of establishment" value={doc.info.sector} options={form.options.sector} testId="info-sector"
            error={errorFor(initErrors?.errors, "establishmentInfo.sector")} onChange={(v) => setInfo("sector", v)} />
        ) : null}
      </Card>
    </div>
  );
}

export function RevenueStep({ f, form }: { f: Form; form: FirmFormResponse }) {
  const { doc } = f;
  const qt = doc.qt;
  const noun = CATEGORY_NOUN(qt);
  const initErrors = f.errors.get(key.init);
  const symbol = currencySymbol(doc.currency.code, doc.currency.otherText);
  const basis = doc.categories.find((c) => c.revenueBasis)?.revenueBasis ?? "VALUE";
  const year = doc.referencePeriod;
  const setBasis = (b: "VALUE" | "PERCENT") =>
    f.update((d) => { d.categories.forEach((c) => { c.revenueBasis = b; }); }, doc.categories.map((c) => key.cat(c.id)));
  const add = () => {
    const c = newCategory(doc, basis);
    f.update((d) => { d.categories.push(c); }, [key.cat(c.id)]);
  };
  const removeCategory = (id: string, name: string) => {
    if (!window.confirm(`Remove “${name || `this ${noun}`}” and all its products and prices?`)) return;
    f.remove("CAT", id, (d) => {
      const products = d.products.filter((p) => p.categoryId === id).map((p) => p.id);
      const specs = d.specs.filter((s) => products.includes(s.productId)).map((s) => s.id);
      const prices = d.prices.filter((p) => specs.includes(p.specId)).map((p) => p.id);
      d.categories = d.categories.filter((c) => c.id !== id);
      d.products = d.products.filter((p) => p.categoryId !== id);
      d.specs = d.specs.filter((s) => !specs.includes(s.id));
      d.prices = d.prices.filter((p) => !prices.includes(p.id));
      d.seasonality = d.seasonality.filter((s) => !products.includes(s.productId));
      return [...products, ...specs, ...prices];
    });
  };
  const summary = revenueSummary(doc, basis);
  const setCategory = (id: string, change: (c: Category) => void) =>
    f.update((d) => { change(d.categories.find((x) => x.id === id)!); }, [key.cat(id)]);
  const groups = qt === "CONSTRUCTION" ? "types of construction activity" : qt === "AGRICULTURE" ? "commodity groups" : "groups of products or services";
  const amountHeader = `Revenue in ${year} (${symbol})`;
  const shareHeader = "Share (%)";
  return (
    <div className="space-y-5">
      <Card title="Revenue" level={2} status={<RecordStatus pending={f.isPending(key.init)} error={initErrors?.message} />}>
        <p className="text-sm text-prism-muted">Give the establishment&apos;s own figures. The currency applies to the total, to every {noun} and to the quarterly revenue.</p>
        <CodedField label="Currency" value={doc.currency} options={form.options.currency} qt={qt} testId="revenue-currency"
          error={errorFor(initErrors?.errors, "revenue.currency")}
          onChange={(v) => f.update((d) => { d.currency = v.code ? v : { code: "GHS", otherText: "" }; }, [key.init])} />
        <NumberField label={`Total revenue for ${year} (${symbol})`} value={doc.annual} testId="revenue-annual"
          hint="The value of all sales in the year, before deductions." error={errorFor(initErrors?.errors, "revenue.annual")}
          onChange={(v) => f.update((d) => { d.annual = v; }, [key.init])} />
      </Card>

      <section className="space-y-5 rounded-2xl border border-prism-border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-prism-purple">Producer Price Index</p>
            <h2 className="text-xl font-bold text-prism-text sm:text-2xl">{cap(CATEGORY_PLURAL(qt))}</h2>
            <p className="text-sm text-prism-muted">List your main {groups}, starting with the largest source of revenue.</p>
          </div>
          <div className="shrink-0 rounded-xl bg-prism-purple/10 px-4 py-3" data-testid="annual-badge">
            <p className="text-sm text-prism-muted">Annual revenue · {year}</p>
            <p className="text-xl font-bold tabular-nums text-prism-text sm:text-2xl">
              {summary.totalCents !== null ? `${symbol} ${money(summary.totalCents)}` : "Not entered yet"}
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-prism-text">How would you like to report {qt === "CONSTRUCTION" ? "activity" : "category"} revenue?</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {([["VALUE", `Amount (${symbol})`], ["PERCENT", "Percentage (%)"]] as const).map(([code, label]) => (
              <label key={code} className={`flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 ${basis === code ? "border-prism-purple bg-prism-purple/5 font-semibold" : "border-gray-300 bg-white"}`}>
                <input type="radio" name="revenue-basis" checked={basis === code} onChange={() => setBasis(code)} className="h-5 w-5 accent-prism-purple" data-testid={`revenue-basis-${code.toLowerCase()}`} />
                {label}
              </label>
            ))}
          </div>
          <p className="text-sm text-prism-muted">
            {basis === "VALUE" ? "Enter amounts below. Percentage shares are calculated automatically." : "Enter percentages below. Amounts are calculated from the annual revenue."}
          </p>
        </fieldset>

        {doc.categories.length ? (
          <div role="table" aria-label={cap(CATEGORY_PLURAL(qt))} className="space-y-3 lg:space-y-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-prism-border">
            <div role="rowgroup" className="hidden lg:block">
              <div role="row" className={`${ROW_GRID} bg-prism-bg px-4 py-3 text-sm font-semibold text-prism-text`}>
                <span role="columnheader">#</span>
                <span role="columnheader">{cap(noun)}</span>
                <span role="columnheader">Number of {PRODUCT_PLURAL(qt)}</span>
                <span role="columnheader">{amountHeader}{basis === "PERCENT" ? <span className="block text-xs font-normal text-prism-muted">Calculated</span> : null}</span>
                <span role="columnheader">{shareHeader}{basis === "VALUE" ? <span className="block text-xs font-normal text-prism-muted">Calculated</span> : null}</span>
                <span role="columnheader">Action</span>
              </div>
            </div>
            <div role="rowgroup" className="space-y-3 lg:space-y-0">
              {doc.categories.map((c, index) => {
                const e = f.errors.get(key.cat(c.id));
                const row = summary.rows.get(c.id);
                return (
                  <div role="row" key={c.id} data-testid={`category-row-${index}`}
                    className={`${ROW_GRID} rounded-xl border border-prism-border p-4 lg:rounded-none lg:border-0 lg:border-t lg:px-4 lg:py-3`}>
                    <div role="cell" className="col-span-2 flex items-center gap-2 font-semibold text-prism-text lg:col-span-1 lg:min-h-11">
                      <span><span className="lg:sr-only">{cap(noun)} </span>{index + 1}</span>
                      <RecordStatus pending={f.isPending(key.cat(c.id))} error={e?.message} />
                    </div>
                    <div role="cell" className="col-span-2 lg:col-span-1">
                      <CellInput label={`Name of the ${noun}`} value={c.name} testId={`category-${index}-name`} error={errorFor(e?.errors, "name")}
                        placeholder={qt === "CONSTRUCTION" ? "e.g. Buildings" : qt === "AGRICULTURE" ? "e.g. Cereals" : "e.g. Soft drinks"}
                        onChange={(v) => setCategory(c.id, (x) => { x.name = v; })} />
                    </div>
                    <div role="cell">
                      <CellInput label={`Number of ${PRODUCT_PLURAL(qt)}`} value={c.productCount} testId={`category-${index}-count`} inputMode="numeric"
                        error={errorFor(e?.errors, "productCount")} onChange={(v) => setCategory(c.id, (x) => { x.productCount = v.replace(/\D/g, ""); })} />
                    </div>
                    <div role="cell">
                      {basis === "VALUE" ? (
                        <CellInput label={amountHeader} value={c.revenueValue} testId={`category-${index}-value`} inputMode="decimal" numeric
                          error={errorFor(e?.errors, "revenueValue")} onChange={(v) => setCategory(c.id, (x) => { x.revenueValue = v; x.revenueBasis = "VALUE"; })} />
                      ) : (
                        <Calculated label={amountHeader} value={row?.amountCents != null && summary.totalCents !== null ? money(row.amountCents) : "—"} />
                      )}
                    </div>
                    <div role="cell">
                      {basis === "PERCENT" ? (
                        <CellInput label={shareHeader} value={c.revenuePercent} testId={`category-${index}-percent`} inputMode="decimal" numeric
                          error={errorFor(e?.errors, "revenuePercent")} onChange={(v) => setCategory(c.id, (x) => { x.revenuePercent = v; x.revenueBasis = "PERCENT"; })} />
                      ) : (
                        <Calculated label={shareHeader} value={row?.shareMilli != null && summary.totalCents !== null ? percentText(row.shareMilli) : "—"} />
                      )}
                    </div>
                    <div role="cell" className="flex justify-end self-end lg:justify-start lg:self-start">
                      <button type="button" onClick={() => removeCategory(c.id, c.name)} data-testid={`category-${index}-remove`}
                        aria-label={`Remove ${c.name || `${noun} ${index + 1}`}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/40">
                        <TrashIcon />Remove
                      </button>
                    </div>
                    {e && (!e.errors.length || otherErrors(e.errors, CATEGORY_FIELDS).length) ? (
                      <p className="col-span-2 text-sm font-medium text-red-700 lg:col-span-6" role="alert">
                        {[e.message, ...otherErrors(e.errors, CATEGORY_FIELDS).map((x) => x.message)].join(" ")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div role="rowgroup">
              <div role="row" data-testid="category-total"
                className={`${ROW_GRID} rounded-xl bg-prism-bg p-4 font-semibold text-prism-text lg:rounded-none lg:border-t lg:border-prism-border lg:px-4`}>
                <span role="rowheader" className="col-span-2">Total</span>
                <span role="cell" className="lg:col-start-3"><span className="block text-xs font-normal text-prism-muted lg:sr-only">Number of {PRODUCT_PLURAL(qt)}</span>{summary.productCount}</span>
                <span role="cell" className="tabular-nums lg:text-right">
                  <span className="block text-xs font-normal text-prism-muted lg:sr-only">{amountHeader}</span>
                  {basis === "VALUE" || summary.totalCents !== null ? money(summary.sumCents) : "—"}
                </span>
                <span role="cell" className="tabular-nums">
                  <span className="block text-xs font-normal text-prism-muted lg:sr-only">{shareHeader}</span>
                  {summary.sumPercentMilli !== null ? percentText(summary.sumPercentMilli) : "—"}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="secondary" onClick={add} testId="add-category" className="shrink-0">+ Add {qt === "CONSTRUCTION" ? "activity type" : "category"}</Button>
          <p className="text-sm text-prism-muted">Number of {PRODUCT_PLURAL(qt)}: how many different {PRODUCT_PLURAL(qt)} you will report in each {qt === "CONSTRUCTION" ? "type" : "category"}.</p>
        </div>

        <RevenueCheck summary={summary} symbol={symbol} basis={basis} year={year} hasCategories={doc.categories.length > 0}
          groupWord={qt === "CONSTRUCTION" ? "activity type" : "category"} groupsWord={qt === "CONSTRUCTION" ? "activity types" : "categories"} />
      </section>
    </div>
  );
}

// Server error fields shown next to a category's inputs; any other error of
// the row is shown under it.
const CATEGORY_FIELDS = ["name", "productCount", "revenueValue", "revenuePercent"];

// # | name | count | amount | share | action (a stacked card below lg).
const ROW_GRID = "grid grid-cols-2 items-start gap-3 lg:grid-cols-[2rem_minmax(0,1fr)_8.5rem_10.5rem_7.5rem_7rem]";

function CellInput({ label, value, onChange, error, testId, placeholder, inputMode, numeric }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; testId?: string; placeholder?: string;
  inputMode?: "decimal" | "numeric"; numeric?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-prism-text lg:sr-only">{label}</label>
      <input id={id} value={value} placeholder={placeholder} inputMode={inputMode} data-testid={testId}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${numeric ? "text-right tabular-nums" : ""}`} onChange={(e) => onChange(e.target.value)} />
      {error ? <p id={`${id}-error`} className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function Calculated({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-prism-text lg:sr-only">{label}</p>
      <p className="flex min-h-11 items-center rounded-xl bg-gray-100 px-3 tabular-nums text-gray-600">
        <span className="sr-only">Calculated: </span>{value}
      </p>
    </div>
  );
}

function RevenueCheck({ summary, symbol, basis, year, hasCategories, groupWord, groupsWord }: {
  summary: RevenueSummary; symbol: string; basis: "VALUE" | "PERCENT"; year: string; hasCategories: boolean; groupWord: string; groupsWord: string;
}) {
  if (!hasCategories) return null;
  const { remainingCents: left, totalCents, missing } = summary;
  let tone: "ok" | "warn" | "bad";
  let title: string;
  let body: string;
  const percentLeft = basis === "PERCENT" && summary.sumPercentMilli !== null ? BigInt(100000) - summary.sumPercentMilli : null;
  if (totalCents === null || left === null) {
    tone = "warn";
    title = "Total revenue not entered";
    body = `Enter the total revenue for ${year} above; the ${groupsWord} are checked against it.`;
  } else if (left < BigInt(0)) {
    tone = "bad";
    title = `${cap(groupsWord)} add up to more than the annual revenue`;
    body = `${symbol} ${money(-left)} over the total of ${symbol} ${money(totalCents)}. Correct the ${groupsWord} or the total revenue above.`;
  } else if (left === BigInt(0) && !missing) {
    tone = "ok";
    title = "Revenue totals match";
    body = `${symbol} 0.00 remaining to allocate.`;
  } else {
    tone = "warn";
    title = missing ? `Revenue missing for ${missing} ${missing === 1 ? groupWord : groupsWord}` : "Revenue not fully allocated";
    body = `${symbol} ${money(left)}${percentLeft !== null && percentLeft > BigInt(0) ? ` (${percentText(percentLeft)})` : ""} remaining to allocate.`;
  }
  const styles = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    bad: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${styles}`} role="status" aria-live="polite" data-testid="revenue-check">
      {tone === "ok" ? <CheckIcon /> : <AlertIcon />}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm opacity-90">{body}</p>
      </div>
    </div>
  );
}

const TrashIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </svg>
);
const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0">
    <circle cx="12" cy="12" r="11" className="fill-emerald-700" />
    <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const AlertIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0">
    <circle cx="12" cy="12" r="11" className="fill-current opacity-80" />
    <path d="M12 7v6M12 16.5v.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export function QuarterlyStep({ f, form }: { f: Form; form: FirmFormResponse }) {
  const { doc } = f;
  const symbol = currencySymbol(doc.currency.code, doc.currency.otherText);
  const quarterLabel = ["January–March", "April–June", "July–September", "October–December"];
  return (
    <Card title="C. Quarterly revenue" level={2}>
      <p className="text-sm text-prism-muted">Revenue in each quarter, in {symbol}. A quarter that has not ended yet can be marked not available.</p>
      {form.config.quarterlyRevenueYears.map((year) => (
        <fieldset key={year} className="space-y-3">
          <legend className="text-base font-bold text-prism-text">{year}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((quarter) => {
              const q = doc.quarters.find((x) => x.year === year && x.quarter === quarter);
              const id = q?.id ?? null;
              const e = id ? f.errors.get(key.qtr(id)) : undefined;
              const set = (amount: Amount) => {
                const qid = id ?? uuid();
                f.update((d) => {
                  const existing = d.quarters.find((x) => x.id === qid);
                  if (existing) existing.amount = amount;
                  else d.quarters.push({ id: qid, version: null, year, quarter, amount });
                }, [key.qtr(qid)]);
              };
              return (
                <div key={quarter} className="space-y-1">
                  <AmountField label={`Q${quarter} ${year} (${quarterLabel[quarter - 1]})`} value={q?.amount ?? { state: "NOT_RECORDED" }}
                    allowNotAvailable={quarterAllowsNotAvailable(form.config.fieldworkStartMonth, year, quarter)}
                    error={errorFor(e?.errors, "amount") || (e && !e.errors.length ? e.message : undefined)} onChange={set} testId={`quarter-${year}-${quarter}`} />
                  {id ? <RecordStatus pending={f.isPending(key.qtr(id))} error={e?.message} /> : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </Card>
  );
}
