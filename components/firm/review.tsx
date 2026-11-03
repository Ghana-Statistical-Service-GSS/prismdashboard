"use client";

// The last step of the firm's form ("Review & send"): what is still missing,
// grouped by section and product, price comparisons worth checking, what
// happens on sending and whom to ask; then the thank-you page, with a
// read-only copy of what was sent (from this page's memory only: the link is
// closed once the form is sent).
import { useEffect, useState } from "react";
import { firmApi } from "./api";
import { Button } from "./fields";
import { monthRange } from "./model";
import { currencySymbol, GENERAL_LABELS, PRODUCT_NOUN, type Form } from "./sections";
import type { Contact, Doc, FirmFormResponse, ReadinessIssue, ReadinessWarning } from "./types";

export type SentCopy = { doc: Doc; form: FirmFormResponse };
type GoTo = (step: string, anchor?: string) => void;

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLong = (ym: string) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

// ------------------------------------------------------------------ grouping

type Icon = "business" | "revenue" | "product" | "season" | "quarter";
type Group = { key: string; title: string; icon: Icon; items: string[]; details: string[]; step: string; anchor?: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The product's issues in a few plain lines; the server's messages stay
// available under "View missing details".
function productSummary(issues: ReadinessIssue[]) {
  const items: string[] = [];
  const history = issues.filter((i) => i.id.includes("-hist-"));
  const reasons = issues.filter((i) => i.id.includes("-reason-"));
  const follow = issues.some((i) => i.id.endsWith("-follow"));
  const noSpec = issues.some((i) => i.id.endsWith("-nospec"));
  const other = issues.filter((i) => !history.includes(i) && !reasons.includes(i) && !i.id.endsWith("-follow") && !i.id.endsWith("-nospec"));
  if (noSpec) items.push("No pricing specification yet.");
  if (other.length) items.push("Some product and sales details are missing.");
  if (history.length === 1) {
    const what = /missing for (.+)\.$/.exec(history[0].message)?.[1];
    items.push(what ? `Prices are missing for ${what}.` : "Some monthly prices are missing.");
  } else if (history.length) {
    items.push(`Monthly prices are missing in ${history.length} price lists.`);
  }
  if (reasons.length) items.push(`${plural(reasons.length, "price change needs", "price changes need")} an explanation.`);
  if (follow) items.push("Other units or arrangements still need confirmation.");
  return items;
}

function groupsOf(doc: Doc, readiness: FirmFormResponse["readiness"]): Group[] {
  const all = Object.entries(readiness.issues).flatMap(([step, list]) => list.map((i) => ({ ...i, step })));
  const name = (id: string | undefined) => doc.products.find((p) => p.id === id)?.name.trim() || `Unnamed ${PRODUCT_NOUN(doc.qt)}`;
  const messages = (list: typeof all) => list.map((i) => i.message);
  const isShare = (i: (typeof all)[number]) => i.id.endsWith("-shares") || i.id.endsWith("-share");
  const groups: Group[] = [];
  const push = (g: Omit<Group, "details"> & { details?: string[] }) => { if (g.items.length) groups.push({ details: [], ...g }); };

  const business = all.filter((i) => i.step === "GENERAL" || i.step === "ESTABLISHMENT");
  push({ key: "business", title: "About your business", icon: "business", items: messages(business), step: "general" });
  const revenue = all.filter((i) => i.step === "CATEGORIES");
  push({ key: "revenue", title: "Revenue & categories", icon: "revenue", items: messages(revenue), step: "revenue" });
  const shares = all.filter((i) => i.step === "PRODUCTS" && isShare(i));
  push({ key: "shares", title: "Revenue shares", icon: "revenue", items: messages(shares), step: "products" });
  const products = all.filter((i) => i.step === "PRODUCTS" && !i.target?.productId && !isShare(i));
  push({ key: "products", title: `${doc.qt === "CONSTRUCTION" ? "Activities" : "Products"} to add`, icon: "product", items: messages(products), step: "products" });

  const ids = [...new Set(all.map((i) => i.target?.productId).filter((x): x is string => !!x))];
  ids.sort((a, b) => doc.products.findIndex((p) => p.id === a) - doc.products.findIndex((p) => p.id === b));
  for (const id of ids) {
    const own = all.filter((i) => i.target?.productId === id && i.step === "PRODUCTS" && !isShare(i));
    push({ key: `prod-${id}`, title: `${name(id)}: product details & prices`, icon: "product", items: productSummary(own), details: messages(own), step: "products", anchor: `product-${id}` });
    const season = all.filter((i) => i.target?.productId === id && i.step === "SEASONALITY");
    const left = season.map((i) => Number(/(\d+) seasonality question/.exec(i.message)?.[1] || 0)).reduce((a, b) => a + b, 0);
    push({ key: `season-${id}`, title: `${name(id)}: seasonality`, icon: "season",
      items: season.length ? [left ? `${plural(left, "question still needs", "questions still need")} answers.` : season[0].message] : [], step: "seasonality", anchor: `season-card-${id}` });
  }
  const quarterly = all.filter((i) => i.step === "QUARTERLY");
  push({ key: "quarterly", title: "Quarterly revenue", icon: "quarter", items: messages(quarterly), step: "quarterly" });
  // Anything the groups above did not take (a new kind of issue): never hidden.
  const taken = new Set(groups.flatMap((g) => (g.details.length ? g.details : g.items)));
  const rest = all.filter((i) => !taken.has(i.message) && !(i.target?.productId && (i.step === "PRODUCTS" || i.step === "SEASONALITY")));
  push({ key: "other", title: "Other items", icon: "business", items: messages(rest), step: "general" });
  return groups;
}

// ------------------------------------------------------------------ review step

export function ReviewStep({ f, slug, csrf, step, steps, onBack, onSent, onClosed, goTo }: {
  f: Form; slug: string; csrf: string; step: number; steps: number; onBack: () => void;
  onSent: (copy: SentCopy) => void; onClosed: (reason: string | null) => void; goTo: GoTo;
}) {
  const [checking, setChecking] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refusedList, setRefusedList] = useState<{ key: string; label: string; message: string }[] | null>(null);
  const { settle, reload, refreshChecks } = f;
  useEffect(() => {
    let live = true;
    (async () => {
      // Saves what is pending, then reads the latest check from the server
      // (only the check when some answers were refused: they stay on screen).
      const settled = await settle();
      if (settled === "saved") await reload();
      else if (settled === "refused") await refreshChecks();
      if (live) setChecking(false);
    })();
    return () => { live = false; };
  }, [settle, reload, refreshChecks]);

  const readiness = f.serverForm.readiness;
  const groups = groupsOf(f.doc, readiness);
  const comparisons = readiness.warnings.filter((w) => w.kind === "PRICE_MONTH_MISMATCH" || (w.current && w.history));
  const send = async (acceptRefused = false) => {
    setSending(true);
    setError(null);
    const settled = await f.settle();
    if (settled === "pending") {
      setError("Some answers are not saved yet (no connection to the server). Please wait until all changes are saved, then try again.");
      setSending(false);
      return;
    }
    // Answers the server refused are not saved: the firm may still send,
    // after a confirmation that lists what will not be included.
    if (settled === "refused" && !acceptRefused) {
      setRefusedList(f.refused());
      setSending(false);
      return;
    }
    try {
      const answer = await firmApi.handOver(slug, csrf);
      // 410: closed meanwhile; sent only when it was this hand-over (a repeat).
      if (answer.data || (answer.status === 410 && answer.error?.closedReason === "HANDED_OVER")) { onSent({ doc: f.doc, form: f.serverForm }); return; }
      if (answer.status === 410) { onClosed(answer.error?.closedReason ?? null); return; }
      if (answer.status === 401 || answer.status === 403) { setSending(false); setConfirming(false); f.sessionLost(); return; }
      setError(answer.error?.message || "The form could not be sent. Please try again.");
    } catch {
      setError("No connection. Please check your internet connection and try again.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-5" data-testid="review-step">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-prism-muted">Step {step + 1} of {steps}</p>
        <h2 className="text-3xl font-bold text-prism-text sm:text-4xl">Review &amp; send</h2>
        <p className="text-base text-prism-muted">Your GSS enumerator will review the information you send.</p>
      </div>

      {checking ? (
        <p role="status" className="rounded-2xl border border-prism-border bg-white p-5 text-prism-muted">Checking your answers…</p>
      ) : readiness.count ? (
        <Banner tone="warn" title={`${plural(readiness.count, "item", "items")} to review`} testId="review-banner">
          You can update these now, or send what you have. Your enumerator can help complete the rest.
        </Banner>
      ) : (
        <Banner tone="ok" title="Everything is filled in" testId="review-banner">
          Thank you. Send the questionnaire to your enumerator when you are ready.
        </Banner>
      )}

      {!checking && groups.length ? (
        <Panel title="Review these sections" intro="Check the items below. Go to each section to update your answers if needed.">
          <ul className="divide-y divide-prism-border overflow-hidden rounded-xl border border-prism-border">
            {groups.map((g) => <GroupRow key={g.key} group={g} goTo={goTo} />)}
          </ul>
        </Panel>
      ) : null}

      {!checking && comparisons.length ? <Comparisons doc={f.doc} warnings={comparisons} goTo={goTo} /> : null}

      <Panel title="What happens when you send?">
        <ul className="divide-y divide-prism-border">
          <Fact icon="people">Your assigned enumerator will see your answers and the remaining items.</Fact>
          <Fact icon="chat">They may contact you to clarify or complete information.</Fact>
          <Fact icon="lock">After sending, you cannot edit this form here. Contact your enumerator if changes are needed.</Fact>
        </ul>
      </Panel>

      <Help contacts={f.serverForm.contacts} compact />

      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
      {confirming ? (
        <div className="space-y-3 rounded-2xl border border-prism-purple bg-white p-4 shadow-sm" role="group" aria-labelledby="confirm-send">
          <p id="confirm-send" className="font-semibold text-prism-text">Send the questionnaire now? You will not be able to change it here afterwards.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => send(false)} disabled={sending} testId="confirm-send">{sending ? "Sending…" : "Yes, send it"}</Button>
            <Button variant="secondary" onClick={() => { setConfirming(false); setRefusedList(null); }} disabled={sending}>Not yet</Button>
          </div>
          {refusedList ? (
            <div className="space-y-2 rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert" data-testid="refused-list">
              <p className="font-semibold">These answers were not accepted and will not be included:</p>
              <ul className="list-disc pl-5">{refusedList.map((r) => <li key={r.key}>{r.label}: {r.message}</li>)}</ul>
              <p>You can correct them first, or send without them; your enumerator will complete them with you.</p>
              <Button onClick={() => send(true)} disabled={sending} testId="send-without-refused">Send without these answers</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-prism-border pt-4">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <div className="space-y-1 text-right">
          <Button onClick={() => setConfirming(true)} disabled={checking || confirming || sending} testId="send-to-enumerator">Send to enumerator <span aria-hidden="true">→</span></Button>
          <p className="text-xs text-prism-muted">You can send even if some answers are missing.</p>
        </div>
      </div>
    </div>
  );
}

function GroupRow({ group: g, goTo }: { group: Group; goTo: GoTo }) {
  const [open, setOpen] = useState(false);
  const shown = g.items.slice(0, 6);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start" data-testid={`review-group-${g.key}`}>
      <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-prism-purple/10 text-prism-purple sm:flex"><GroupIcon icon={g.icon} /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <h4 className="text-base font-bold text-prism-text">{g.title}</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm text-prism-text">
          {shown.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}
          {g.items.length > shown.length ? <li>…and {g.items.length - shown.length} more.</li> : null}
        </ul>
        {g.details.length ? (
          <div>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
              className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-prism-purple underline-offset-2 hover:underline">
              <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" /></svg>
              {open ? "Hide missing details" : "View missing details"}
            </button>
            {open ? <ul className="mt-1 list-disc space-y-1 rounded-xl bg-prism-bg p-3 pl-8 text-sm text-prism-text">{g.details.map((d, i) => <li key={`${i}-${d}`}>{d}</li>)}</ul> : null}
          </div>
        ) : null}
      </div>
      <Button variant="secondary" onClick={() => goTo(g.step, g.anchor)} className="shrink-0 self-start" testId={`review-go-${g.key}`}>Review <span aria-hidden="true">→</span></Button>
    </li>
  );
}

function Comparisons({ doc, warnings, goTo }: { doc: Doc; warnings: ReadinessWarning[]; goTo: GoTo }) {
  const symbolFor = (w: ReadinessWarning) => {
    const spec = doc.specs.find((s) => s.id === w.target?.specId);
    const c = spec?.priceCurrency?.code ? spec.priceCurrency : doc.currency;
    return currencySymbol(c.code, c.otherText);
  };
  const title = warnings.length === 1 ? "One price comparison to check" : `${warnings.length} price comparisons to check`;
  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5" data-testid="review-comparisons">
      <div className="flex gap-3">
        <InfoDot />
        <div>
          <h3 className="text-lg font-bold text-amber-950">{title}</h3>
          <p className="text-sm text-amber-950/90">Prices can change over time. Please check that both entries are correct.</p>
        </div>
      </div>
      {warnings.map((w) => (
        <div key={w.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:pl-11">
          {w.where ? <p className="text-sm font-semibold text-amber-950 sm:col-span-3">{w.where}</p> : null}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <p className="text-sm text-emerald-950/80">Current price</p>
            <p className="text-xl font-bold tabular-nums text-emerald-950">{symbolFor(w)} {w.current}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <p className="text-sm text-emerald-950/80">{w.month ? monthLong(w.month) : "Latest month"}</p>
            <p className="text-xl font-bold tabular-nums text-emerald-950">{symbolFor(w)} {w.history}</p>
          </div>
          <Button variant="secondary" onClick={() => goTo("products", w.target?.productId ? `product-${w.target.productId}` : undefined)} className="self-center">
            Check prices <span aria-hidden="true">→</span>
          </Button>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------------ help

const CONTACT_KINDS = [
  { key: "enumerator", label: "Enumerator", title: "Your enumerator", about: "Help with your answers and corrections.", icon: "person" },
  { key: "regionalOffice", label: "Regional office", title: "Regional office", about: "Support from your GSS regional team.", icon: "office" },
  { key: "hq", label: "HQ", title: "GSS Headquarters", about: "Further assistance from GSS HQ.", icon: "hq" },
] as const;

// The enumerator's phone is the primary contact: shown first with a call
// button. The offices (where configured) follow; without an enumerator phone
// every contact is one of the choices.
export function Help({ contacts, compact }: { contacts: FirmFormResponse["contacts"]; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const primary = contacts?.enumerator?.phone ? contacts.enumerator : null;
  const others = CONTACT_KINDS.filter((k) => contacts?.[k.key] && !(k.key === "enumerator" && primary));
  const nameOf = (key: string) => (key === "enumerator" ? "your enumerator" : key === "regionalOffice" ? "your GSS regional office" : "GSS Headquarters (HQ)");
  const list = (keys: string[]) => (keys.length > 1 ? `${keys.slice(0, -1).map(nameOf).join(", ")} or ${nameOf(keys[keys.length - 1])}` : keys.map(nameOf)[0] || "your enumerator");
  const intro = primary
    ? `Call your enumerator first: they know your questionnaire.${others.length ? ` You can also contact ${list(others.map((k) => k.key))}.` : ""}`
    : `You can contact ${list(others.map((k) => k.key))}.`;
  const details = (key: string) => {
    const c = contacts?.[key as keyof NonNullable<typeof contacts>] as Contact | null | undefined;
    return c ? <ContactDetails contact={c} /> : null;
  };
  if (compact) {
    return (
      <Panel title="Need help?" intro={intro}>
        {primary ? <PrimaryContact contact={primary} /> : null}
        {others.length ? (
          <>
            {primary ? <p className="text-sm font-semibold text-prism-text">Other contacts</p> : null}
            <div className="flex flex-wrap gap-2">
              {others.map((k) => (
                <button key={k.key} type="button" onClick={() => setOpen(open === k.key ? null : k.key)} aria-expanded={open === k.key} data-testid={`help-${k.key}`}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${open === k.key ? "border-prism-purple bg-prism-purple/5" : "border-prism-purple/60 bg-white"} text-prism-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple/50`}>
                  <ContactIcon icon={k.icon} />{k.label}
                </button>
              ))}
            </div>
            {open ? <div className="rounded-xl bg-prism-bg p-4" data-testid="help-details">{details(open)}</div> : null}
          </>
        ) : null}
        {!primary && !others.length ? <p className="text-sm text-prism-muted">Your enumerator gave you this link; please contact them.</p> : null}
      </Panel>
    );
  }
  return (
    <Panel title="We’re here to help" intro={intro}>
      {primary ? <PrimaryContact contact={primary} /> : null}
      {others.length ? (
        <div className={`grid gap-3 ${others.length > 2 ? "md:grid-cols-3" : others.length === 2 ? "md:grid-cols-2" : ""}`}>
          {others.map((k) => (
            <div key={k.key} className="space-y-3 rounded-xl border border-prism-border p-4">
              <div className="flex gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-prism-purple/10 text-prism-purple"><ContactIcon icon={k.icon} large /></span>
                <div>
                  <h4 className="font-bold text-prism-text">{k.title}</h4>
                  <p className="text-sm text-prism-muted">{k.about}</p>
                </div>
              </div>
              {open === k.key ? <div className="rounded-xl bg-prism-bg p-3">{details(k.key)}</div> : null}
              <Button variant="secondary" onClick={() => setOpen(open === k.key ? null : k.key)} className="w-full" testId={`help-card-${k.key}`}>
                {open === k.key ? "Hide contact details" : <>View contact details <span aria-hidden="true">→</span></>}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

// The enumerator, with the phone number in view and a call button.
function PrimaryContact({ contact: c }: { contact: Contact }) {
  const tel = (c.phone || "").replace(/[^\d+]/g, "");
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-prism-purple/40 bg-prism-purple/5 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="help-primary">
      <div className="flex min-w-0 gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-prism-purple/10 text-prism-purple"><ContactIcon icon="person" large /></span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-prism-purple">Your enumerator</p>
          {c.name ? <p className="font-bold text-prism-text">{c.name}</p> : null}
          <p className="text-lg font-semibold tabular-nums text-prism-text">{c.phone}</p>
          {c.email ? <a href={`mailto:${c.email}`} className="block break-all text-sm text-prism-purple underline-offset-2 hover:underline">{c.email}</a> : null}
        </div>
      </div>
      <a href={`tel:${tel}`} data-testid="help-call"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-prism-purple px-5 text-base font-semibold text-white hover:bg-prism-purple-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple/50">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>
        Call your enumerator
      </a>
    </div>
  );
}

function ContactDetails({ contact: c }: { contact: Contact }) {
  return (
    <dl className="space-y-1 text-sm text-prism-text">
      {c.name ? <div><dt className="sr-only">Name</dt><dd className="font-semibold">{c.name}</dd></div> : null}
      {c.phone ? <div className="flex gap-2"><dt className="text-prism-muted">Phone</dt><dd><a className="font-semibold text-prism-purple underline-offset-2 hover:underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></dd></div> : null}
      {c.email ? <div className="flex gap-2"><dt className="text-prism-muted">Email</dt><dd className="min-w-0 break-all"><a className="font-semibold text-prism-purple underline-offset-2 hover:underline" href={`mailto:${c.email}`}>{c.email}</a></dd></div> : null}
      {c.hours ? <div className="flex gap-2"><dt className="text-prism-muted">Hours</dt><dd>{c.hours}</dd></div> : null}
      {!c.phone && !c.email ? <p className="text-prism-muted">No phone number or email recorded.</p> : null}
    </dl>
  );
}

// ------------------------------------------------------------------ thank you

export function ThankYou({ copy }: { copy?: SentCopy }) {
  const [showCopy, setShowCopy] = useState(false);
  return (
    <div className="space-y-5" data-testid="thank-you">
      <section className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-prism-text sm:text-3xl" tabIndex={-1}>Thank you for your contribution</h1>
            <p className="text-lg text-prism-muted">Your questionnaire has been sent to your GSS enumerator.</p>
            <span className="inline-block rounded-full bg-prism-purple/10 px-3 py-1 text-sm font-semibold text-prism-purple">Sent for review</span>
          </div>
        </div>
        <p className="border-t border-teal-200 pt-4 text-prism-text">Thank you for taking the time to share your information. Your participation supports Ghana’s official statistics.</p>
      </section>

      <Panel title="What happens next?">
        <ol className="space-y-0 divide-y divide-prism-border">
          <Fact number={1}>Your enumerator will review your answers and any remaining items.</Fact>
          <Fact number={2}>They may contact you to clarify details or help complete the questionnaire.</Fact>
        </ol>
        <div className="flex items-center gap-3 rounded-xl bg-prism-purple/5 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prism-purple/10 text-prism-purple"><FactIcon icon="lock" /></span>
          <p className="text-sm text-prism-text"><span className="font-semibold">Need to correct an answer?</span> Contact your enumerator. This online form is now read-only.</p>
        </div>
      </Panel>

      <Help contacts={copy?.form.contacts} />

      {copy ? (
        <div className="space-y-2">
          <Button onClick={() => setShowCopy(!showCopy)} testId="view-sent-answers">
            {showCopy ? "Hide sent answers" : <>View sent answers <span aria-hidden="true">→</span></>}
          </Button>
          <p className="text-sm text-prism-muted">Read-only copy of your questionnaire. It is shown only on this page: once you close or reload it, the link no longer opens the form.</p>
          {showCopy ? <SentAnswers copy={copy} /> : null}
        </div>
      ) : null}
    </div>
  );
}

// A read-only copy of what was sent, from this page's own data.
function SentAnswers({ copy: { doc, form } }: { copy: SentCopy }) {
  const label = (list: string, code: string | null | undefined, other?: string) => {
    if (!code) return "—";
    if (code === "OTHER") return other?.trim() ? `Other: ${other}` : "Other";
    return form.options[list]?.find((o) => o.code === code)?.label ?? code;
  };
  const symbol = currencySymbol(doc.currency.code, doc.currency.otherText);
  const months = monthRange(form.config.priceHistory.firstMonth, form.config.priceHistory.lastMonth);
  const amount = (a: { state: string; amount?: string | null } | undefined) =>
    a?.state === "REPORTED" ? String(a.amount ?? "") : a?.state === "NOT_AVAILABLE" ? "Not available" : "—";
  const noun = PRODUCT_NOUN(doc.qt);
  return (
    <div className="space-y-4 rounded-2xl border border-prism-border bg-white p-4 sm:p-6" data-testid="sent-answers">
      <CopySection title="About your business">
        <Rows rows={[
          ...form.establishment.editableFields.map((field) => [GENERAL_LABELS[field] || field, doc.general[field] || "—"] as [string, string]),
          ["Region", form.establishment.general.regionName || "—"], ["District", form.establishment.general.districtName || "—"],
        ]} />
      </CopySection>
      <CopySection title="Revenue and categories">
        <Rows rows={[["Currency", label("currency", doc.currency.code, doc.currency.otherText)], [`Total revenue for ${doc.referencePeriod}`, doc.annual ? `${symbol} ${doc.annual}` : "—"]]} />
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {doc.categories.map((c) => (
            <li key={c.id}>{c.name || "Unnamed"}: {c.revenueBasis === "PERCENT" ? `${c.revenuePercent || "—"}%` : `${symbol} ${c.revenueValue || "—"}`} · {c.productCount || "?"} {noun}(s)</li>
          ))}
        </ul>
      </CopySection>
      {doc.products.map((p) => (
        <CopySection key={p.id} title={`${p.name || `Unnamed ${noun}`}${p.revenuePercent ? ` · ${p.revenuePercent}% of its category` : ""}`}>
          {doc.specs.filter((s) => s.productId === p.id).map((s, si) => {
            const prices = doc.prices.filter((x) => x.specId === s.id);
            return (
              <div key={s.id} className="space-y-2 rounded-xl bg-prism-bg p-3">
                <p className="text-sm font-semibold">Specification {si + 1}: {s.description || "No description"}{s.unit.code ? ` · ${label("unit", s.unit.code, s.unit.otherText)}` : ""}</p>
                {form.config.priceSeries.map((sr) => (
                  <div key={sr} className="space-y-1 text-sm">
                    <p className="font-medium">{form.config.priceBasis[sr]?.label || "Price"}: current {amount(prices.find((x) => x.series === sr && x.kind === "CURRENT")?.amount)}</p>
                    <p className="text-prism-muted">
                      {months.map((m) => `${monthLong(m).slice(0, 3)} ${amount(prices.find((x) => x.series === sr && x.kind === "HISTORY" && x.month === m)?.amount)}`).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
          {(() => {
            const s = doc.seasonality.find((x) => x.productId === p.id);
            if (!form.config.productSeasonality) return null;
            if (!s) return <Rows rows={[["Seasonality", "Not answered yet"]]} />;
            const yn = (v: boolean | null) => (v === null ? "—" : v ? "Yes" : "No");
            const ms = (list: number[]) => (list.length ? list.map((m) => MONTHS_LONG[m - 1].slice(0, 3)).join(", ") : "—");
            return (
              <Rows rows={[
                ["Produced throughout the year", yn(s.producedAllYear)], ...(s.producedAllYear === false ? [["Months available", ms(s.availableMonths)] as [string, string]] : []),
                ["Highest production", ms(s.highProductionMonths)], ["Lowest production", ms(s.lowProductionMonths)],
                ["Prices affected by seasonality", yn(s.pricesSeasonal)], ["Months not sold", s.hasNoSalePeriods ? ms(s.noSaleMonths) : yn(s.hasNoSalePeriods)],
                ["Where sold", s.salesLocationCodes.map((c) => label("salesLocation", c, s.salesLocationOther)).join(", ") || "—"],
                ["Main buyer", label("mainBuyer", s.mainBuyer.code, s.mainBuyer.otherText)],
              ]} />
            );
          })()}
        </CopySection>
      ))}
      {doc.quarters.length ? (
        <CopySection title="Quarterly revenue">
          <Rows rows={[...doc.quarters].sort((a, b) => a.year - b.year || a.quarter - b.quarter).map((q) => [`Q${q.quarter} ${q.year}`, q.amount.state === "REPORTED" ? `${symbol} ${q.amount.amount}` : amount(q.amount)] as [string, string])} />
        </CopySection>
      ) : null}
    </div>
  );
}

function CopySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-prism-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="font-bold text-prism-purple">{title}</h3>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-prism-muted">{k}</dt>
          <dd className="break-words text-prism-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ pieces

function Panel({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-prism-border bg-white p-4 shadow-sm sm:p-5">
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-prism-text">{title}</h3>
        {intro ? <p className="text-sm text-prism-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Banner({ tone, title, children, testId }: { tone: "ok" | "warn"; title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div role="status" data-testid={testId}
      className={`flex gap-3 rounded-2xl border p-4 sm:p-5 ${tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      {tone === "ok"
        ? <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
        : <InfoDot />}
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  );
}

const InfoDot = () => (
  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white">i</span>
);

function Fact({ icon, number, children }: { icon?: "people" | "chat" | "lock"; number?: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prism-purple/10 font-bold text-prism-purple">
        {number ?? (icon ? <FactIcon icon={icon} /> : null)}
      </span>
      <span className="text-sm text-prism-text sm:text-base">{children}</span>
    </li>
  );
}

const svg = (d: string, large?: boolean) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={large ? "h-6 w-6" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
function FactIcon({ icon }: { icon: "people" | "chat" | "lock" }) {
  return svg({
    people: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8",
    chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z",
    lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  }[icon]);
}
function GroupIcon({ icon }: { icon: Icon }) {
  return svg({
    business: "M4 20V8l8-4 8 4v12M9 20v-6h6v6M3 20h18",
    revenue: "M12 3a9 9 0 1 0 9 9h-9V3ZM15 3.5A9 9 0 0 1 20.5 9H15V3.5Z",
    product: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
    season: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
    quarter: "M4 20h16M7 16v-5M12 16V8M17 16v-8",
  }[icon], true);
}
function ContactIcon({ icon, large }: { icon: "person" | "office" | "hq"; large?: boolean }) {
  return svg({
    person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
    office: "M5 21V4h10v17M15 9h4v12M9 8h2M9 12h2M9 16h2M3 21h18",
    hq: "M3 21h18M5 10h14M12 3l8 5H4l8-5ZM6 10v8M10 10v8M14 10v8M18 10v8",
  }[icon], large);
}
