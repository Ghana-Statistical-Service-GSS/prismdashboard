"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { Period, formatDateTime, formatDay, number, periodLabel, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";
import { UnfinishedWork } from "./UnfinishedWork";

// Market Reading › Workload. How each market's outlets are spread across the
// three collection weeks. Supervisors propose changes for their markets and
// the Regional Statistician approves them; Regional Statisticians and HQ
// change their markets directly. The total never changes, finished weeks are
// fixed and no week goes below what it has already covered (the server
// enforces the same rules).

type OverviewWeek = { week_id: string; week_no: number; start_date: string; end_date: string; status: string; editable: boolean };
type WeekRequest = {
  request_id: string; plan_id: string; market_id: string; market_name: string; district_name: string; region_name: string;
  before_targets: number[]; requested_targets: number[]; reason: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requested_by: string; requested_by_name: string; requested_at: string; decided_by_name: string | null; decided_at: string | null; decision_comment: string | null;
};
type OverviewMarket = {
  plan_id: string; market_id: string; market_name: string; district_name: string; region_id: string; region_name: string;
  total_outlets: number; targets: number[]; accounted: number[]; change_count: number; pending_request: WeekRequest | null;
};
type Overview = {
  period_status: string; period_type: string; scope: string; can_edit: boolean; needs_approval: boolean; can_decide: boolean;
  weeks: OverviewWeek[]; markets: OverviewMarket[];
};
type MarketWeek = { week_id: string; week_no: number; start_date: string; end_date: string; target: number; accounted: number; incoming: number; editable: boolean; minimum: number };
type History = { change_id: string; before_targets: number[]; after_targets: number[]; reason: string; changed_at: string; changed_by_name: string; request_id: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const weekState = (w: { start_date: string; end_date: string; status: string }) =>
  w.status === "CLOSED" ? "Closed" : w.end_date < today() ? "Finished" : w.start_date > today() ? "Upcoming" : "This week";
const split = (targets: number[]) => targets.map((t, i) => `W${i + 1} ${t}`).join(" · ");

export function WorkloadPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<OverviewMarket | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "changed" | "behind">("all");
  const [view, setView] = useState<"plan" | "unfinished">(useSearchParams().get("view") === "unfinished" ? "unfinished" : "plan");

  useEffect(() => { loadDashboardUser().then(setUser).catch(() => {}); }, []);
  const periods = useRebasingQuery<{ periods: Period[] }>("/periods");
  const normal = useMemo(() => (periods.data?.periods || []).filter((p) => p.period_type === "NORMAL" && p.status !== "UPCOMING")
    .sort((a, b) => b.observation_month.localeCompare(a.observation_month)), [periods.data]);
  const selectedId = periodId ?? normal.find((p) => p.status === "OPEN")?.period_id ?? normal[0]?.period_id ?? null;
  const period = normal.find((p) => p.period_id === selectedId) || null;

  const overview = useRebasingQuery<Overview>(selectedId ? `/periods/${selectedId}/workload` : null, version);
  const requests = useRebasingQuery<{ requests: WeekRequest[] }>(selectedId ? `/periods/${selectedId}/week-target-requests` : null, version);
  const data = overview.data;
  const refresh = (message?: string) => { if (message) setNotice(message); setVersion((v) => v + 1); };

  const regions = useMemo(() => [...new Map((data?.markets || []).map((m) => [m.region_id, m.region_name])).entries()], [data]);
  const currentWeekIndex = (data?.weeks || []).findIndex((w) => weekState(w) === "This week");
  const markets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.markets || []).filter((m) => {
      if (region && m.region_id !== region) return false;
      if (term && !`${m.market_name} ${m.district_name} ${m.region_name}`.toLowerCase().includes(term)) return false;
      if (filter === "pending") return !!m.pending_request;
      if (filter === "changed") return m.change_count > 0;
      if (filter === "behind") return currentWeekIndex >= 0 && m.accounted[currentWeekIndex] < m.targets[currentWeekIndex];
      return true;
    });
  }, [data, search, region, filter, currentWeekIndex]);

  const totals = useMemo(() => {
    const rows = data?.markets || [];
    return (data?.weeks || []).map((_, i) => ({
      target: rows.reduce((n, m) => n + (m.targets[i] || 0), 0),
      accounted: rows.reduce((n, m) => n + (m.accounted[i] || 0), 0),
    }));
  }, [data]);
  const pending = (requests.data?.requests || []).filter((r) => r.status === "PENDING");
  const mine = (requests.data?.requests || []).filter((r) => r.requested_by === user?.user_id).slice(0, 8);

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Reading</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:text-3xl">Weekly Workload</h1>
          <p className="mt-2 max-w-2xl text-sm text-prism-muted">
            How many outlets each market collects in each week. Readers still choose any outlet; the numbers set how much each week should cover.
            {data && (data.needs_approval ? " Your changes go to your Regional Statistician for approval." : " Your changes apply straight away.")}
          </p>
        </div>
        {normal.length > 0 && (
          <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-prism-text shadow-sm">
            Month
            <select value={selectedId ?? ""} onChange={(e) => setPeriodId(e.target.value)} className="bg-transparent text-sm font-black outline-none">
              {normal.map((p) => <option key={p.period_id} value={p.period_id}>{`${periodLabel(p)}${p.status === "CLOSED" ? " (closed)" : ""}`}</option>)}
            </select>
          </label>
        )}
      </header>

      {notice && <p role="status" className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {(periods.error || overview.error) && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{periods.error || overview.error}</p>}
      {periods.data && normal.length === 0 && <Empty title="No current month yet">The weekly workload appears once HQ opens a current (non-backfill) month.</Empty>}
      {overview.loading && !data && selectedId && <Empty title="Loading workload…">Getting every market&apos;s weekly plan.</Empty>}

      {data && period && (
        <div className="mt-6 inline-flex rounded-full bg-white p-1 shadow-sm">
          {([["plan", "Weekly plan"], ["unfinished", "Unfinished work"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} className={clsx("rounded-full px-5 py-2 text-xs font-bold", view === key ? "bg-prism-purple text-white" : "text-prism-muted hover:text-prism-text")}>{label}</button>
          ))}
        </div>
      )}

      {data && period && view === "unfinished" && selectedId && <UnfinishedWork periodId={selectedId} />}

      {data && period && view === "plan" && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            {data.weeks.map((w, i) => {
              const t = totals[i] || { target: 0, accounted: 0 };
              const pct = t.target ? Math.min(100, Math.round((t.accounted / t.target) * 100)) : 0;
              const state = weekState(w);
              return (
                <article key={w.week_id} className={clsx("rounded-3xl border bg-white p-5 shadow-sm", state === "This week" ? "border-prism-teal/60 ring-1 ring-prism-teal/30" : "border-prism-border/70")}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-prism-text">{`Week ${w.week_no}`}</p>
                    <span className={clsx("rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide",
                      state === "This week" ? "bg-prism-teal/15 text-teal-800" : state === "Upcoming" ? "bg-slate-100 text-prism-muted" : "bg-amber-100 text-amber-800")}>{state}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-prism-muted">{`${formatDay(w.start_date)} – ${formatDay(w.end_date)}`}</p>
                  <p className="mt-3 text-2xl font-black text-prism-text">{number.format(t.accounted)}<span className="text-sm font-bold text-prism-muted">{` / ${number.format(t.target)} outlets`}</span></p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-prism-bg"><div className="h-full rounded-full bg-prism-teal" style={{ width: `${pct}%` }} /></div>
                </article>
              );
            })}
          </section>

          {data.can_decide && pending.length > 0 && (
            <ApprovalQueue requests={pending} onDone={refresh} />
          )}
          {data.needs_approval && mine.length > 0 && (
            <MyRequests requests={mine} onDone={refresh} />
          )}

          <section className="mt-6 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-prism-border/60 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-black text-prism-text">Markets</h2>
                <p className="text-xs text-prism-muted">{`${number.format(markets.length)} of ${number.format(data.markets.length)} markets`}{!data.can_edit ? " · this month is not open, so the plan is read-only" : ""}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search market, district or region" className="rounded-xl border border-prism-border px-3 py-2 text-sm sm:w-64" />
                {regions.length > 1 && (
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-sm">
                    <option value="">All regions</option>
                    {regions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                )}
                <div className="inline-flex rounded-full bg-prism-bg p-1">
                  {([["all", "All"], ["behind", "Behind this week"], ["pending", "Waiting approval"], ["changed", "Changed"]] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setFilter(key)} className={clsx("rounded-full px-3 py-1.5 text-[11px] font-bold", filter === key ? "bg-white text-prism-purple shadow-sm" : "text-prism-muted")}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <ul className="divide-y divide-prism-border/60">
              {markets.map((m) => (
                <li key={m.market_id} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-prism-text">{m.market_name}</p>
                    <p className="truncate text-[11px] text-prism-muted">{`${m.district_name} · ${m.region_name} · ${m.total_outlets} outlets`}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {m.pending_request && <Chip tone="amber">{`Waiting for RS: ${split(m.pending_request.requested_targets)}`}</Chip>}
                      {m.change_count > 0 && <Chip tone="slate">{`Changed ${m.change_count}×`}</Chip>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {data.weeks.map((w, i) => {
                      const target = m.targets[i] || 0;
                      const done = m.accounted[i] || 0;
                      const pct = target ? Math.min(100, Math.round((done / target) * 100)) : done ? 100 : 0;
                      return (
                        <div key={w.week_id} className={clsx("rounded-xl px-2.5 py-2", i === currentWeekIndex ? "bg-prism-teal/10" : "bg-prism-bg/70")}>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-prism-muted">{`Week ${w.week_no}`}</p>
                          <p className="text-sm font-black text-prism-text">{done}<span className="text-[11px] font-semibold text-prism-muted">{` / ${target}`}</span></p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><div className={clsx("h-full rounded-full", done >= target ? "bg-emerald-500" : "bg-prism-teal")} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  {data.can_edit ? (
                    <button type="button" onClick={() => setEditing(m)} className="justify-self-start rounded-full bg-prism-purple px-4 py-2 text-xs font-bold text-white hover:brightness-110 md:justify-self-end">
                      {data.needs_approval ? "Request change" : "Adjust weeks"}
                    </button>
                  ) : <span />}
                </li>
              ))}
              {markets.length === 0 && <li className="p-10 text-center text-sm text-prism-muted">No markets match these filters.</li>}
            </ul>
          </section>
        </>
      )}

      {editing && selectedId && data && (
        <WorkloadEditor
          periodId={selectedId}
          market={editing}
          needsApproval={data.needs_approval}
          onClose={() => setEditing(null)}
          onDone={(message) => { setEditing(null); refresh(message); }}
        />
      )}
    </>
  );
}

function Chip({ tone, children }: { tone: "amber" | "slate" | "green" | "rose"; children: ReactNode }) {
  const styles = { amber: "bg-amber-100 text-amber-800", slate: "bg-slate-100 text-prism-muted", green: "bg-emerald-100 text-emerald-800", rose: "bg-rose-100 text-rose-700" }[tone];
  return <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold", styles)}>{children}</span>;
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-prism-border bg-white/70 p-10 text-center">
      <p className="text-sm font-black text-prism-text">{title}</p>
      <p className="mt-1 text-xs text-prism-muted">{children}</p>
    </div>
  );
}

function Diff({ before, after }: { before: number[]; after: number[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {after.map((t, i) => (
        <span key={i} className={clsx("rounded-lg px-2 py-1 text-[11px] font-bold", t === before[i] ? "bg-prism-bg text-prism-muted" : "bg-prism-purple/10 text-prism-purple")}>
          {`W${i + 1} ${before[i]}${t !== before[i] ? ` → ${t}` : ""}`}
        </span>
      ))}
    </div>
  );
}

// RS / HQ: Supervisor requests waiting for a decision.
function ApprovalQueue({ requests, onDone }: { requests: WeekRequest[]; onDone: (message: string) => void }) {
  const [rejecting, setRejecting] = useState<WeekRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const decide = async (request: WeekRequest, decision: "APPROVED" | "REJECTED", comment?: string) => {
    setBusy(request.request_id);
    setError("");
    try {
      await rebasingApi(`/week-target-requests/${request.request_id}/decision`, { method: "POST", body: { decision, ...(comment ? { comment } : {}) } });
      setRejecting(null);
      onDone(`${request.market_name}: change ${decision === "APPROVED" ? "approved and applied" : "rejected"}.`);
    } catch (failure) {
      setError(`${request.market_name}: ${failure instanceof Error ? failure.message : "could not be decided"}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <h2 className="text-base font-black text-amber-900">{`Waiting for your approval (${requests.length})`}</h2>
      <p className="text-xs text-amber-900/80">Supervisors asked to change these markets&apos; weekly split. Approving applies it straight away.</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {requests.map((r) => (
          <li key={r.request_id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-prism-text">{r.market_name}</p>
                <p className="truncate text-[11px] text-prism-muted">{`${r.district_name} · asked by ${r.requested_by_name} · ${formatDateTime(r.requested_at)}`}</p>
              </div>
            </div>
            <div className="mt-2"><Diff before={r.before_targets} after={r.requested_targets} /></div>
            <p className="mt-2 text-xs italic text-prism-text">{`“${r.reason}”`}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!!busy} onClick={() => setRejecting(r)} className="flex-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-40">Reject…</button>
              <button type="button" disabled={!!busy} onClick={() => void decide(r, "APPROVED")} className="flex-1 rounded-full bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40">{busy === r.request_id ? "Saving…" : "Approve"}</button>
            </div>
          </li>
        ))}
      </ul>
      {rejecting && <RejectDialog request={rejecting} busy={busy === rejecting.request_id} onCancel={() => setRejecting(null)} onReject={(comment) => void decide(rejecting, "REJECTED", comment)} />}
    </section>
  );
}

function RejectDialog({ request, busy, onCancel, onReject }: { request: WeekRequest; busy: boolean; onCancel: () => void; onReject: (comment: string) => void }) {
  const [comment, setComment] = useState("");
  return (
    <Sheet title={`Reject change for ${request.market_name}`} eyebrow="Workload request" onClose={onCancel} busy={busy}>
      <form onSubmit={(e) => { e.preventDefault(); if (comment.trim().length >= 5) onReject(comment.trim()); }} className="space-y-3">
        <Diff before={request.before_targets} after={request.requested_targets} />
        <label className="block">
          <span className="text-[11px] font-bold text-prism-muted">Why? (the Supervisor sees this)</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Keep week 1 as planned - market day is on Thursday" className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-sm" />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy || comment.trim().length < 5} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Reject change"}</button>
        </div>
      </form>
    </Sheet>
  );
}

// Supervisor: their recent requests and what happened to them.
function MyRequests({ requests, onDone }: { requests: WeekRequest[]; onDone: (message: string) => void }) {
  const [error, setError] = useState("");
  const withdraw = async (r: WeekRequest) => {
    setError("");
    try {
      await rebasingApi(`/week-target-requests/${r.request_id}/cancel`, { method: "POST", body: {} });
      onDone(`${r.market_name}: request withdrawn.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not withdraw the request.");
    }
  };
  const tone = { PENDING: "amber", APPROVED: "green", REJECTED: "rose", CANCELLED: "slate" } as const;
  const label = { PENDING: "Waiting for RS", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Withdrawn" } as const;
  return (
    <section className="mt-6 rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-black text-prism-text">Your requests</h2>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <ul className="mt-3 divide-y divide-prism-border/60">
        {requests.map((r) => (
          <li key={r.request_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-prism-text">{r.market_name}</p>
                <Chip tone={tone[r.status]}>{label[r.status]}</Chip>
              </div>
              <div className="mt-1"><Diff before={r.before_targets} after={r.requested_targets} /></div>
              {r.decision_comment && r.status === "REJECTED" && <p className="mt-1 text-xs text-rose-700">{`${r.decided_by_name}: ${r.decision_comment}`}</p>}
            </div>
            {r.status === "PENDING" && (
              <button type="button" onClick={() => void withdraw(r)} className="self-start rounded-full px-3 py-1.5 text-xs font-bold text-prism-purple hover:bg-prism-purple/10">Withdraw</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sheet({ title, eyebrow, busy, onClose, children, wide }: { title: string; eyebrow: string; busy: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className={clsx("max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
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

// Adjust one market's weeks with steppers. Moving an outlet out of a week
// means adding it to another, so the total stays the same.
function WorkloadEditor({ periodId, market, needsApproval, onClose, onDone }: {
  periodId: string; market: OverviewMarket; needsApproval: boolean; onClose: () => void; onDone: (message: string) => void;
}) {
  const detail = useRebasingQuery<{ weeks: MarketWeek[]; history: History[]; pending_request: WeekRequest | null }>(`/periods/${periodId}/market-plans/${market.market_id}/workload`);
  const weeks = detail.data?.weeks || [];
  const [draft, setDraft] = useState<number[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targets = draft ?? weeks.map((w) => w.target);
  const total = market.total_outlets;
  const sum = targets.reduce((a, b) => a + b, 0);
  const changed = weeks.some((w, i) => targets[i] !== w.target);
  const step = (i: number, delta: number) => setDraft(targets.map((t, j) => (j === i ? Math.max(0, t + delta) : t)));

  const problem = !weeks.length ? "" : !changed ? "Use + and − to move outlets between weeks."
    : sum !== total ? (sum > total ? `Remove ${sum - total} outlet(s) from a week - the total must stay ${total}.` : `Add ${total - sum} outlet(s) to a week - the total must stay ${total}.`)
      : weeks.some((w, i) => targets[i] < w.minimum) ? "A week cannot go below the outlets it has already covered."
        : reason.trim().length < 5 ? "Give a short reason (at least 5 characters)." : "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rebasingApi<{ applied: boolean }>(`/periods/${periodId}/market-plans/${market.market_id}/week-targets`, { method: "PATCH", body: { targets, reason: reason.trim() } });
      onDone(result.applied ? `${market.market_name}: weeks now ${split(targets)}.` : `${market.market_name}: change sent to your Regional Statistician for approval.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The change could not be saved.");
      setBusy(false);
    }
  };

  return (
    <Sheet title={market.market_name} eyebrow={needsApproval ? "Request a workload change" : "Adjust weekly workload"} busy={busy} onClose={onClose} wide>
      {detail.loading && !weeks.length && <p className="text-sm text-prism-muted">Loading weeks…</p>}
      {detail.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{detail.error}</p>}
      {detail.data?.pending_request && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {`Waiting for the Regional Statistician: ${split(detail.data.pending_request.requested_targets)}. ${needsApproval ? "Sending a new request replaces yours." : "A change you save here replaces it."}`}
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {weeks.map((w, i) => {
            const t = targets[i] ?? 0;
            const moved = t - w.target;
            return (
              <div key={w.week_id} className={clsx("rounded-2xl border p-4", w.editable ? "border-prism-border" : "border-slate-200 bg-slate-50")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-prism-text">{`Week ${w.week_no}`}</p>
                  {!w.editable && <span className="text-[10px] font-black uppercase text-prism-muted">Locked</span>}
                </div>
                <p className="text-[11px] text-prism-muted">{`${formatDay(w.start_date)} – ${formatDay(w.end_date)}`}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button type="button" aria-label={`Fewer outlets in week ${w.week_no}`} disabled={!w.editable || busy || t <= w.minimum} onClick={() => step(i, -1)}
                    className="grid h-10 w-10 place-items-center rounded-full bg-prism-bg text-xl font-black text-prism-purple disabled:opacity-30">−</button>
                  <div className="text-center">
                    <p className="text-3xl font-black text-prism-text">{t}</p>
                    <p className={clsx("text-[11px] font-bold", moved > 0 ? "text-emerald-700" : moved < 0 ? "text-amber-700" : "text-prism-muted")}>{moved ? `${moved > 0 ? "+" : ""}${moved}` : "outlets"}</p>
                  </div>
                  <button type="button" aria-label={`More outlets in week ${w.week_no}`} disabled={!w.editable || busy} onClick={() => step(i, 1)}
                    className="grid h-10 w-10 place-items-center rounded-full bg-prism-bg text-xl font-black text-prism-purple disabled:opacity-30">+</button>
                </div>
                <p className="mt-3 text-[11px] text-prism-muted">{w.editable ? `${w.accounted} already covered · can't go below ${w.minimum}` : "This week is over; its number stays."}</p>
              </div>
            );
          })}
        </div>

        {weeks.length > 0 && (
          <div className={clsx("flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold", sum === total ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
            <span>{`Total ${sum} of ${total} outlets`}</span>
            <span>{sum === total ? "✓ Balanced" : sum > total ? `${sum - total} too many` : `${total - sum} still to place`}</span>
          </div>
        )}

        <label className="block">
          <span className="text-[11px] font-bold text-prism-muted">Reason</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Market day falls in week 2" className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-sm" />
        </label>
        {changed && problem && <p className="text-xs font-semibold text-amber-800">{problem}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {changed && <button type="button" onClick={() => setDraft(null)} disabled={busy} className="rounded-full px-4 py-2.5 text-sm font-semibold text-prism-muted hover:text-prism-text">Undo changes</button>}
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={!!problem || busy} className="rounded-full bg-prism-purple px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Saving…" : needsApproval ? "Send for approval" : "Save weeks"}
          </button>
        </div>
      </form>

      {(detail.data?.history.length ?? 0) > 0 && (
        <div className="mt-6 border-t border-prism-border/60 pt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-prism-muted">Change history</p>
          <ul className="mt-2 space-y-2">
            {detail.data!.history.map((h) => (
              <li key={h.change_id} className="rounded-xl bg-prism-bg/70 px-3 py-2 text-xs">
                <Diff before={h.before_targets} after={h.after_targets} />
                <p className="mt-1 text-prism-text">{`“${h.reason}”`}</p>
                <p className="text-[11px] text-prism-muted">{`${h.changed_by_name}${h.request_id ? " (approved request)" : ""} · ${formatDateTime(h.changed_at)}`}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
