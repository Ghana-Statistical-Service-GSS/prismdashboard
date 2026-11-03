"use client";

// One pricing specification of the firm's form, as a page of its own (opened
// from the products step): 1 details, 2 terms of transaction (construction:
// contract specifications), 3.. prices per series (current price and the
// monthly table, with the change from the previous recorded month and the
// explanations the server asks for), and the product's follow-up questions.
import { useId } from "react";
import { Button, errorFor, inputClass, otherErrors } from "./fields";
import { cleanNumber, flaggedPrices, key, monthRange, uuid } from "./model";
import { currencySymbol, PRODUCT_NOUN, type Form } from "./sections";
import type { Amount, Coded, Doc, FirmFormResponse, Option, Price, Product, QuestionnaireType, Series, Spec } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLong = (ym: string) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

const UNIT_LABEL: Record<QuestionnaireType, string> = {
  AGRICULTURE: "Unit of commodity", WHOLESALE_RETAIL: "Unit of sale", OTHER: "Unit of measure", CONSTRUCTION: "Unit of measure",
};
const UNIT_HINT: Record<QuestionnaireType, string> = {
  AGRICULTURE: "Per unit of commodity, e.g. bag, box, kg, litre, tuber, sack, bunch.",
  WHOLESALE_RETAIL: "Per unit of product, e.g. box, bag, carton, piece, kg, litre.",
  OTHER: "Per unit of product, e.g. ounces, tonnes, 1.5 kg, 1.5 litres, nights, days, box, km, rooms.",
  CONSTRUCTION: "",
};
const DESCRIPTION_HINT: Record<QuestionnaireType, string> = {
  AGRICULTURE: "Include grade, quality and other characteristics that affect the price.",
  WHOLESALE_RETAIL: "Include brand, size and everything else that affects the price.",
  OTHER: "Include everything that affects the price of the product or service.",
  CONSTRUCTION: "For example: 100-metre bitumen road in Ashanti, 15-unit residential flat. Everything that affects the contract price.",
};

// Server error fields shown under the page's inputs; any other error of the
// specification is shown in the banner at the top.
const SPEC_FIELDS = ["details.description", "details.unit", "priceCurrency", ...[
  "packaging", "transactionSizeText", "customerMarket", "discount", "paymentTerms", "quantitySold", "saleFrequency", "contractRegionId",
  "contractDistrictId", "materialType", "contractCustomer", "bridges", "culverts", "soilType", "contractSpecification",
].map((f) => `terms.${f}`)];

// "Gram (g)" -> "g"; the text of "Other (specify)".
function unitShort(unit: Coded, options: Option[]) {
  if (!unit.code) return "";
  if (unit.code === "OTHER") return unit.otherText.trim();
  const label = options.find((o) => o.code === unit.code)?.label ?? unit.code;
  return /\(([^)]+)\)\s*$/.exec(label)?.[1] ?? label;
}

const numberOf = (a: Amount | undefined) =>
  a?.state === "REPORTED" && String(a.amount ?? "").trim() !== "" ? Number(cleanNumber(String(a.amount))) : null;

// Per month: the change from the previous month with a price (the rule the
// explanations follow), null where there is nothing to compare.
function changes(prices: Price[], s: Series, months: string[]) {
  const out = new Map<string, number | null>();
  let previous: number | null = null;
  for (const m of months) {
    const amount = numberOf(prices.find((p) => p.series === s && p.kind === "HISTORY" && p.month === m)?.amount);
    out.set(m, amount !== null && previous !== null && previous > 0 ? (amount - previous) / previous : null);
    if (amount !== null) previous = amount;
  }
  return out;
}
const changeText = (c: number) => {
  const pct = Math.abs(c * 100).toLocaleString("en-GH", { maximumFractionDigits: 1 });
  if (pct === "0") return "0%";
  return `${c > 0 ? "+" : "−"}${pct}%`;
};

