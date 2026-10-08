"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { number, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

// Reader assignments and weekly workload for a month. Every reader starts in
// their home market (DEFAULT); only HQ/Admin move, remove or add readers.
// Supervisors (their markets), Regional Statisticians (their region) and HQ
// manage the workload: how each market's outlets are spread across the three
// weeks. Every change is audited with a reason.

type BoardReader = { assignment_id: string; reader_id: string; reader_name: string; reader_email: string; source: "DEFAULT" | "MANUAL" | "OVERRIDE"; home_market_id: string | null };
type BoardMarket = {
  market_id: string; market_code: string | null; market_name: string; district_name: string; region_name: string; readers: BoardReader[];
  total_outlets: number | null; week1_target: number | null; week2_target: number | null; week3_target: number | null;
};
type WorkloadWeek = { week_id: string; week_no: number; start_date: string; end_date: string; target: number; accounted: number; incoming: number; editable: boolean; minimum: number };
type Unassigned = { reader_id: string; reader_name: string; reader_email: string; home_market_id: string; home_market_name: string };
type Board = { scope: string; period_status: string; can_change: boolean; can_manage_workload: boolean; markets: BoardMarket[]; unassigned_readers: Unassigned[] };

type Action =
  | { kind: "move"; reader: BoardReader; from: BoardMarket }
  | { kind: "remove"; reader: BoardReader; from: BoardMarket }
  | { kind: "add"; market: BoardMarket | null; reader: Unassigned | null };

