"use client";

// Step 3 of the firm's form: per major product category its products, each
// with the list of its pricing specifications; a specification opens as a
// page of its own (spec.tsx). Agriculture's seasonality has its own step
// (seasonality.tsx); a product added here gets its empty seasonality record.
import { useEffect, useRef, useState } from "react";
import { Button, Card, errorFor, NumberField, RecordStatus, TextField } from "./fields";
import { key, newProduct, newSeasonality, newSpec } from "./model";
import { CATEGORY_NOUN, CATEGORY_PLURAL, PRODUCT_NOUN, PRODUCT_PLURAL, type Form } from "./sections";
import { SpecPage, specProgress } from "./spec";
import type { FirmFormResponse, Product, QuestionnaireType } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NAME_HINT: Record<QuestionnaireType, string> = {
  AGRICULTURE: "The main commodity of this group, for example: maize, cocoa, cassava, tomatoes, cattle, eggs, fish, timber.",
  WHOLESALE_RETAIL: "The main product of this category, for example: cooking oil, evaporated milk, bread, soft drinks, mobile phones.",
  OTHER: "The main product or service of this category, for example: bottled water, refuse collection, hotel room per night, haulage of goods.",
  CONSTRUCTION: "The type of the most recent contract, for example: bitumen road, residential building, school building, bridge.",
};

