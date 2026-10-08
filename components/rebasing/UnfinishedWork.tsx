"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { formatDateTime, formatDay, number, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

// Workload › Unfinished work. After a week ends: outlets started in it that
// still have products with no price, no "not available" and no carry-forward,
// and each market's shortfall. Supervisors carry such work forward for an
// absent reader (the RS approves). Once the last week has ended, HQ / RS
// record what could not be collected so the month can close.

type Product = { item_id: string; item_name: string; product_id: string; product_name: string };
type OutletRow = { market_id: string; outlet_id: string; outlet_code: string | null; outlet_name: string; week_no: number; week_id: string; reader_name: string; products: Product[] };
type MarketRow = {
  market_id: string; market_name: string; district_name: string; region_name: string;
  shortfall: { week_no: number; target: number; accounted: number; short: number }[];
  outlets: OutletRow[]; unresolved_products: number; unresolved_outlets: number;
};
type Unfinished = {
  weeks_ended: { week_id: string; week_no: number; end_date: string }[];
  later_weeks: { week_id: string; week_no: number; start_date: string; end_date: string }[];
  last_week_ended: boolean; can_carry: boolean; can_mark_not_collected: boolean; markets: MarketRow[];
};
type Exception = { exception_id: string; market_name: string; region_name: string; outlet_name: string | null; product_name: string | null; scope_type: string; reason_category: string; note: string | null; products_marked: number; created_by_name: string; created_at: string };

const REASONS = [
  { value: "READER_ABSENT", label: "Reader absent" },
  { value: "OUTLET_CLOSED", label: "Outlet closed" },
  { value: "ACCESS_INSECURITY", label: "Access or insecurity" },
  { value: "OTHER", label: "Other" },
] as const;
const reasonLabel = (value: string) => REASONS.find((r) => r.value === value)?.label ?? value;

type CarryTarget = { market: MarketRow; outlet: OutletRow };
type NotCollectedTarget = { scope: "ALL" } | { scope: "MARKET"; market: MarketRow } | { scope: "OUTLET"; market: MarketRow; outlet: OutletRow };