export function AssignmentsPanel({ periodId, periodName, role }: { periodId: string; periodName: string; role: DashboardUser["role"] }) {
  const [version, setVersion] = useState(0);
  const board = useRebasingQuery<Board>(`/market-assignments/board?periodId=${periodId}`, version);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [balancing, setBalancing] = useState<BoardMarket | null>(null);
  const [notice, setNotice] = useState("");
  const data = board.data;

  const markets = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = data?.markets || [];
    if (!term) return all;
    return all.filter((m) => `${m.market_name} ${m.district_name} ${m.region_name}`.toLowerCase().includes(term)
      || m.readers.some((r) => r.reader_name.toLowerCase().includes(term)));
  }, [data, search]);

  const totals = useMemo(() => {
    const readers = (data?.markets || []).flatMap((m) => m.readers);
    return {
      markets: data?.markets.length || 0,
      assigned: readers.length,
      changed: readers.filter((r) => r.source !== "DEFAULT").length,
      unassigned: data?.unassigned_readers.length || 0,
      empty: (data?.markets || []).filter((m) => m.readers.length === 0).length,
    };
  }, [data]);

  const scopeText = role === "SUPERVISOR" ? "your markets" : role === "REGIONAL_STATISTICIAN" ? "your region" : "all markets";

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-prism-text">Assignments &amp; workload · {periodName}</h2>
        <p className="mt-1 max-w-3xl text-xs text-prism-muted">
          {data?.can_change
            ? "Every reader starts in their home market. Change only where needed - move a reader, remove one who is unavailable, or add one to a market. "
            : "Readers are assigned to markets by HQ. "}
          {data?.can_manage_workload ? `Balance the workload in ${scopeText}: how many outlets each market collects in each week. ` : ""}
          Each change needs a reason and is recorded.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Markets" value={totals.markets} />
          <Stat label="Readers assigned" value={totals.assigned} hint={`${number.format(totals.assigned - totals.changed)} default · ${number.format(totals.changed)} changed`} />
          <Stat label="Unassigned readers" value={totals.unassigned} warn={totals.unassigned > 0} />
          <Stat label="Markets with no reader" value={totals.empty} warn={totals.empty > 0} />
        </dl>
        {data && data.period_status === "CLOSED" && <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-prism-muted">This month is closed; assignments are read-only.</p>}
      </div>

      {notice && <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">{notice}</p>}
      {board.error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{board.error}</p>}
      {board.loading && !data && <p className="rounded-3xl bg-white p-8 text-center text-sm text-prism-muted shadow-sm">Loading assignments…</p>}

      {data && data.unassigned_readers.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
          <h3 className="text-sm font-black text-amber-900">Readers with no market this month ({data.unassigned_readers.length})</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.unassigned_readers.map((r) => (
              <li key={r.reader_id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-amber-200">
                <span className="font-bold text-prism-text">{r.reader_name}</span>
                <span className="text-prism-muted">home: {r.home_market_name}</span>
                {data.can_change && (
                  <button type="button" onClick={() => setAction({ kind: "add", market: null, reader: r })} className="rounded-full px-2 py-0.5 font-bold text-prism-purple hover:bg-prism-purple/10">Assign…</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && (
        <div className="overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-prism-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-prism-text">{number.format(markets.length)} markets</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search market, district, region or reader" className="rounded-xl border border-prism-border px-3 py-2 text-xs sm:w-72" />
          </div>
          <ul className="divide-y divide-prism-border/60">
            {markets.map((m) => (
              <li key={m.market_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0 sm:w-64 sm:shrink-0">
                  <p className="truncate text-sm font-black text-prism-text">{m.market_name}</p>
                  <p className="truncate text-[11px] text-prism-muted">{m.district_name} · {m.region_name}</p>
                  {m.total_outlets !== null && m.week1_target !== null && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-prism-teal/10 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                        {`W1 ${m.week1_target} · W2 ${m.week2_target} · W3 ${m.week3_target} of ${m.total_outlets} outlets`}
                      </span>
                      {data.can_manage_workload && (
                        <button type="button" onClick={() => setBalancing(m)} className="rounded-full px-2 py-0.5 text-[10px] font-bold text-prism-purple hover:bg-prism-purple/10">Balance weeks…</button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {m.readers.length === 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">No reader</span>}
                  {m.readers.map((r) => (
                    <span key={r.assignment_id} className="flex items-center gap-1.5 rounded-full bg-prism-bg px-3 py-1.5 text-xs">
                      <span className="font-bold text-prism-text">{r.reader_name}</span>
                      <span className={clsx("rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase", r.source === "DEFAULT" ? "bg-white text-prism-muted" : "bg-amber-100 text-amber-800")}>
                        {r.source === "DEFAULT" ? "Default" : "Changed"}
                      </span>
                      {data.can_change && (
                        <>
                          <button type="button" onClick={() => setAction({ kind: "move", reader: r, from: m })} className="rounded-full px-1.5 font-bold text-prism-purple hover:bg-prism-purple/10">Move</button>
                          <button type="button" onClick={() => setAction({ kind: "remove", reader: r, from: m })} className="rounded-full px-1.5 font-bold text-rose-700 hover:bg-rose-50">Remove</button>
                        </>
                      )}
                    </span>
                  ))}
                  {data.can_change && (
                    <button type="button" onClick={() => setAction({ kind: "add", market: m, reader: null })} className="rounded-full border border-dashed border-prism-border px-3 py-1.5 text-[11px] font-bold text-prism-muted hover:border-prism-purple hover:text-prism-purple">+ Add reader</button>
                  )}
                </div>
              </li>
            ))}
            {!markets.length && <li className="p-8 text-center text-xs text-prism-muted">No markets match.</li>}
          </ul>
        </div>
      )}

      {balancing && (
        <WorkloadDialog
          periodId={periodId}
          market={balancing}
          onClose={() => setBalancing(null)}
          onDone={(message) => { setBalancing(null); setNotice(message); setVersion((v) => v + 1); }}
        />
      )}

      {action && data && (
        <ChangeDialog
          action={action}
          periodId={periodId}
          markets={data.markets}
          unassigned={data.unassigned_readers}
          onClose={() => setAction(null)}
          onDone={(message) => { setAction(null); setNotice(message); setVersion((v) => v + 1); }}
        />
      )}
    </section>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className={clsx("rounded-2xl px-3 py-2.5", warn ? "bg-amber-50" : "bg-prism-bg/70")}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-prism-muted">{label}</dt>
      <dd className={clsx("mt-0.5 text-lg font-black", warn ? "text-amber-800" : "text-prism-text")}>{number.format(value)}</dd>
      {hint && <p className="text-[10px] text-prism-muted">{hint}</p>}
    </div>
  );
}

function ChangeDialog({ action, periodId, markets, unassigned, onClose, onDone }: {
  action: Action;
  periodId: string;
  markets: BoardMarket[];
  unassigned: Unassigned[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [marketId, setMarketId] = useState(action.kind === "add" && action.market ? action.market.market_id : "");
  const [readerId, setReaderId] = useState(action.kind === "add" && action.reader ? action.reader.reader_id : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const title = action.kind === "move" ? `Move ${action.reader.reader_name}`
    : action.kind === "remove" ? `Remove ${action.reader.reader_name}`
      : action.market ? `Add a reader to ${action.market.market_name}` : `Assign ${action.reader?.reader_name}`;
  const needsMarket = action.kind === "move" || (action.kind === "add" && !action.market);
  const needsReader = action.kind === "add" && !action.reader;
  const problem = reason.trim().length < 5 ? "Give a reason (at least 5 characters)."
    : needsMarket && !marketId ? "Choose the market." : needsReader && !readerId ? "Choose the reader." : "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      if (action.kind === "move") {
        await rebasingApi(`/market-assignments/${action.reader.assignment_id}/move`, { method: "POST", body: { marketId, reason: reason.trim() } });
        onDone(`${action.reader.reader_name} moved to ${markets.find((m) => m.market_id === marketId)?.market_name}.`);
      } else if (action.kind === "remove") {
        await rebasingApi(`/market-assignments/${action.reader.assignment_id}/override`, { method: "POST", body: { type: "REMOVE_READER", reason: reason.trim() } });
        onDone(`${action.reader.reader_name} removed from ${action.from.market_name}.`);
      } else {
        const target = action.market ? action.market.market_id : marketId;
        const reader = action.reader ? action.reader.reader_id : readerId;
        await rebasingApi("/market-assignments/overrides", { method: "POST", body: { periodId, marketId: target, newReaderId: reader, reason: reason.trim() } });
        onDone("Reader assigned.");
      }
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "The change could not be saved.");
      setBusy(false);
    }
  };

  const targetMarkets = markets.filter((m) => action.kind !== "move" || m.market_id !== action.from.market_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form method="post" onSubmit={submit} role="dialog" aria-modal="true" aria-label={title} className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-teal">Change assignment</p>
            <h2 className="mt-1 text-lg font-black text-prism-text">{title}</h2>
            {action.kind !== "add" && <p className="mt-0.5 text-xs text-prism-muted">Currently in {action.from.market_name}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted disabled:opacity-40">×</button>
        </div>
        <div className="mt-4 space-y-3">
          {needsMarket && (
            <label className="block">
              <span className="text-[11px] font-bold text-prism-muted">{action.kind === "move" ? "Move to market" : "Market"}</span>
              <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-sm">
                <option value="">Choose a market…</option>
                {targetMarkets.map((m) => <option key={m.market_id} value={m.market_id}>{m.market_name} · {m.district_name} ({m.readers.length} reader{m.readers.length === 1 ? "" : "s"})</option>)}
              </select>
            </label>
          )}
          {needsReader && (
            <label className="block">
              <span className="text-[11px] font-bold text-prism-muted">Reader (only readers with no market this month)</span>
              <select value={readerId} onChange={(e) => setReaderId(e.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-sm">
                <option value="">Choose a reader…</option>
                {unassigned.map((r) => <option key={r.reader_id} value={r.reader_id}>{r.reader_name} · home {r.home_market_name}</option>)}
              </select>
              {unassigned.length === 0 && <span className="mt-1 block text-[11px] text-prism-muted">Every reader in your scope already has a market. Move one instead.</span>}
            </label>
          )}
          <label className="block">
            <span className="text-[11px] font-bold text-prism-muted">Reason</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Reader on leave this month" className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-sm" />
          </label>
          {action.kind === "remove" && <p className="text-[11px] text-prism-muted">The reader keeps any prices already captured; they simply stop collecting in this market. Removing a default is final for this month - they will not be re-added automatically.</p>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold text-prism-text disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={!!problem || busy} title={problem} className={clsx("rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40", action.kind === "remove" ? "bg-rose-600" : "bg-prism-purple")}>
            {busy ? "Saving…" : action.kind === "move" ? "Move reader" : action.kind === "remove" ? "Remove reader" : "Assign reader"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Spread a market's outlets across the weeks. The total never changes; a
// finished week keeps its target and no week can drop below what it has
// already accounted for (the server enforces the same rules).
function WorkloadDialog({ periodId, market, onClose, onDone }: {
  periodId: string;
  market: BoardMarket;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const workload = useRebasingQuery<{ weeks: WorkloadWeek[] }>(`/periods/${periodId}/market-plans/${market.market_id}/workload`);
  const weeks = workload.data?.weeks || [];
  const [draft, setDraft] = useState<number[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targets = draft ?? weeks.map((w) => w.target);
  const total = market.total_outlets ?? 0;
  const sum = targets.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const changed = weeks.some((w, i) => targets[i] !== w.target);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const problem = !weeks.length ? ""
    : !changed ? "Change at least one week."
      : weeks.find((w, i) => !Number.isInteger(targets[i]) || targets[i] < 0) ? "Use whole numbers."
        : sum !== total ? `The weeks must add up to ${total} outlets (now ${sum}).`
          : weeks.find((w, i) => targets[i] < w.minimum) ? `A week cannot go below the outlets it has already covered.`
            : reason.trim().length < 5 ? "Give a reason (at least 5 characters)." : "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      await rebasingApi(`/periods/${periodId}/market-plans/${market.market_id}/week-targets`, { method: "PATCH", body: { targets, reason: reason.trim() } });
      onDone(`${market.market_name}: weeks now ${targets.join(" · ")} outlets.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The workload could not be saved.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form method="post" onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Balance weeks for ${market.market_name}`} className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-teal">Weekly workload</p>
            <h2 className="mt-1 text-lg font-black text-prism-text">{market.market_name}</h2>
            <p className="mt-0.5 text-xs text-prism-muted">{`${total} outlets this month, spread across the three weeks.`}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted disabled:opacity-40">×</button>
        </div>
        {workload.loading && !weeks.length && <p className="mt-4 text-xs text-prism-muted">Loading weeks…</p>}
        {workload.error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{workload.error}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {weeks.map((w, i) => (
            <label key={w.week_id} className={clsx("rounded-2xl border p-3", w.editable ? "border-prism-border" : "border-slate-200 bg-slate-50")}>
              <span className="block text-xs font-black text-prism-text">{`Week ${w.week_no}`}</span>
              <span className="block text-[10px] text-prism-muted">{w.editable ? `${w.accounted} covered` : "Finished"}</span>
              <input
                type="number"
                inputMode="numeric"
                min={w.minimum}
                max={total}
                value={Number.isFinite(targets[i]) ? targets[i] : ""}
                disabled={!w.editable || busy}
                onChange={(e) => setDraft(targets.map((t, j) => (j === i ? Number.parseInt(e.target.value, 10) : t)))}
                className="mt-2 w-full rounded-xl border border-prism-border px-2 py-2 text-center text-lg font-black text-prism-text disabled:bg-transparent disabled:text-prism-muted"
              />
            </label>
          ))}
        </div>
        {weeks.length > 0 && (
          <p className={clsx("mt-2 text-xs font-bold", sum === total ? "text-emerald-700" : "text-amber-700")}>{`Total ${sum} / ${total}`}</p>
        )}
        <label className="mt-3 block">
          <span className="text-[11px] font-bold text-prism-muted">Reason</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Market day falls in week 3" className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-sm" />
        </label>
        {problem && changed && <p className="mt-2 text-xs font-semibold text-red-700">{problem}</p>}
        {error && <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold text-prism-text disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={!!problem || busy} title={problem} className="rounded-full bg-prism-purple px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Save weeks"}</button>
        </div>
      </form>
    </div>
  );
}