// onSubpage: true while a specification page is open (the form then hides
// its own step buttons; the page has its own).
export function ProductsStep({ f, form, onSubpage }: { f: Form; form: FirmFormResponse; onSubpage: (open: boolean) => void }) {
  const { doc } = f;
  const qt = doc.qt;
  const [openSpec, setOpenSpec] = useState<string | null>(null);
  // The product to scroll back to when a specification page closes.
  const returnTo = useRef<string | null>(null);
  const spec = openSpec ? doc.specs.find((s) => s.id === openSpec) : undefined;
  const product = spec ? doc.products.find((p) => p.id === spec.productId) : undefined;

  useEffect(() => {
    onSubpage(!!spec);
    return () => onSubpage(false);
  }, [spec, onSubpage]);
  useEffect(() => {
    const target = !openSpec && returnTo.current ? document.getElementById(`product-${returnTo.current}`) : null;
    returnTo.current = null;
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  }, [openSpec]);

  // Specifications in the order of the form: category, product, specification.
  const ordered = doc.categories.flatMap((c) => doc.products.filter((p) => p.categoryId === c.id))
    .flatMap((p) => doc.specs.filter((s) => s.productId === p.id));
  const addSpec = (productId: string) => {
    const s = newSpec(productId);
    f.update((d) => { d.specs.push(s); }, [key.spec(s.id)]);
    setOpenSpec(s.id);
  };
  const back = () => { returnTo.current = product?.id ?? null; setOpenSpec(null); };

  if (spec && product) {
    const next = ordered[ordered.findIndex((s) => s.id === spec.id) + 1];
    return (
      <SpecPage key={spec.id} f={f} form={form} spec={spec} product={product}
        index={doc.specs.filter((s) => s.productId === product.id).findIndex((s) => s.id === spec.id)}
        onBack={back} onContinue={() => (next ? setOpenSpec(next.id) : back())}
        onAdd={() => addSpec(product.id)} onRemoved={back} />
    );
  }

  if (!doc.categories.length) {
    return (
      <Card title={`${cap(PRODUCT_PLURAL(qt))} and prices`} level={2}>
        <p className="text-sm">First add your {CATEGORY_PLURAL(qt)} in step 2. Then you can add the {PRODUCT_PLURAL(qt)} and their prices here.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {doc.categories.map((c, ci) => {
        const products = doc.products.filter((p) => p.categoryId === c.id);
        const declared = Number(c.productCount) || 0;
        const canAdd = !declared || products.length < declared;
        const add = () => {
          const p = newProduct(c.id);
          f.update((d) => {
            d.products.push(p);
            if (form.config.productSeasonality) d.seasonality.push(newSeasonality(p.id));
          }, [key.prod(p.id)]);
        };
        return (
          <section key={c.id} aria-labelledby={`cat-${c.id}`} className="space-y-4">
            <div className="rounded-2xl bg-prism-purple px-4 py-3 text-white">
              <h2 id={`cat-${c.id}`} className="text-lg font-bold">{c.name || `${cap(CATEGORY_NOUN(qt))} ${ci + 1}`}</h2>
              <p className="text-sm text-white/85">{products.length} of {declared || "?"} {PRODUCT_PLURAL(qt)} recorded</p>
            </div>
            {products.map((p, pi) => (
              <ProductCard key={p.id} f={f} form={form} product={p} index={pi} categoryName={c.name} onOpenSpec={setOpenSpec} onAddSpec={() => addSpec(p.id)} />
            ))}
            {canAdd
              ? <Button variant="secondary" onClick={add} testId={`add-product-${ci}`}>+ Add {PRODUCT_NOUN(qt)}</Button>
              : <p className="text-sm text-prism-muted">All {declared} {PRODUCT_PLURAL(qt)} declared for this {CATEGORY_NOUN(qt)} are recorded. To add another, change the number in step 2.</p>}
          </section>
        );
      })}
    </div>
  );
}

function ProductCard({ f, form, product: p, index, categoryName, onOpenSpec, onAddSpec }: {
  f: Form; form: FirmFormResponse; product: Product; index: number; categoryName: string; onOpenSpec: (id: string) => void; onAddSpec: () => void;
}) {
  const { doc } = f;
  const qt = doc.qt;
  const e = f.errors.get(key.prod(p.id));
  const specs = doc.specs.filter((s) => s.productId === p.id);
  const set = (mutate: (x: Product) => void) => f.update((d) => { mutate(d.products.find((x) => x.id === p.id)!); }, [key.prod(p.id)]);
  const removeProduct = () => {
    if (!window.confirm(`Remove “${p.name || `this ${PRODUCT_NOUN(qt)}`}” and its prices?`)) return;
    f.remove("PROD", p.id, (d) => {
      const specIds = d.specs.filter((s) => s.productId === p.id).map((s) => s.id);
      const prices = d.prices.filter((x) => specIds.includes(x.specId)).map((x) => x.id);
      d.products = d.products.filter((x) => x.id !== p.id);
      d.specs = d.specs.filter((s) => s.productId !== p.id);
      d.prices = d.prices.filter((x) => !prices.includes(x.id));
      d.seasonality = d.seasonality.filter((s) => s.productId !== p.id);
      return [...specIds, ...prices];
    });
  };
  const noun = PRODUCT_NOUN(qt);
  return (
    <div id={`product-${p.id}`} className="scroll-mt-16">
      <Card title={`${cap(noun)} ${index + 1}${p.name ? `: ${p.name}` : ""}`} level={3}
        status={<RecordStatus pending={f.isPending(key.prod(p.id))} error={e?.message} />}
        actions={<Button variant="ghost" onClick={removeProduct}>Remove</Button>}>
        {e && !e.errors.length ? <p className="text-sm font-medium text-red-700" role="alert">{e.message}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={`Name of the ${noun}`} value={p.name} hint={NAME_HINT[qt]} error={errorFor(e?.errors, "name")} testId={`product-${index}-name`}
            onChange={(v) => set((x) => { x.name = v; })} />
          <NumberField label={`Percentage of ${categoryName || CATEGORY_NOUN(qt)} revenue in ${doc.referencePeriod} (%)`} value={p.revenuePercent}
            error={errorFor(e?.errors, "revenuePercent")} testId={`product-${index}-percent`}
            hint={`The share of the ${CATEGORY_NOUN(qt)}'s revenue that comes from this ${noun}.`}
            onChange={(v) => set((x) => { x.revenuePercent = v; })} />
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-bold text-prism-text">Pricing specifications</h4>
          {!specs.length ? <p className="text-sm text-prism-muted">Describe a typical sale of this {noun} and give its prices.</p> : (
            <ul className="divide-y divide-prism-border overflow-hidden rounded-xl border border-prism-border">
              {specs.map((s, si) => {
                const progress = specProgress(doc, form, s);
                const se = f.errors.get(key.spec(s.id));
                const status = se
                  ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">Not saved</span>
                  : progress.missingReasons
                    ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">Explanation needed</span>
                    : progress.entered >= progress.expected
                      ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">Prices complete</span>
                      : <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{progress.entered} of {progress.expected} prices</span>;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => onOpenSpec(s.id)} data-testid={`open-spec-${index}-${si}`}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-prism-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-prism-purple/50">
                      <span className="min-w-0">
                        <span className="block font-semibold text-prism-purple">Specification {si + 1}</span>
                        <span className="block truncate text-sm text-prism-muted">{s.description.trim() || "No description yet"}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {status}
                        <span className="text-sm font-semibold text-prism-purple">Open <span aria-hidden="true">→</span></span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Button variant="secondary" onClick={onAddSpec} testId={`add-spec-${index}`}>+ Add pricing specification</Button>
        </div>
      </Card>
    </div>
  );
}
