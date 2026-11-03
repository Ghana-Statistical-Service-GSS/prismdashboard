"use client";

// The seasonality step of the firm's form (agriculture): the seasonality of
// production and sales, answered for each product recorded in the products
// step. Products are added and removed there; each one gets its questions here.
import { useState } from "react";
import { Card, CheckboxField, CodedField, errorFor, MonthsField, RecordStatus, TextField, YesNo } from "./fields";
import { key, newSeasonality, seasonalityLeft } from "./model";
import { CATEGORY_NOUN, PRODUCT_NOUN, PRODUCT_PLURAL, type Form } from "./sections";
import type { FirmFormResponse, Product } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SeasonalityStep({ f, form }: { f: Form; form: FirmFormResponse }) {
  const { doc } = f;
  const qt = doc.qt;
  const noun = PRODUCT_NOUN(qt);
  // Open at first: the products still to complete (kept as the firm toggles).
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(doc.products.filter((p) => seasonalityLeft(doc.seasonality.find((s) => s.productId === p.id)) > 0).map((p) => p.id)),
  );
  const toggle = (id: string) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(id)) {
      n.delete(id);
    } else {
      n.add(id);
    }
    return n;
  });

  if (!doc.products.length) {
    return (
      <Card title="Seasonality of production and sales" level={2}>
        <p className="text-sm">First add your {PRODUCT_PLURAL(qt)} in the previous step. Then answer the seasonality questions for each {noun} here.</p>
      </Card>
    );
  }
  const done = doc.products.filter((p) => seasonalityLeft(doc.seasonality.find((s) => s.productId === p.id)) === 0).length;
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-prism-border bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-prism-purple">Producer Price Index</p>
        <h2 className="text-xl font-bold text-prism-text sm:text-2xl">Seasonality of production and sales</h2>
        <p className="text-sm text-prism-muted">Answer these questions for each {noun} you recorded. Your answers are saved as you go.</p>
        <div className="space-y-1.5" data-testid="seasonality-progress">
          <p className="text-sm font-semibold text-prism-text">{done} of {doc.products.length} {doc.products.length === 1 ? noun : PRODUCT_PLURAL(qt)} complete</p>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
            <div className="h-full rounded-full bg-prism-purple transition-all" style={{ width: `${(done / doc.products.length) * 100}%` }} />
          </div>
        </div>
      </section>

      {doc.categories.map((c, ci) => {
        const products = doc.products.filter((p) => p.categoryId === c.id);
        if (!products.length) return null;
        return (
          <section key={c.id} aria-labelledby={`season-cat-${c.id}`} className="space-y-3">
            <h3 id={`season-cat-${c.id}`} className="text-sm font-bold uppercase tracking-wide text-prism-muted">
              {c.name || `${cap(CATEGORY_NOUN(qt))} ${ci + 1}`}
            </h3>
            {products.map((p) => (
              <ProductSeasonality key={p.id} f={f} form={form} product={p} index={doc.products.indexOf(p)} open={open.has(p.id)} onToggle={() => toggle(p.id)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function ProductSeasonality({ f, form, product: p, index, open, onToggle }: {
  f: Form; form: FirmFormResponse; product: Product; index: number; open: boolean; onToggle: () => void;
}) {
  const noun = PRODUCT_NOUN(f.doc.qt);
  const k = key.seas(p.id);
  const e = f.errors.get(k);
  const left = seasonalityLeft(f.doc.seasonality.find((s) => s.productId === p.id));
  const panel = `season-${p.id}`;
  return (
    <div id={`season-card-${p.id}`} className="scroll-mt-16 rounded-2xl border border-prism-border bg-white shadow-sm" data-testid={`season-product-${index}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panel} data-testid={`season-toggle-${index}`}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple/50 sm:px-5">
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-prism-purple sm:text-lg">{p.name || `${cap(noun)} without a name`}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <RecordStatus pending={f.isPending(k)} error={e?.message} />
          {left === 0
            ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">Complete</span>
            : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">{left} question{left === 1 ? "" : "s"} left</span>}
          <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-5 w-5 text-prism-muted transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={panel} className="border-t border-prism-border p-4 sm:p-5">
          <SeasonalityFields f={f} form={form} productId={p.id} />
        </div>
      ) : null}
    </div>
  );
}

function SeasonalityFields({ f, form, productId }: { f: Form; form: FirmFormResponse; productId: string }) {
  const s = f.doc.seasonality.find((x) => x.productId === productId) ?? newSeasonality(productId);
  const k = key.seas(productId);
  const e = f.errors.get(k);
  const set = (mutate: (x: typeof s) => void) => f.update((d) => {
    let row = d.seasonality.find((x) => x.productId === productId);
    if (!row) { row = newSeasonality(productId); d.seasonality.push(row); }
    mutate(row);
  }, [k]);
  return (
    <div className="space-y-5">
      {e && !e.errors.length ? <p className="text-sm font-medium text-red-700" role="alert">{e.message}</p> : null}
      <YesNo label="1. Is the product produced throughout the year?" value={s.producedAllYear} onChange={(v) => set((x) => { x.producedAllYear = v; })} error={errorFor(e?.errors, "producedAllYear")} />
      {s.producedAllYear === false ? <MonthsField label="2. If no, which months is it normally available?" value={s.availableMonths} onChange={(v) => set((x) => { x.availableMonths = v; })} /> : null}
      <MonthsField label="3. Which months have the highest production?" value={s.highProductionMonths} onChange={(v) => set((x) => { x.highProductionMonths = v; })} />
      <MonthsField label="4. Which months have the lowest production?" value={s.lowProductionMonths} onChange={(v) => set((x) => { x.lowProductionMonths = v; })} />
      <YesNo label="5. Are prices affected by seasonality?" value={s.pricesSeasonal} onChange={(v) => set((x) => { x.pricesSeasonal = v; })} />
      <YesNo label="6. Are there periods/months when the product is not sold?" value={s.hasNoSalePeriods} onChange={(v) => set((x) => { x.hasNoSalePeriods = v; })} />
      {s.hasNoSalePeriods ? <MonthsField label="Months when it is not sold" value={s.noSaleMonths} onChange={(v) => set((x) => { x.noSaleMonths = v; })} /> : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">7. Where was the product sold? (choose all that apply)</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {form.options.salesLocation.map((o) => (
            <CheckboxField key={o.code} label={o.label} checked={s.salesLocationCodes.includes(o.code)}
              onChange={(c) => set((x) => { x.salesLocationCodes = c ? [...x.salesLocationCodes, o.code] : x.salesLocationCodes.filter((y) => y !== o.code); })} />
          ))}
        </div>
        {s.salesLocationCodes.includes("OTHER") ? (
          <TextField label="Other place of sale: please specify" value={s.salesLocationOther} onChange={(v) => set((x) => { x.salesLocationOther = v; })} />
        ) : null}
      </fieldset>
      <CodedField label="8. Who was the main buyer of the product?" value={s.mainBuyer} options={form.options.mainBuyer} qt={f.doc.qt}
        error={errorFor(e?.errors, "mainBuyer")} onChange={(v) => set((x) => { x.mainBuyer = v; })} />
    </div>
  );
}