export function UnfinishedWork({ periodId }: { periodId: string }) {
  const [version, setVersion] = useState(0);
  const data = useRebasingQuery<Unfinished>(`/periods/${periodId}/unfinished`, version);
  const exceptions = useRebasingQuery<{ exceptions: Exception[] }>(`/periods/${periodId}/exceptions`, version);
  const [carry, setCarry] = useState<CarryTarget | null>(null);
  const [notCollected, setNotCollected] = useState<NotCollectedTarget | null>(null);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const d = data.data;
  const done = (message: string) => { setCarry(null); setNotCollected(null); setNotice(message); setVersion((v) => v + 1); };
  const toggle = (id: string) => setOpen((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const totalUnresolved = (d?.markets || []).reduce((n, m) => n + m.unresolved_products, 0);

  return (
    <div className="mt-6 space-y-5">
      {notice && <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {data.error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</p>}
      {data.loading && !d && <p className="rounded-3xl bg-white p-8 text-center text-sm text-prism-muted shadow-sm">Looking for unfinished work…</p>}

      {d && (
        <>
          <div className="rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-prism-text">Unfinished work</h2>
            <p className="mt-1 max-w-3xl text-xs text-prism-muted">
              {d.weeks_ended.length === 0
                ? "Nothing yet - this list fills in once a week ends."
                : `Outlets started in ${d.weeks_ended.map((w) => `week ${w.week_no}`).join(", ")} that still have products with no price, no "not available" and no carry-forward, and each market's shortfall.`}
              {d.can_carry ? " Carry unfinished work forward for the reader; your Regional Statistician approves it." : ""}
            </p>
          </div>

          {d.last_week_ended && d.can_mark_not_collected && totalUnresolved > 0 && (
            <div className="flex flex-col gap-3 rounded-3xl border border-rose-200 bg-rose-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-rose-900">{`The last week has ended - ${number.format(totalUnresolved)} products are still not collected`}</p>
                <p className="text-xs text-rose-900/80">Record them as not collected, with a reason, so the month can close. It is audited and shown in the reports.</p>
              </div>
              <button type="button" onClick={() => setNotCollected({ scope: "ALL" })} className="shrink-0 rounded-full bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700">Record all as not collected…</button>
            </div>
          )}

          {d.markets.length === 0 && d.weeks_ended.length > 0 && (
            <p className="rounded-3xl border border-dashed border-prism-border bg-white/70 p-10 text-center text-sm text-prism-muted">No unfinished work. Every started outlet is done or carried forward, and every target is met.</p>
          )}

          {d.markets.map((m) => (
            <section key={m.market_id} className="rounded-3xl border border-prism-border/70 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-prism-border/60 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div>
                  <h3 className="text-sm font-black text-prism-text">{m.market_name}</h3>
                  <p className="text-[11px] text-prism-muted">{`${m.district_name} · ${m.region_name}`}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.shortfall.map((s) => (
                      <span key={s.week_no} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{`Week ${s.week_no}: ${s.short} outlet${s.short === 1 ? "" : "s"} short (${s.accounted}/${s.target})`}</span>
                    ))}
                    {m.unresolved_products > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{`${number.format(m.unresolved_products)} products in ${m.unresolved_outlets} outlets still open`}</span>
                    )}
                  </div>
                </div>
                {d.can_mark_not_collected && m.unresolved_products > 0 && (
                  <button type="button" onClick={() => setNotCollected({ scope: "MARKET", market: m })} className="self-start rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Not collected (market)…</button>
                )}
              </div>
              {m.outlets.length > 0 ? (
                <ul className="divide-y divide-prism-border/50">
                  {m.outlets.map((o) => (
                    <li key={o.outlet_id} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button type="button" onClick={() => toggle(o.outlet_id)} className="min-w-0 text-left">
                          <p className="truncate text-sm font-bold text-prism-text">{o.outlet_name}</p>
                          <p className="text-[11px] text-prism-muted">{`Started in week ${o.week_no} by ${o.reader_name} · ${o.products.length} product${o.products.length === 1 ? "" : "s"} open · ${open.has(o.outlet_id) ? "hide" : "show"}`}</p>
                        </button>
                        <div className="flex shrink-0 gap-2">
                          {d.can_carry && (
                            <button type="button" onClick={() => setCarry({ market: m, outlet: o })} className="rounded-full bg-prism-purple px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">Carry forward…</button>
                          )}
                          {d.can_mark_not_collected && (
                            <button type="button" onClick={() => setNotCollected({ scope: "OUTLET", market: m, outlet: o })} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Not collected…</button>
                          )}
                        </div>
                      </div>
                      {open.has(o.outlet_id) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {o.products.map((p) => <span key={p.product_id} className="rounded-full bg-prism-bg px-2 py-0.5 text-[11px] text-prism-text">{`${p.product_name} · ${p.item_name}`}</span>)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-xs text-prism-muted">No started outlet is left unfinished here; the shortfall is outlets nobody visited.</p>
              )}
            </section>
          ))}

          {(exceptions.data?.exceptions.length ?? 0) > 0 && (
            <section className="rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-sm font-black text-prism-text">Recorded as not collected</h3>
              <ul className="mt-3 divide-y divide-prism-border/50 text-xs">
                {exceptions.data!.exceptions.map((e) => (
                  <li key={e.exception_id} className="py-2">
                    <p className="font-bold text-prism-text">{`${e.market_name}${e.outlet_name ? ` · ${e.outlet_name}` : ""}${e.product_name ? ` · ${e.product_name}` : ""} - ${number.format(e.products_marked)} products`}</p>
                    <p className="text-prism-muted">{`${reasonLabel(e.reason_category)}${e.note ? `: ${e.note}` : ""} · ${e.created_by_name} · ${formatDateTime(e.created_at)}`}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {carry && d && <CarryDialog periodId={periodId} target={carry} laterWeeks={d.later_weeks} onClose={() => setCarry(null)} onDone={done} />}
      {notCollected && <NotCollectedDialog periodId={periodId} target={notCollected} onClose={() => setNotCollected(null)} onDone={done} />}
    </div>
  );
}

function Sheet({ title, eyebrow, busy, onClose, children }: { title: string; eyebrow: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-prism-border/60 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-teal">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black text-prism-text">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted disabled:opacity-40">×</button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </section>
    </div>
  );
}

// Supervisor: carry an unfinished outlet (or one of its products) to a later
// week for the reader. The RS approves it.
function CarryDialog({ periodId, target, laterWeeks, onClose, onDone }: {
  periodId: string; target: CarryTarget; laterWeeks: Unfinished["later_weeks"]; onClose: () => void; onDone: (message: string) => void;
}) {
  const [what, setWhat] = useState<string>("OUTLET");
  const [weekId, setWeekId] = useState(laterWeeks[0]?.week_id ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product = target.outlet.products.find((p) => p.product_id === what);
  const problem = !weekId ? "Choose the week to carry it to." : reason.trim().length < 5 ? "Give a reason (at least 5 characters)." : "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      await rebasingApi("/carryovers", {
        method: "POST",
        body: {
          periodId, outletId: target.outlet.outlet_id, scopeType: product ? "PRODUCT" : "OUTLET",
          itemId: product?.item_id ?? null, productId: product?.product_id ?? null,
          sourceWeekId: target.outlet.week_id, targetWeekId: weekId, reason: reason.trim(),
        },
      });
      onDone(`${target.outlet.outlet_name}: carry-forward sent to the Regional Statistician for approval.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The carry-forward could not be requested.");
      setBusy(false);
    }
  };

  return (
    <Sheet title={target.outlet.outlet_name} eyebrow="Carry forward for the reader" busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-[11px] font-bold text-prism-muted">What to carry</span>
          <select value={what} onChange={(e) => setWhat(e.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-sm">
            <option value="OUTLET">Whole outlet (if its visit is not completed)</option>
            {target.outlet.products.map((p) => <option key={p.product_id} value={p.product_id}>{`${p.product_name} · ${p.item_name}`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-prism-muted">Carry to</span>
          <select value={weekId} onChange={(e) => setWeekId(e.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-sm">
            {laterWeeks.map((w) => <option key={w.week_id} value={w.week_id}>{`Week ${w.week_no} · ${formatDay(w.start_date)} – ${formatDay(w.end_date)}`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-prism-muted">Reason</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Reader was ill all week" className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-sm" />
        </label>
        <p className="rounded-2xl bg-prism-bg/70 px-3 py-2 text-[11px] text-prism-text">It stays with this outlet, goes to your Regional Statistician for approval, and then appears on readers&apos; phones in that week.</p>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={!!problem || busy} title={problem} className="rounded-full bg-prism-purple px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy ? "Sending…" : "Send for approval"}</button>
        </div>
      </form>
    </Sheet>
  );
}

// HQ / RS: record unresolved work as not collected, with a reason.
function NotCollectedDialog({ periodId, target, onClose, onDone }: { periodId: string; target: NotCollectedTarget; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState<string>("READER_ABSENT");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = reason === "OTHER" && note.trim().length < 5 ? "Describe the reason (at least 5 characters)." : "";
  const title = target.scope === "ALL" ? "Everything still open" : target.scope === "MARKET" ? target.market.market_name : target.outlet.outlet_name;
  const scopeText = target.scope === "ALL" ? "every product still open in your markets"
    : target.scope === "MARKET" ? `the ${number.format(target.market.unresolved_products)} products still open in ${target.market.market_name}`
      : `the products still open at ${target.outlet.outlet_name}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rebasingApi<{ products_marked: number; markets: number }>(`/periods/${periodId}/not-collected`, {
        method: "POST",
        body: {
          scopeType: target.scope,
          marketId: target.scope === "ALL" ? null : target.market.market_id,
          outletId: target.scope === "OUTLET" ? target.outlet.outlet_id : null,
          reasonCategory: reason,
          note: note.trim() || null,
        },
      });
      onDone(`${number.format(result.products_marked)} products recorded as not collected${result.markets > 1 ? ` in ${result.markets} markets` : ""}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not record this.");
      setBusy(false);
    }
  };

  return (
    <Sheet title={title} eyebrow="Record as not collected" busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-prism-text">{`This records ${scopeText} as not collected this month. Carry-forwards that can no longer be done are settled. It is audited and appears in the reports.`}</p>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-[11px] font-bold text-prism-muted">Reason</legend>
          {REASONS.map((r) => (
            <label key={r.value} className={clsx("cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold", reason === r.value ? "border-rose-400 bg-rose-50 text-rose-800" : "border-prism-border text-prism-text")}>
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="text-[11px] font-bold text-prism-muted">{reason === "OTHER" ? "Describe the reason" : "Note (optional)"}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-sm" />
        </label>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={!!problem || busy} title={problem} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Record as not collected"}</button>
        </div>
      </form>
    </Sheet>
  );
}