// Prices entered / expected, and explanations still missing, for the list.
export function specProgress(doc: Doc, form: FirmFormResponse, spec: Spec) {
  const series = form.config.priceSeries;
  const months = monthRange(form.config.priceHistory.firstMonth, form.config.priceHistory.lastMonth);
  const prices = doc.prices.filter((p) => p.specId === spec.id);
  const flags = flaggedPrices(prices, doc.qt, months, series);
  const entered = prices.filter((p) => p.amount.state === "REPORTED" ? numberOf(p.amount) !== null : p.amount.state === "NOT_AVAILABLE").length;
  const missingReasons = [...flags.keys()].filter((id) => !prices.find((p) => p.id === id)?.reason.trim()).length;
  return { entered, expected: series.length * (months.length + 1), missingReasons };
}

export function SpecPage({ f, form, spec: s, product, index, onBack, onContinue, onAdd, onRemoved }: {
  f: Form; form: FirmFormResponse; spec: Spec; product: Product; index: number;
  onBack: () => void; onContinue: () => void; onAdd: () => void; onRemoved: () => void;
}) {
  const { doc } = f;
  const qt = doc.qt;
  const noun = PRODUCT_NOUN(qt);
  const k = key.spec(s.id);
  const e = f.errors.get(k);
  const opts = form.options;
  const t = s.terms;
  const set = (mutate: (x: Spec) => void) => f.update((d) => { mutate(d.specs.find((x) => x.id === s.id)!); }, [k]);
  const setTerm = <K extends keyof Spec["terms"]>(field: K, value: Spec["terms"][K]) => set((x) => { x.terms[field] = value; });
  const termErr = (field: string) => errorFor(e?.errors, `terms.${field}`);
  const remove = () => {
    if (!window.confirm("Remove this pricing specification and its prices?")) return;
    f.remove("SPEC", s.id, (d) => {
      const prices = d.prices.filter((x) => x.specId === s.id).map((x) => x.id);
      d.specs = d.specs.filter((x) => x.id !== s.id);
      d.prices = d.prices.filter((x) => x.specId !== s.id);
      return prices;
    });
    onRemoved();
  };
  const unitText = unitShort(s.unit, opts.unit);
  const revenueCurrency = doc.currency;
  const districts = (form.reference?.districts || []).filter((d) => d.regionId === t.contractRegionId);
  const series = form.config.priceSeries;
  let section = 2;

  return (
    <div className="space-y-5" data-testid="spec-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb" className="text-sm text-prism-muted">
            <button type="button" onClick={onBack} className="font-medium text-prism-purple underline-offset-2 hover:underline">{qt === "CONSTRUCTION" ? "Activities" : "Products"}</button>
            <span aria-hidden="true"> / </span>
            <span>{product.name || cap(noun)}</span>
          </nav>
          <h2 className="text-2xl font-bold text-prism-text sm:text-3xl">Pricing specification {index + 1}</h2>
          <p className="text-sm text-prism-muted">
            {qt === "CONSTRUCTION" ? "Describe the most recent contract, then enter its prices." : `Describe this ${noun} and its selling terms, then enter its prices.`}
          </p>
        </div>
        <button type="button" onClick={remove} data-testid="spec-remove"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-prism-purple hover:bg-prism-purple/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple/50">
          <TrashIcon />Remove specification
        </button>
      </div>
      {e && (!e.errors.length || otherErrors(e.errors, SPEC_FIELDS).length) ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
          {[e.message, ...otherErrors(e.errors, SPEC_FIELDS).map((x) => x.message)].join(" ")}
        </p>
      ) : null}

      <Section n={1} title={`${cap(noun)} details`}>
        <div className="divide-y divide-prism-border overflow-hidden rounded-xl border border-prism-border">
          <Row label={cap(noun)}>
            {(id) => <p id={id} className="flex min-h-11 items-center rounded-xl bg-gray-100 px-3 text-gray-700">{product.name || "—"}</p>}
          </Row>
          <Row label="Description" hint={DESCRIPTION_HINT[qt]} error={errorFor(e?.errors, "details.description")}>
            {(id, described) => <textarea id={id} rows={3} value={s.description} data-testid={`spec-${index}-description`} aria-describedby={described}
              aria-invalid={errorFor(e?.errors, "details.description") ? true : undefined} className={inputClass} onChange={(ev) => set((x) => { x.description = ev.target.value; })} />}
          </Row>
          {qt !== "CONSTRUCTION" ? (
            <Row label={UNIT_LABEL[qt]} hint={UNIT_HINT[qt]} error={errorFor(e?.errors, "details.unit")}>
              {(id, described) => <CodedControl id={id} described={described} value={s.unit} options={opts.unit} qt={qt} testId={`spec-${index}-unit`}
                onChange={(v) => set((x) => { x.unit = v; })} />}
            </Row>
          ) : null}
          <Row label="Price currency" hint="Same as revenue currency. Change only if these prices use another currency." error={errorFor(e?.errors, "priceCurrency")}>
            {(id, described) => <CodedControl id={id} described={described} value={s.priceCurrency ?? revenueCurrency} options={opts.currency} qt={qt}
              onChange={(v) => set((x) => {
                const same = v.code === revenueCurrency.code && (v.code !== "OTHER" || v.otherText.trim() === revenueCurrency.otherText.trim());
                x.priceCurrency = !v.code || same ? null : v;
              })} />}
          </Row>
        </div>
      </Section>

      <Section n={section} title={qt === "CONSTRUCTION" ? "Contract specifications" : "Sales & transaction terms"}
        intro={qt === "CONSTRUCTION" ? "About the most recent contract." : undefined}>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {qt === "AGRICULTURE" ? <Pair label="Packaging of commodity" error={termErr("packaging")}>{(id) => <CodedControl id={id} value={t.packaging} options={opts.packaging} qt={qt} testId={`spec-${index}-packaging`} onChange={(v) => setTerm("packaging", v)} />}</Pair> : null}
          {qt === "WHOLESALE_RETAIL" ? <Pair label="Size of transaction" error={termErr("transactionSizeText")}>{(id) => <input id={id} className={inputClass} placeholder="e.g. box of 15 kg, a pack of 10" value={t.transactionSizeText} data-testid={`spec-${index}-size`} onChange={(ev) => setTerm("transactionSizeText", ev.target.value)} />}</Pair> : null}
          {qt !== "CONSTRUCTION" ? (
            <>
              <Pair label="Type of customer" error={termErr("customerMarket")}>{(id) => <SelectControl id={id} value={t.customerMarket} options={opts.customerMarket} testId={`spec-${index}-customer`} onChange={(v) => setTerm("customerMarket", v)} />}</Pair>
              <Pair label="Discounts" error={termErr("discount")}>{(id) => <CodedControl id={id} value={t.discount} options={opts.discount} qt={qt} testId={`spec-${index}-discount`} onChange={(v) => setTerm("discount", v)} />}</Pair>
              <Pair label="Payment terms" error={termErr("paymentTerms")}>{(id) => <CodedControl id={id} value={t.paymentTerms} options={opts.paymentTerms} qt={qt} testId={`spec-${index}-payment`} onChange={(v) => setTerm("paymentTerms", v)} />}</Pair>
            </>
          ) : null}
          {qt === "AGRICULTURE" ? (
            <>
              <Pair label="Quantity of the commodity sold" error={termErr("quantitySold")}>
                {(id) => (
                  <div className="flex">
                    <input id={id} inputMode="decimal" value={t.quantitySold} data-testid={`spec-${index}-quantity`} onChange={(ev) => setTerm("quantitySold", ev.target.value)}
                      className={`${inputClass} ${unitText ? "rounded-r-none" : ""}`} />
                    {unitText ? <span className="flex min-h-11 max-w-[8rem] items-center truncate rounded-r-xl border border-l-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">{unitText}</span> : null}
                  </div>
                )}
              </Pair>
              <Pair label="Frequency of sale" error={termErr("saleFrequency")}>{(id) => <CodedControl id={id} value={t.saleFrequency} options={opts.saleFrequency} qt={qt} testId={`spec-${index}-frequency`} onChange={(v) => setTerm("saleFrequency", v)} />}</Pair>
            </>
          ) : null}
          {qt === "CONSTRUCTION" ? (
            <>
              <Pair label="Region of the site" error={termErr("contractRegionId")}>
                {(id) => <SelectControl id={id} value={t.contractRegionId} testId={`spec-${index}-region`}
                  options={(form.reference?.regions || []).map((r) => ({ code: r.regionId, label: r.regionName }))}
                  onChange={(v) => set((x) => { x.terms.contractRegionId = v; x.terms.contractDistrictId = null; })} />}
              </Pair>
              <Pair label="District of the site" error={termErr("contractDistrictId")}>
                {(id) => <SelectControl id={id} value={t.contractDistrictId} testId={`spec-${index}-district`} placeholder={t.contractRegionId ? "Choose…" : "Choose the region first"}
                  options={districts.map((d) => ({ code: d.districtId, label: d.districtName }))} onChange={(v) => setTerm("contractDistrictId", v)} />}
              </Pair>
              <Pair label="Type of material" hint="e.g. asphalt, concrete, sandcrete blocks" error={termErr("materialType")}>{(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={t.materialType} data-testid={`spec-${index}-material`} onChange={(ev) => setTerm("materialType", ev.target.value)} />}</Pair>
              <Pair label="Customer" hint="A code or customer type, e.g. a District Assembly" error={termErr("contractCustomer")}>{(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={t.contractCustomer} onChange={(ev) => setTerm("contractCustomer", ev.target.value)} />}</Pair>
              <Pair label="Number of bridges" error={termErr("bridges")}>
                {(id) => <CountNa id={id} value={t.bridges} na={t.bridgesNotApplicable} naLabel="No bridges (N/A)"
                  onValue={(v) => setTerm("bridges", v)} onNa={(c) => set((x) => { x.terms.bridgesNotApplicable = c; if (c) x.terms.bridges = ""; })} />}
              </Pair>
              <Pair label="Number of culverts" error={termErr("culverts")}>
                {(id) => <CountNa id={id} value={t.culverts} na={t.culvertsNotApplicable} naLabel="No culverts (N/A)"
                  onValue={(v) => setTerm("culverts", v)} onNa={(c) => set((x) => { x.terms.culvertsNotApplicable = c; if (c) x.terms.culverts = ""; })} />}
              </Pair>
              <Pair label="Soil type" hint="e.g. laterite, clay, sandy, rocky" error={termErr("soilType")}>{(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={t.soilType} onChange={(ev) => setTerm("soilType", ev.target.value)} />}</Pair>
              <Pair label="Other details (optional)" hint="Other specifications behind the contract value" error={termErr("contractSpecification")}>{(id, d) => <textarea id={id} aria-describedby={d} rows={2} className={inputClass} value={t.contractSpecification} onChange={(ev) => setTerm("contractSpecification", ev.target.value)} />}</Pair>
            </>
          ) : null}
        </div>
      </Section>

      {series.map((sr) => <PriceSection key={sr} n={++section} f={f} form={form} spec={s} series={sr} index={index} unitText={unitText} />)}

      <Section n={++section} title="Other specifications" intro={qt === "CONSTRUCTION" ? "Use a separate specification for each construction with different specifications." : "Use a separate specification for another unit or transaction arrangement."}>
        <FollowUp f={f} product={product} qt={qt} />
        <Button variant="secondary" onClick={onAdd} testId="spec-add-another">+ Add specification</Button>
      </Section>

      <div className="flex flex-wrap justify-between gap-3 border-t border-prism-border pt-4">
        <Button variant="secondary" onClick={onBack} testId="spec-back">Back to {qt === "CONSTRUCTION" ? "activities" : "products"}</Button>
        <Button onClick={onContinue} testId="spec-continue">Save &amp; continue <span aria-hidden="true">→</span></Button>
      </div>
    </div>
  );
}

function PriceSection({ n, f, form, spec, series: sr, index, unitText }: {
  n: number; f: Form; form: FirmFormResponse; spec: Spec; series: Series; index: number; unitText: string;
}) {
  const { doc } = f;
  const qt = doc.qt;
  const all = form.config.priceSeries;
  const months = monthRange(form.config.priceHistory.firstMonth, form.config.priceHistory.lastMonth);
  const prices = doc.prices.filter((p) => p.specId === spec.id);
  const flags = flaggedPrices(prices, qt, months, all);
  const change = changes(prices, sr, months);
  const symbol = spec.priceCurrency?.code ? currencySymbol(spec.priceCurrency.code, spec.priceCurrency.otherText) : currencySymbol(doc.currency.code, doc.currency.otherText);
  const label = form.config.priceBasis[sr]?.label || "Price";
  const basisText = form.config.priceBasis[sr]?.basis || "";
  const basis = qt === "AGRICULTURE" && unitText
    ? basisText.replace(/\bper unit of (product|commodity)\b/i, (m) => `${m[0] === "P" ? "P" : "p"}er ${unitText}`)
    : basisText;
  const find = (kind: "CURRENT" | "HISTORY", month?: string) => prices.find((p) => p.series === sr && p.kind === kind && (kind === "CURRENT" || p.month === month));
  const write = (kind: "CURRENT" | "HISTORY", month: string, mutate: (p: Price) => void) => {
    const existing = find(kind, month);
    const id = existing?.id ?? uuid();
    f.update((d: Doc) => {
      let row = d.prices.find((p) => p.id === id);
      if (!row) {
        row = { id, specId: spec.id, series: sr, kind, month, amount: { state: "NOT_RECORDED" }, reason: "", version: null };
        d.prices.push(row);
      }
      mutate(row);
    }, [key.price(id)]);
  };
  const priceError = (p: Price | undefined) => {
    if (!p) return undefined;
    const e = f.errors.get(key.price(p.id));
    return e ? errorFor(e.errors, "amount", "month", "reason") || e.message : undefined;
  };
  const amountOf = (v: string): Amount => (v.trim() === "" ? { state: "NOT_RECORDED" } : { state: "REPORTED", amount: v });
  const current = find("CURRENT");
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const range = years.length === 1 ? years[0] : `${monthLong(months[0])} – ${monthLong(months[months.length - 1])}`;
  const unexplained = months.some((m) => { const p = find("HISTORY", m); return p && flags.has(p.id) && !p.reason.trim(); })
    || (current && flags.has(current.id) && !current.reason.trim());
  const placeholder = (m: string) => {
    if (qt === "WHOLESALE_RETAIL") return "Explain why the purchase price is higher";
    return (change.get(m) ?? 0) > 0 ? "Explain the increase" : "Explain the decrease";
  };
  const currentId = useId();

  return (
    <Section n={n} title={`${label}s`} intro={basis} testId={`prices-${sr}`}>
      <div className="grid gap-2 md:grid-cols-[minmax(0,14rem)_minmax(0,16rem)_minmax(0,1fr)] md:items-center">
        <label htmlFor={currentId} className="text-sm font-semibold text-prism-text">Current {label.toLowerCase()}</label>
        <MoneyInput id={currentId} symbol={symbol} value={current?.amount.state === "REPORTED" ? String(current.amount.amount ?? "") : ""} placeholder="Enter current price"
          testId={`spec-${index}-${sr}-current`} invalid={!!priceError(current)} onChange={(v) => write("CURRENT", "", (x) => { x.amount = amountOf(v); })} />
        <p className="text-sm text-prism-muted">Price today. Separate from the monthly prices below.</p>
        {priceError(current) ? <p className="text-sm font-medium text-red-700 md:col-start-2 md:col-span-2" role="alert">{priceError(current)}</p> : null}
        {current && flags.has(current.id) ? (
          <div className="space-y-1 md:col-start-2 md:col-span-2">
            <input aria-label={`Reason for the current ${label.toLowerCase()}`} className={`${inputClass} border-amber-400`} placeholder="Explain why the purchase price is higher"
              value={current.reason} onChange={(ev) => write("CURRENT", "", (x) => { x.reason = ev.target.value; })} />
            <p className="text-xs text-amber-900">{flags.get(current.id)}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-prism-border pt-5">
        <div>
          <h4 className="text-lg font-bold text-prism-text">Monthly prices · {range}</h4>
          <p className="text-sm text-prism-muted">Enter the price on or around the 15th of each month.</p>
        </div>
        <div role="table" aria-label={`Monthly ${label.toLowerCase()}s`} className="overflow-hidden rounded-xl border border-prism-border">
          <div role="row" className={`${MONTH_GRID} hidden bg-prism-bg px-4 py-2.5 text-sm font-semibold text-prism-text md:grid`}>
            <span role="columnheader">Month</span>
            <span role="columnheader">Price ({symbol})</span>
            <span role="columnheader">Change from previous month</span>
            <span role="columnheader">Explanation</span>
          </div>
          {months.map((m) => {
            const p = find("HISTORY", m);
            const flagged = !!p && flags.has(p.id);
            const late = m > form.config.fieldworkStartMonth;
            const na = p?.amount.state === "NOT_AVAILABLE";
            const c = change.get(m) ?? null;
            const err = priceError(p);
            return (
              <div role="row" key={m} data-testid={`month-${sr}-${m}`}
                className={`${MONTH_GRID} items-center border-t border-prism-border px-4 py-2.5 first:border-t-0 md:first:border-t ${flagged ? "bg-amber-50" : ""}`}>
                <span role="cell" className={`text-sm ${flagged ? "font-semibold text-amber-950" : "text-prism-text"}`}>{monthLong(m)}</span>
                <span role="cell" className="col-span-2 row-start-2 space-y-1 md:col-span-1 md:row-start-auto">
                  {na ? (
                    <span className="flex min-h-10 items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 text-sm text-prism-muted">Not available</span>
                  ) : (
                    <input aria-label={`${label}, ${monthLong(m)}`} inputMode="decimal" data-testid={`spec-${index}-${sr}-${m}`}
                      value={p?.amount.state === "REPORTED" ? String(p.amount.amount ?? "") : ""} aria-invalid={err ? true : undefined}
                      className={`${inputClass} min-h-10 py-1.5 text-right tabular-nums`} onChange={(ev) => write("HISTORY", m, (x) => { x.amount = amountOf(ev.target.value); })} />
                  )}
                  {late ? (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-prism-muted">
                      <input type="checkbox" checked={na} className="h-4 w-4 accent-prism-purple" data-testid={`spec-${index}-${sr}-${m}-na`}
                        onChange={(ev) => write("HISTORY", m, (x) => { x.amount = ev.target.checked ? { state: "NOT_AVAILABLE" } : { state: "NOT_RECORDED" }; })} />
                      Not available yet
                    </label>
                  ) : null}
                  {err ? <span className="block text-xs font-medium text-red-700" role="alert">{err}</span> : null}
                </span>
                <span role="cell" className={`flex items-center justify-end gap-1.5 text-sm md:justify-start ${flagged ? "font-bold text-amber-800" : "text-prism-muted"}`}>
                  {c === null ? <span aria-label="No change to show">—</span> : (
                    <>
                      <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none ${flagged ? "border-amber-700" : "border-gray-400"}`}>{flagged ? "!" : "–"}</span>
                      {changeText(c)}
                    </>
                  )}
                </span>
                <span role="cell" className={`col-span-2 md:col-span-1 ${flagged ? "" : "hidden md:block"}`}>
                  {flagged && p ? (
                    <span className="flex items-center gap-3">
                      <input aria-label={`Explanation, ${monthLong(m)}`} placeholder={placeholder(m)} value={p.reason} data-testid={`spec-${index}-${sr}-${m}-reason`}
                        title={flags.get(p.id)} className={`${inputClass} min-h-10 flex-1 py-1.5 text-sm`} onChange={(ev) => write("HISTORY", m, (x) => { x.reason = ev.target.value; })} />
                      {!p.reason.trim() ? <span className="shrink-0 text-xs font-semibold text-red-700">Required</span> : null}
                    </span>
                  ) : <span className="text-sm text-prism-muted" aria-hidden="true">—</span>}
                </span>
              </div>
            );
          })}
          {unexplained ? (
            <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status" data-testid={`prices-${sr}-explain`}>
              <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">!</span>
              Explain the highlighted changes before continuing.
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

// month | price | change | explanation (below md: month + change, then price, then explanation)
const MONTH_GRID = "grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-[minmax(0,9rem)_minmax(0,10rem)_minmax(0,11rem)_minmax(0,1fr)] md:gap-y-0";

function FollowUp({ f, product: p, qt }: { f: Form; product: Product; qt: QuestionnaireType }) {
  const set = (mutate: (x: Product) => void) => f.update((d) => { mutate(d.products.find((x) => x.id === p.id)!); }, [key.prod(p.id)]);
  const name = p.name || PRODUCT_NOUN(qt);
  const e = f.errors.get(key.prod(p.id));
  const rows = qt === "CONSTRUCTION"
    ? [{ id: "other-constructions", label: `Are there other constructions of ${name} with different specifications?`, value: p.otherArrangementsRemain, onChange: (v: boolean) => set((x) => { x.otherArrangementsRemain = v; }) }]
    : [
        { id: "other-units", label: `Any other units for ${name}?`, value: p.otherUnitsRemain, onChange: (v: boolean) => set((x) => { x.otherUnitsRemain = v; }) },
        { id: "other-arrangements", label: "Any other transaction arrangements?", value: p.otherArrangementsRemain, onChange: (v: boolean) => set((x) => { x.otherArrangementsRemain = v; }) },
      ];
  return (
    <div className="space-y-2">
      <div className="divide-y divide-prism-border overflow-hidden rounded-xl border border-prism-border">
        {rows.map((r) => <InlineYesNo key={r.id} label={r.label} value={r.value} onChange={r.onChange} testId={`follow-${r.id}`} />)}
      </div>
      {rows.some((r) => r.value) ? <p className="text-sm text-prism-muted">Add each one as another specification below, then answer No.</p> : null}
      {errorFor(e?.errors, "followUp") ? <p className="text-sm font-medium text-red-700" role="alert">{errorFor(e?.errors, "followUp")}</p> : null}
    </div>
  );
}

function InlineYesNo({ label, value, onChange, testId }: { label: string; value: boolean | null; onChange: (v: boolean) => void; testId: string }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-labelledby={`${name}-label`} className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <p id={`${name}-label`} className="text-sm text-prism-text">{label}</p>
      <div className="flex gap-2">
        {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
          <label key={l} className={`flex min-h-10 min-w-20 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${value === v ? "border-prism-purple bg-prism-purple/5 font-semibold" : "border-gray-300 bg-white"}`}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="h-4 w-4 accent-prism-purple" data-testid={`${testId}-${l.toLowerCase()}`} />
            {l}
          </label>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ layout pieces

function Section({ n, title, intro, children, testId }: { n: number; title: string; intro?: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="space-y-4 rounded-2xl border border-prism-border bg-white p-4 shadow-sm sm:p-5" data-testid={testId}>
      <div className="space-y-1">
        <h3 className="flex items-center gap-3 text-lg font-bold text-prism-text">
          <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-prism-purple/10 text-sm font-bold text-prism-purple">{n}</span>
          {title}
        </h3>
        {intro ? <p className="text-sm text-prism-muted sm:pl-11">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

// Label (and hint) on the left, the control on the right; stacked on phones.
function Row({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => React.ReactNode }) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-0.5 px-4 pb-1 pt-3 md:bg-prism-bg md:py-3">
        <label htmlFor={id} className="block text-sm font-semibold text-prism-text">{label}</label>
        {hint ? <p id={`${id}-hint`} className="text-xs text-prism-muted">{hint}</p> : null}
      </div>
      <div className="space-y-1 px-4 pb-3 pt-1 md:py-2">
        {children(id, described)}
        {error ? <p id={`${id}-error`} className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

function Pair({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-start sm:gap-3">
      <div className="sm:pt-2.5">
        <label htmlFor={id} className="block text-sm font-medium text-prism-text">{label}</label>
        {hint ? <p id={`${id}-hint`} className="text-xs text-prism-muted">{hint}</p> : null}
      </div>
      <div className="space-y-1">
        {children(id, hint ? `${id}-hint` : undefined)}
        {error ? <p className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

function SelectControl({ id, value, options, onChange, placeholder = "Choose…", testId, described }: {
  id: string; value: string | null; options: { code: string; label: string }[]; onChange: (v: string | null) => void; placeholder?: string; testId?: string; described?: string;
}) {
  return (
    <select id={id} value={value ?? ""} data-testid={testId} aria-describedby={described} className={inputClass} onChange={(ev) => onChange(ev.target.value || null)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}

// A code list answer; "Other (specify)" asks for the text.
function CodedControl({ id, value, options, qt, onChange, testId, described }: {
  id: string; value: Coded; options: Option[]; qt: QuestionnaireType; onChange: (v: Coded) => void; testId?: string; described?: string;
}) {
  const offered = options.filter((o) => !o.only || o.only.includes(qt));
  return (
    <div className="space-y-2">
      <SelectControl id={id} value={value.code} options={offered} testId={testId} described={described}
        onChange={(code) => onChange({ code, otherText: code === "OTHER" ? value.otherText : "" })} />
      {value.code === "OTHER" ? (
        <input aria-label="Please specify" placeholder="Please specify" className={inputClass} value={value.otherText}
          onChange={(ev) => onChange({ ...value, otherText: ev.target.value })} />
      ) : null}
    </div>
  );
}

function MoneyInput({ id, symbol, value, onChange, placeholder, testId, invalid }: {
  id: string; symbol: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string; invalid?: boolean;
}) {
  return (
    <div className="flex">
      <span className="flex min-h-11 items-center rounded-l-xl border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm font-semibold text-gray-700">{symbol}</span>
      <input id={id} inputMode="decimal" value={value} placeholder={placeholder} data-testid={testId} aria-invalid={invalid ? true : undefined}
        className={`${inputClass} rounded-l-none tabular-nums`} onChange={(ev) => onChange(ev.target.value)} />
    </div>
  );
}

function CountNa({ id, value, na, naLabel, onValue, onNa }: { id: string; value: string; na: boolean; naLabel: string; onValue: (v: string) => void; onNa: (c: boolean) => void }) {
  return (
    <div className="space-y-1">
      {na
        ? <p className="flex min-h-11 items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 text-sm text-prism-muted">None (N/A)</p>
        : <input id={id} inputMode="numeric" className={inputClass} value={value} onChange={(ev) => onValue(ev.target.value.replace(/\D/g, ""))} />}
      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-prism-text">
        <input type="checkbox" checked={na} onChange={(ev) => onNa(ev.target.checked)} className="h-4 w-4 accent-prism-purple" />
        {naLabel}
      </label>
    </div>
  );
}

const TrashIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </svg>
);
