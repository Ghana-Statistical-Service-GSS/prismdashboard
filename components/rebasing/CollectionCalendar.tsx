"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { CloseReadiness, MarketPlan, MetricRow, Period, Week, formatDateTime, formatDay, number, percent, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

// Collection Calendar (Configuration, HQ/Admin): the Market Reading monthly
// cycle. Prepare next month while this month runs, open it once the current
// month is closed, close each week and finally the month.
//   Period: UPCOMING -> OPEN -> CLOSED (no way back)
//   Week:   derived on the server from its dates and whether HQ closed it
// The backend enforces every rule; this page explains and sequences them.

type CloseCheck = CloseReadiness & {
  review_stages?: { pending_supervisor: number; pending_rs: number; pending_hq: number };
  sync?: { stale_hours: number; readers_assigned: number; never_synced: number; stale: number; readers: { user_id: string; full_name: string; market_name: string; last_sync_at: string | null; never_synced: boolean }[] };
};

type OpenPreview = {
  ready: boolean;
  weeks: Week[];
  frame: { markets: number; markets_without_outlets: number; outlets: number; products: number; markets_without_readers: number; readers_assigned: number } | null;
  blockers: { check: string; message: string }[];
  warnings: { check: string; message: string }[];
};

type DateRange = { startDate: string; endDate: string };

// ---------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
};
const todayIso = () => toIso(new Date());
// Market Reading's first month; the server's REBASING_FIRST_MONTH default.
const FIRST_REBASING_MONTH = "2026-09";
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const nameOf = (p: Period) => monthLabel(p.observation_month.slice(0, 7));
const dayCount = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;

// Three consecutive 7-day weeks from the first Monday, or from today when that
// has passed (a late month) — same rule as the server.
function suggestNormalWeeks(month: string): DateRange[] {
  const offset = (8 - new Date(`${month}-01T00:00:00Z`).getUTCDay()) % 7;
  const firstMonday = addDays(`${month}-01`, offset);
  const start = firstMonday < todayIso() ? todayIso() : firstMonday;
  return [0, 1, 2].map((i) => ({ startDate: addDays(start, i * 7), endDate: addDays(start, i * 7 + 6) }));
}
function suggestBackfillWindow(month: string): DateRange[] {
  const start = todayIso() < `${month}-01` ? `${month}-01` : todayIso();
  return [{ startDate: start, endDate: addDays(start, 13) }];
}

// Mirrors the server's week rules.
function validateWeeks(type: Period["period_type"], month: string, weeks: DateRange[]) {
  if (!month) return "Choose the observation month.";
  for (const [i, w] of weeks.entries()) {
    const name = type === "NORMAL" ? `Week ${i + 1}` : "The catch-up window";
    if (!w.startDate || !w.endDate) return `${name} needs a start and end date.`;
    if (w.endDate < w.startDate) return `${name} ends before it starts.`;
  }
  if (weeks[0].startDate < `${month}-01`) return "Collection cannot start before the observation month begins.";
  for (let i = 1; i < weeks.length; i += 1) {
    if (weeks[i].startDate <= weeks[i - 1].endDate) return `Week ${i + 1} must start after week ${i} ends.`;
  }
  return "";
}

// ---------------------------------------------------------------- page body

export function CollectionCalendar() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [version, setVersion] = useState(0);
  const [creatingNext, setCreatingNext] = useState(false);
  const [special, setSpecial] = useState(false);
  const [error, setError] = useState("");
  const list = useRebasingQuery<{ periods: Period[] }>("/periods", version);
  const periods = useMemo(() => list.data?.periods || [], [list.data]);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    loadDashboardUser().then(setUser).catch(() => {});
  }, []);

  const byMonth = (a: Period, b: Period) => a.observation_month.localeCompare(b.observation_month);
  const current = periods.find((p) => p.period_type === "NORMAL" && p.status === "OPEN") || null;
  const upcoming = periods.filter((p) => p.period_type === "NORMAL" && p.status === "UPCOMING").sort(byMonth);
  const backfills = periods.filter((p) => p.period_type === "BACKFILL" && p.status !== "CLOSED").sort(byMonth);
  const closed = periods.filter((p) => p.status === "CLOSED").sort((a, b) => byMonth(b, a));
  const latestNormal = periods.filter((p) => p.period_type === "NORMAL").sort(byMonth).at(-1) || null;
  // Same rule as the server: after the latest current month (or the first
  // rebasing month if there is none), skipping months held by a backfill.
  const monthAfter = (month: string) => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };
  const existingMonths = new Set(periods.filter((p) => p.period_type === "BACKFILL").map((p) => p.observation_month.slice(0, 7)));
  let nextMonth = latestNormal ? monthAfter(latestNormal.observation_month.slice(0, 7)) : FIRST_REBASING_MONTH;
  for (let guard = 0; guard < 24 && existingMonths.has(nextMonth); guard += 1) nextMonth = monthAfter(nextMonth);
  const isHq = user?.role === "HQ" || user?.role === "ADMIN";

  const createNext = async () => {
    setCreatingNext(true);
    setError("");
    try {
      await rebasingApi("/periods/next", { method: "POST", body: {} });
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The next month could not be created.");
    } finally {
      setCreatingNext(false);
    }
  };

  if (user && !isHq) {
    return <Notice tone="muted" title="HQ and Admin only">The collection calendar is managed by HQ.</Notice>;
  }

  return (
    <>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Configuration · Market Reading</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:text-3xl md:text-4xl">Collection Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm text-prism-muted">
            Set up each month&apos;s collection and its three weeks. Prepare next month while this month runs; it opens once the current month is closed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSpecial((v) => !v)}>{special ? "Cancel special month" : "Backfill or special month"}</Button>
          {upcoming.length === 0 && (
            <Button variant="primary" busy={creatingNext} onClick={() => void createNext()}>
              {`Create ${monthLabel(nextMonth)}`}
            </Button>
          )}
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {list.error && <Notice tone="error">{list.error}</Notice>}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Current month" value={current ? nameOf(current) : "None open"} tone={current ? "purple" : "muted"} />
        <Tile label="Next month" value={upcoming[0] ? nameOf(upcoming[0]) : "Not prepared"} tone={upcoming[0] ? "teal" : "muted"} />
        <Tile label="Backfill" value={backfills.length ? backfills.map(nameOf).join(", ") : "None"} tone={backfills.length ? "amber" : "muted"} />
        <Tile label="Closed months" value={String(closed.length)} tone="muted" />
      </dl>

      {special && (
        <div className="mt-6">
          <SpecialPeriodForm existingMonths={new Set(periods.map((p) => p.observation_month.slice(0, 7)))} onCancel={() => setSpecial(false)} onCreated={() => { setSpecial(false); refresh(); }} />
        </div>
      )}

      {list.loading && !list.data && <Notice tone="muted">Loading the collection calendar…</Notice>}

      {list.data && (
        <div className="mt-8 space-y-10">
          <Section title="Current collection" hint="The month readers are collecting now.">
            {current
              ? <OpenPeriodCard period={current} onChanged={refresh} />
              : <EmptyCard title="No month is open">{upcoming.length ? "Open the prepared month below to start collection." : `Create ${monthLabel(nextMonth)}, check its dates, then open it.`}</EmptyCard>}
          </Section>

          <Section title="Next collection" hint="Prepared while the current month runs. Readers do not see it until it is opened.">
            {upcoming.length
              ? upcoming.map((p) => <UpcomingPeriodCard key={p.period_id} period={p} waitingFor={current} onChanged={refresh} />)
              : <EmptyCard title="Nothing prepared yet" action={<Button variant="primary" busy={creatingNext} onClick={() => void createNext()}>{`Create ${monthLabel(nextMonth)}`}</Button>}>
                  The next month is created with three suggested weeks you can adjust.
                </EmptyCard>}
          </Section>

          {backfills.length > 0 && (
            <Section title="Backfill" hint="Missed months collected late. They stay their own statistical month and run alongside the current one.">
              {backfills.map((p) => (p.status === "OPEN"
                ? <OpenPeriodCard key={p.period_id} period={p} onChanged={refresh} />
                : <UpcomingPeriodCard key={p.period_id} period={p} waitingFor={null} onChanged={refresh} />))}
            </Section>
          )}

          {closed.length > 0 && <ClosedMonths periods={closed} />}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- building blocks

function Button({ variant, busy = false, disabled = false, onClick, children, type = "button", title }: {
  variant: "primary" | "secondary" | "ghost" | "danger" | "success";
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles = {
    primary: "bg-prism-purple text-white hover:brightness-110",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    secondary: "border border-prism-border bg-white text-prism-text hover:bg-prism-bg",
    ghost: "text-prism-purple hover:bg-prism-purple/10",
  }[variant];
  return (
    <button type={type} title={title} disabled={disabled || busy} onClick={onClick} className={clsx("inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40", styles)}>
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

function Notice({ tone, title, children }: { tone: "error" | "success" | "muted" | "warning"; title?: string; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    muted: "border-prism-border bg-white text-prism-muted",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("mt-4 rounded-2xl border px-4 py-3 text-xs", styles)}>
      {title && <p className="mb-0.5 font-black">{title}</p>}
      {children}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: "purple" | "teal" | "amber" | "muted" }) {
  const dot = { purple: "bg-prism-purple", teal: "bg-prism-teal", amber: "bg-amber-500", muted: "bg-prism-border" }[tone];
  return (
    <div className="rounded-2xl border border-prism-border/70 bg-white px-4 py-3 shadow-sm">
      <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-prism-muted"><span className={clsx("h-2 w-2 rounded-full", dot)} />{label}</dt>
      <dd className={clsx("mt-1 truncate text-sm font-black", tone === "muted" ? "text-prism-muted" : "text-prism-text")}>{value}</dd>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-black text-prism-text">{title}</h2>
        <p className="text-xs text-prism-muted">{hint}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function EmptyCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-prism-border bg-white/70 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-prism-text">{title}</p>
        <p className="mt-0.5 text-xs text-prism-muted">{children}</p>
      </div>
      {action}
    </div>
  );
}

function Chip({ tone, children }: { tone: "purple" | "teal" | "amber" | "green" | "slate"; children: ReactNode }) {
  const styles = {
    purple: "bg-prism-purple/10 text-prism-purple",
    teal: "bg-prism-teal/15 text-teal-800",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    slate: "bg-slate-100 text-prism-muted",
  }[tone];
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.06em]", styles)}>{children}</span>;
}

function PeriodChips({ period }: { period: Period }) {
  return (
    <>
      <Chip tone={period.period_type === "BACKFILL" ? "amber" : "teal"}>{period.period_type === "BACKFILL" ? "Backfill" : "Current"}</Chip>
      <Chip tone={period.status === "OPEN" ? "green" : "slate"}>{period.status === "OPEN" ? "Open" : period.status === "UPCOMING" ? "Upcoming" : "Closed"}</Chip>
      {period.reference_fix_open && <Chip tone="amber">Reference fixes open</Chip>}
    </>
  );
}

function Card({ period, meta, children, footer }: { period: Period; meta: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <article className={clsx("overflow-hidden rounded-3xl border bg-white shadow-sm", period.period_type === "BACKFILL" ? "border-amber-200" : "border-prism-border/70")}>
      <div className="flex flex-col gap-1 px-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-1 text-xl font-black tracking-tight text-prism-text">{nameOf(period)}</h3>
          <PeriodChips period={period} />
        </div>
        <p className="text-xs text-prism-muted">{meta}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      <div className="flex flex-col gap-2 border-t border-prism-border/60 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">{footer}</div>
    </article>
  );
}

// Status of a week, derived on the server.
const WEEK_STATE: Record<Week["effective_status"], { label: string; dot: string; text: string; bar: string }> = {
  ACTIVE: { label: "Active", dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500" },
  ENDED: { label: "Ended · not closed", dot: "bg-amber-500", text: "text-amber-700", bar: "bg-amber-400" },
  CLOSED: { label: "Closed", dot: "bg-slate-500", text: "text-prism-text", bar: "bg-slate-400" },
  NOT_STARTED: { label: "Upcoming", dot: "bg-slate-300", text: "text-prism-muted", bar: "bg-slate-200" },
  NOT_OPEN: { label: "Upcoming", dot: "bg-slate-300", text: "text-prism-muted", bar: "bg-slate-200" },
};

// How far through its dates a week is (0-100), for the timeline bar.
function elapsed(week: Week) {
  if (week.status === "CLOSED") return 100;
  const today = todayIso();
  if (today < week.start_date) return 0;
  if (today > week.end_date) return 100;
  return Math.round((dayCount(week.start_date, today) / dayCount(week.start_date, week.end_date)) * 100);
}

// ---------------------------------------------------------------- OPEN month

function OpenPeriodCard({ period, onChanged }: { period: Period; onChanged: () => void }) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const detail = useRebasingQuery<{ weeks: Week[] }>(`/periods/${period.period_id}`, version);
  const metrics = useRebasingQuery<{ rows: MetricRow[] }>(`/progress?periodId=${period.period_id}&groupBy=national`, version);
  const weeks = detail.data?.weeks || [];
  const totals = metrics.data?.rows[0];
  const active = weeks.find((w) => w.effective_status === "ACTIVE");
  const endedOpen = weeks.filter((w) => w.effective_status === "ENDED").length;

  const run = async (key: string, action: () => Promise<string | void>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const message = await action();
      if (message) setNotice(message);
      setVersion((v) => v + 1);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The action could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      period={period}
      meta={<>
        {active ? `${active.week_type === "CATCH_UP" ? "Catch-up window" : `Week ${active.week_no}`} is active` : "No week is active today"}
        {` · ${number.format(period.market_plan_count)} markets · ${number.format(period.total_outlets)} outlets`}
      </>}
      footer={<>
        <div className="flex flex-wrap gap-1">
          <Link href={`/dashboard/market-reading`} className="rounded-full px-3 py-2 text-xs font-bold text-prism-purple hover:bg-prism-purple/10">View progress</Link>
          <Button variant="ghost" onClick={() => setShowPlans((v) => !v)}>{showPlans ? "Hide market targets" : "Market targets"}</Button>
          <Button variant="ghost" disabled={!!busy} onClick={() => setDeleting(true)}>Delete month…</Button>
        </div>
        <Button variant="primary" disabled={!!busy} onClick={() => setClosing(true)}>Close month…</Button>
      </>}
    >
      {notice && <Notice tone="success">{notice}</Notice>}
      {(error || detail.error) && <Notice tone="error">{error || detail.error}</Notice>}
      {endedOpen > 0 && <Notice tone="warning">{`${endedOpen} ${endedOpen === 1 ? "week has" : "weeks have"} ended but ${endedOpen === 1 ? "is" : "are"} not closed. Close ${endedOpen === 1 ? "it" : "them"} when the fieldwork is done.`}</Notice>}

      <WeekTimeline period={period} weeks={weeks} loading={detail.loading} busy={busy} run={run} />

      {totals && (
        <dl className="mt-5 grid grid-cols-3 divide-x divide-prism-border/60 rounded-2xl border border-prism-border/60">
          <Stat label="Outlets accounted for" value={`${percent(totals.accounted_outlets, totals.operational_workload).toFixed(0)}%`} />
          <Stat label="Final-approved prices" value={number.format(totals.final_approved)} />
          <Stat label="Waiting for review" value={number.format(totals.pending_supervisor + totals.pending_rs + totals.pending_hq)} />
        </dl>
      )}

      {showPlans && <div className="mt-5"><MarketPlans period={period} /></div>}
      {closing && <CloseWizard period={period} onClose={() => setClosing(false)} onClosed={() => { setClosing(false); onChanged(); }} />}
      {deleting && <DeleteDialog period={period} onClose={() => setDeleting(false)} onDeleted={() => { setDeleting(false); onChanged(); }} />}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 sm:px-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-prism-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-black text-prism-text sm:text-xl">{value}</dd>
    </div>
  );
}

function WeekTimeline({ period, weeks, loading, busy, run }: {
  period: Period;
  weeks: Week[];
  loading: boolean;
  busy: string | null;
  run: (key: string, action: () => Promise<string | void>) => Promise<void>;
}) {
  if (loading && !weeks.length) return <p className="text-xs text-prism-muted">Loading weeks…</p>;
  return (
    <ol className={clsx("grid gap-3", weeks.length > 1 ? "md:grid-cols-3" : "md:max-w-md")}>
      {weeks.map((week) => <WeekSegment key={week.week_id} period={period} week={week} busy={busy} run={run} />)}
    </ol>
  );
}

function WeekSegment({ period, week, busy, run }: {
  period: Period;
  week: Week;
  busy: string | null;
  run: (key: string, action: () => Promise<string | void>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(week.start_date);
  const [end, setEnd] = useState(week.end_date);
  const state = WEEK_STATE[week.effective_status];
  const name = week.week_type === "CATCH_UP" ? "Catch-up window" : `Week ${week.week_no}`;
  const editable = period.status === "OPEN" && week.status !== "CLOSED";
  const problem = !start || !end ? "Both dates are required." : end < start ? "The end date is before the start date." : "";

  const save = () => run(`week-${week.week_id}`, async () => {
    await rebasingApi(`/periods/${period.period_id}/weeks/${week.week_id}`, { method: "PATCH", body: { startDate: start, endDate: end } });
    setEditing(false);
    return `${name} now runs ${formatDay(start)} – ${formatDay(end)}.`;
  });

  const closeWeek = () => {
    if (!window.confirm(`Close ${name} of ${nameOf(period)}?\n\nReaders can no longer submit work for it - prices captured offline for it will be refused at sync. This cannot be undone.`)) return;
    void run(`close-${week.week_id}`, async () => {
      await rebasingApi(`/periods/${period.period_id}/weeks/${week.week_id}/close`, { method: "POST", body: {} });
      return `${name} is closed.`;
    });
  };

  return (
    <li className={clsx("rounded-2xl border p-4", week.effective_status === "ACTIVE" ? "border-emerald-300 bg-emerald-50/40" : "border-prism-border/70 bg-white")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-prism-text">{name}</p>
        <span className={clsx("flex items-center gap-1.5 text-[11px] font-bold", state.text)}><span className={clsx("h-2 w-2 rounded-full", state.dot)} />{state.label}</span>
      </div>
      {!editing ? (
        <>
          <p className="mt-1 text-xs text-prism-muted">{formatDay(week.start_date)} – {formatDay(week.end_date)} · {dayCount(week.start_date, week.end_date)} days</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={clsx("h-full rounded-full", state.bar)} style={{ width: `${elapsed(week)}%` }} /></div>
          {editable && (
            <div className="mt-3 flex gap-1">
              <button type="button" disabled={!!busy} onClick={() => { setStart(week.start_date); setEnd(week.end_date); setEditing(true); }} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-prism-purple hover:bg-prism-purple/10 disabled:opacity-40">Edit dates</button>
              <button type="button" disabled={!!busy} onClick={closeWeek} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                {busy === `close-${week.week_id}` ? "Closing…" : "Close week"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <DateField label="Starts" value={start} onChange={setStart} />
          <DateField label="Ends" value={end} onChange={setEnd} />
          {problem && <p className="text-[11px] text-red-700">{problem}</p>}
          <div className="flex justify-end gap-1 pt-1">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" disabled={!!problem} busy={busy === `week-${week.week_id}`} onClick={() => void save()}>Save</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] font-bold text-prism-muted">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-prism-border bg-white px-2.5 py-2 text-xs text-prism-text focus:border-prism-purple focus:outline-none focus:ring-2 focus:ring-prism-purple/20" />
    </label>
  );
}

// ---------------------------------------------------------------- UPCOMING month

function UpcomingPeriodCard({ period, waitingFor, onChanged }: { period: Period; waitingFor: Period | null; onChanged: () => void }) {
  const [version, setVersion] = useState(0);
  const detail = useRebasingQuery<{ weeks: Week[] }>(`/periods/${period.period_id}`, version);
  const weeks = useMemo(() => detail.data?.weeks || [], [detail.data]);
  const [draft, setDraft] = useState<DateRange[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const month = period.observation_month.slice(0, 7);
  const type = period.period_type;

  const dates = draft ?? weeks.map((w) => ({ startDate: w.start_date, endDate: w.end_date }));
  const dirty = draft !== null && draft.some((d, i) => d.startDate !== weeks[i]?.start_date || d.endDate !== weeks[i]?.end_date);
  const problem = weeks.length && dates.length === weeks.length ? validateWeeks(type, month, dates) : "";
  const blocked = type === "NORMAL" && waitingFor && waitingFor.period_id !== period.period_id ? waitingFor : null;

  const setDate = (index: number, field: keyof DateRange, value: string) =>
    setDraft(dates.map((d, i) => (i === index ? { ...d, [field]: value } : d)));

  // Weeks may not overlap at any moment: moves later save from the last week
  // backwards, moves earlier from the first forwards; a conflict is retried.
  const save = async () => {
    if (problem || !dirty) return;
    setBusy(true);
    setError("");
    setNotice("");
    const changed = weeks.map((week, i) => ({ week, next: dates[i] })).filter(({ week, next }) => next.startDate !== week.start_date || next.endDate !== week.end_date);
    const ordered = dates[0].startDate >= weeks[0].start_date ? [...changed].reverse() : changed;
    const patch = ({ week, next }: { week: Week; next: DateRange }) =>
      rebasingApi(`/periods/${period.period_id}/weeks/${week.week_id}`, { method: "PATCH", body: next });
    try {
      const retry: typeof ordered = [];
      for (const item of ordered) {
        try { await patch(item); } catch { retry.push(item); }
      }
      for (const item of retry.reverse()) await patch(item);
      setDraft(null);
      setNotice("Dates saved.");
      setVersion((v) => v + 1);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The dates could not be saved.");
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      period={period}
      meta={type === "BACKFILL" ? "One catch-up window · readers choose this month per outlet while it is open" : "Three collection weeks · weekly targets are set when it opens"}
      footer={<>
        <p className={clsx("text-xs font-semibold", blocked ? "text-prism-muted" : dirty ? "text-amber-700" : "text-emerald-700")}>
          {blocked ? `Waiting for ${nameOf(blocked)} to close before opening.` : dirty ? "Save the dates before opening." : "Ready to open."}
        </p>
        <Button variant="success" disabled={!!blocked || dirty || busy} onClick={() => setOpening(true)}>Open collection…</Button>
      </>}
    >
      {notice && <Notice tone="success">{notice}</Notice>}
      {(error || detail.error) && <Notice tone="error">{error || detail.error}</Notice>}

      <div className={clsx("grid gap-3", dates.length > 1 ? "md:grid-cols-3" : "md:max-w-md")}>
        {dates.map((d, i) => (
          <div key={weeks[i]?.week_id ?? i} className="rounded-2xl border border-prism-border/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-prism-text">{type === "NORMAL" ? `Week ${i + 1}` : "Catch-up window"}</p>
              {d.startDate && d.endDate && d.endDate >= d.startDate && <span className="text-[11px] text-prism-muted">{dayCount(d.startDate, d.endDate)} days</span>}
            </div>
            <div className="mt-3 space-y-2">
              <DateField label="Starts" value={d.startDate} onChange={(v) => setDate(i, "startDate", v)} />
              <DateField label="Ends" value={d.endDate} onChange={(v) => setDate(i, "endDate", v)} />
            </div>
          </div>
        ))}
        {detail.loading && !weeks.length && <p className="text-xs text-prism-muted">Loading weeks…</p>}
      </div>
      {problem && <p className="mt-3 text-xs font-semibold text-red-700">{problem}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setDraft(type === "NORMAL" ? suggestNormalWeeks(month) : suggestBackfillWindow(month))}>Suggest dates</Button>
        {dirty && <Button variant="ghost" onClick={() => setDraft(null)}>Undo changes</Button>}
        <Button variant="ghost" disabled={busy} onClick={() => setChangingType(true)}>{type === "BACKFILL" ? "Make current month…" : "Make backfill…"}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setDeleting(true)}>Delete…</Button>
        <span className="flex-1" />
        <Button variant="secondary" disabled={!dirty || !!problem} busy={busy} onClick={() => void save()}>Save dates</Button>
      </div>

      {opening && <OpenWizard period={period} onClose={() => setOpening(false)} onOpened={() => { setOpening(false); onChanged(); }} />}
      {changingType && <ChangeTypeDialog period={period} onClose={() => setChangingType(false)} onChanged={() => { setChangingType(false); setDraft(null); setVersion((v) => v + 1); onChanged(); }} />}
      {deleting && <DeleteDialog period={period} onClose={() => setDeleting(false)} onDeleted={() => { setDeleting(false); onChanged(); }} />}
    </Card>
  );
}

// ---------------------------------------------------------------- dialogs

function Dialog({ eyebrow, title, onClose, busy, children }: { eyebrow: string; title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-prism-border/60 px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-teal">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black text-prism-text">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted hover:text-prism-text disabled:opacity-40">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </section>
    </div>
  );
}

// Switch an UPCOMING month between a current month (three weeks) and a
// backfill (one catch-up window); the server replaces its weeks.
function ChangeTypeDialog({ period, onClose, onChanged }: { period: Period; onClose: () => void; onChanged: () => void }) {
  const toNormal = period.period_type === "BACKFILL";
  const month = period.observation_month.slice(0, 7);
  const [weeks, setWeeks] = useState<DateRange[]>(() => (toNormal ? suggestNormalWeeks(month) : suggestBackfillWindow(month)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = validateWeeks(toNormal ? "NORMAL" : "BACKFILL", month, weeks);
  const setWeek = (index: number, field: keyof DateRange, value: string) => setWeeks((current) => current.map((w, i) => (i === index ? { ...w, [field]: value } : w)));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await rebasingApi(`/periods/${period.period_id}`, {
        method: "PATCH",
        body: { periodType: toNormal ? "NORMAL" : "BACKFILL", weeks: weeks.map((w, i) => ({ weekNo: i + 1, ...w })) },
      });
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The month could not be changed.");
      setBusy(false);
    }
  };

  return (
    <Dialog eyebrow="Edit month" title={toNormal ? `Make ${nameOf(period)} a current month` : `Make ${nameOf(period)} a backfill`} onClose={onClose} busy={busy}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-prism-muted">
          {toNormal
            ? "A current month has three collection weeks with weekly targets. Only one current month can be open at a time."
            : "A backfill has one catch-up window. Readers choose it per outlet alongside the current month."}
          {" Its existing dates are replaced by these."}
        </p>
        <div className="grid gap-3">
          {weeks.map((w, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-end gap-2">
              <p className="pb-2 text-xs font-black text-prism-text">{toNormal ? `Week ${i + 1}` : "Window"}</p>
              <DateField label="Starts" value={w.startDate} onChange={(v) => setWeek(i, "startDate", v)} />
              <DateField label="Ends" value={w.endDate} onChange={(v) => setWeek(i, "endDate", v)} />
            </div>
          ))}
        </div>
        {problem && <p className="text-xs font-semibold text-red-700">{problem}</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!!problem} busy={busy} onClick={() => void submit()}>{toNormal ? "Make current month" : "Make backfill"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

// Delete a month created or opened by mistake. The server refuses once any
// field data exists, and never deletes a closed month; each deletion is logged.
function DeleteDialog({ period, onClose, onDeleted }: { period: Period; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = period.status === "OPEN";
  const tooShort = reason.trim().length < 5;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (tooShort) return;
    setBusy(true);
    setError("");
    try {
      await rebasingApi(`/periods/${period.period_id}/delete`, { method: "POST", body: { reason: reason.trim() } });
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The month could not be deleted.");
      setBusy(false);
    }
  };

  return (
    <Dialog eyebrow="Delete month" title={`Delete ${nameOf(period)}?`} onClose={onClose} busy={busy}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-xs leading-relaxed text-prism-muted">
          {open
            ? "Only possible while no outlet visit, price or other field data has been recorded. Its outlet lists, targets and reader assignments are removed. Readers who already synced it will see it disappear after their next sync."
            : "Its weeks and reader assignments are removed. You can create the month again afterwards."}
        </p>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-prism-muted">Reason (kept in the audit log)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Opened the wrong month by mistake"
            className="mt-1 w-full rounded-2xl border border-prism-border px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple" />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={tooShort} busy={busy}>{`Delete ${nameOf(period)}`}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function CheckItem({ state, children }: { state: "ok" | "warn" | "fail"; children: ReactNode }) {
  const icon = { ok: ["✓", "bg-emerald-500"], warn: ["!", "bg-amber-500"], fail: ["×", "bg-rose-500"] }[state];
  return (
    <li className="flex items-start gap-2.5 text-xs leading-relaxed">
      <span className={clsx("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black text-white", icon[1])} aria-hidden="true">{icon[0]}</span>
      <span className="text-prism-text">{children}</span>
    </li>
  );
}

function CheckGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-prism-muted">{title}</p>
      <ul className="mt-2 space-y-2">{children}</ul>
    </div>
  );
}

function OpenWizard({ period, onClose, onOpened }: { period: Period; onClose: () => void; onOpened: () => void }) {
  const preview = useRebasingQuery<OpenPreview>(`/periods/${period.period_id}/open-preview`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = preview.data;
  const backfill = period.period_type === "BACKFILL";

  const open = async () => {
    setBusy(true);
    setError("");
    try {
      await rebasingApi(`/periods/${period.period_id}/open`, { method: "POST", body: {} });
      onOpened();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The month could not be opened.");
      setBusy(false);
    }
  };

  return (
    <Dialog eyebrow={backfill ? "Open backfill" : "Open collection"} title={`Open ${nameOf(period)}`} onClose={onClose} busy={busy}>
      {preview.loading && !data && <p className="text-xs text-prism-muted">Checking what opening would set up…</p>}
      {preview.error && <Notice tone="error">{preview.error}</Notice>}
      {data && (
        <div className="space-y-5">
          <CheckGroup title={backfill ? "Catch-up window" : "Weeks"}>
            {data.weeks.map((w) => <CheckItem key={w.week_id} state="ok">{`${w.week_type === "CATCH_UP" ? "Catch-up" : `Week ${w.week_no}`}: ${formatDay(w.start_date)} – ${formatDay(w.end_date)}`}</CheckItem>)}
          </CheckGroup>
          {data.frame && (
            <CheckGroup title="Collection frame (from cleaned initiation data)">
              <CheckItem state="ok">{`${number.format(data.frame.markets)} markets${data.frame.markets_without_outlets ? `, ${data.frame.markets_without_outlets} with no eligible outlets` : ""}`}</CheckItem>
              <CheckItem state={data.frame.outlets > 0 ? "ok" : "fail"}>{`${number.format(data.frame.outlets)} outlets`}</CheckItem>
              <CheckItem state={data.frame.products > 0 ? "ok" : "fail"}>{`${number.format(data.frame.products)} expected products`}</CheckItem>
            </CheckGroup>
          )}
          {data.frame && (
            <CheckGroup title="Readers">
              <CheckItem state={data.frame.markets_without_readers === 0 ? "ok" : "warn"}>
                {data.frame.markets_without_readers === 0
                  ? `${number.format(data.frame.readers_assigned)} readers assigned to every market`
                  : `${data.frame.markets_without_readers} markets have no reader yet (${number.format(data.frame.readers_assigned)} readers assigned). Those markets cannot collect until readers are assigned.`}
              </CheckItem>
            </CheckGroup>
          )}
          {(data.blockers.length > 0 || data.warnings.some((w) => w.check !== "assignments")) && (
            <CheckGroup title="Before opening">
              {data.blockers.map((b) => <CheckItem key={b.check} state="fail">{b.message}</CheckItem>)}
              {data.warnings.filter((w) => w.check !== "assignments").map((w) => <CheckItem key={w.check} state="warn">{w.message}</CheckItem>)}
            </CheckGroup>
          )}
          <p className="rounded-2xl bg-prism-bg/70 p-3 text-[11px] leading-relaxed text-prism-text">
            Opening sets up every market&apos;s outlet list{backfill ? "" : " and weekly targets"} in one step and cannot be undone. Assigned readers see {nameOf(period)} after their next sync.
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button variant="success" disabled={!data.ready} busy={busy} onClick={() => void open()}>{busy ? "Opening…" : `Open ${nameOf(period)}`}</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function CloseWizard({ period, onClose, onClosed }: { period: Period; onClose: () => void; onClosed: () => void }) {
  const check = useRebasingQuery<CloseCheck>(`/periods/${period.period_id}/close-check`);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = check.data;
  const blocked = (key: string) => data?.blockers.find((b) => b.check === key)?.count ?? 0;
  const stages = data?.review_stages;
  const sync = data?.sync;
  const name = nameOf(period);
  const syncRisk = sync ? sync.stale + sync.never_synced : 0;

  const close = async () => {
    setBusy(true);
    setError("");
    try {
      await rebasingApi(`/periods/${period.period_id}/close`, { method: "POST", body: {} });
      onClosed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The month could not be closed.");
      setBusy(false);
    }
  };

  return (
    <Dialog eyebrow={`Close month · step ${step} of 2`} title={step === 1 ? `Is ${name} ready to close?` : `Close ${name}?`} onClose={onClose} busy={busy}>
      {check.loading && !data && <p className="text-xs text-prism-muted">Checking…</p>}
      {check.error && <Notice tone="error">{check.error}</Notice>}
      {data && step === 1 && (
        <div className="space-y-5">
          <CheckGroup title="Collection">
            <CheckItem state={blocked("weeks_not_closed") ? "fail" : "ok"}>{blocked("weeks_not_closed") ? `${blocked("weeks_not_closed")} week(s) still open - close them on the month card` : "All weeks closed"}</CheckItem>
          </CheckGroup>
          <CheckGroup title="Fieldwork">
            <CheckItem state={blocked("products_unresolved") ? "fail" : "ok"}>
              {blocked("products_unresolved")
                ? <>{`${number.format(blocked("products_unresolved"))} expected products not priced, not available or recorded as not collected. `}<Link href="/market-reading/workload?view=unfinished" className="font-bold text-prism-purple underline">Record what could not be collected</Link></>
                : "Every expected product resolved"}
            </CheckItem>
            <CheckItem state={blocked("carryovers_pending_review") || blocked("carryovers_unresolved") ? "fail" : "ok"}>
              {blocked("carryovers_pending_review") || blocked("carryovers_unresolved")
                ? `Carry-forwards: ${blocked("carryovers_pending_review")} awaiting review, ${blocked("carryovers_unresolved")} approved but not done`
                : "Carry-forwards resolved"}
            </CheckItem>
          </CheckGroup>
          {data.flags && (
            <CheckGroup title="Price reviews (reported, never blocking)">
              {(() => {
                const f = data.flags!;
                const waiting = f.pending_supervisor + f.pending_rs + f.pending_hq;
                return (
                  <>
                    <CheckItem state={waiting ? "warn" : "ok"}>
                      {waiting
                        ? `${number.format(waiting)} prices not fully reviewed: ${number.format(f.pending_supervisor)} with Supervisors, ${number.format(f.pending_rs)} with Regional Statisticians, ${number.format(f.pending_hq)} with HQ. Reviewers can keep working; whatever is still pending is approved automatically when the next month opens.`
                        : "Every price reviewed"}
                    </CheckItem>
                    <CheckItem state={f.rejected_not_corrected ? "warn" : "ok"}>
                      {f.rejected_not_corrected
                        ? `${number.format(f.rejected_not_corrected)} rejected prices were never corrected. They are not approved; the next month uses the previous reference for those products.`
                        : "No uncorrected rejections"}
                    </CheckItem>
                    {f.by_market.length > 0 && (
                      <li className="max-h-36 overflow-y-auto rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                        {f.by_market.map((m) => (
                          <p key={m.market_id}>{`${m.market_name} (${m.region_name}): Supervisor ${m.pending_supervisor} · RS ${m.pending_rs} · HQ ${m.pending_hq} · rejected ${m.rejected}`}</p>
                        ))}
                      </li>
                    )}
                  </>
                );
              })()}
            </CheckGroup>
          )}
          {!data.flags && stages && (
            <CheckGroup title="Price reviews">
              <CheckItem state={stages.pending_supervisor + stages.pending_rs + stages.pending_hq ? "warn" : "ok"}>{`${number.format(stages.pending_supervisor + stages.pending_rs + stages.pending_hq)} prices waiting for review`}</CheckItem>
            </CheckGroup>
          )}
          {sync && (
            <CheckGroup title="Phones (a warning only - the server cannot see offline work)">
              <CheckItem state={syncRisk ? "warn" : "ok"}>
                {syncRisk
                  ? `${syncRisk} of ${sync.readers_assigned} readers have not synced in the last ${sync.stale_hours} hours`
                  : `All ${sync.readers_assigned} readers synced in the last ${sync.stale_hours} hours`}
              </CheckItem>
              {sync.readers.length > 0 && (
                <li className="max-h-32 overflow-y-auto rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                  {sync.readers.map((r) => <p key={r.user_id}>{r.full_name} · {r.market_name} · {r.last_sync_at ? `last sync ${formatDateTime(r.last_sync_at)}` : "never synced"}</p>)}
                </li>
              )}
            </CheckGroup>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Not yet</Button>
            <Button variant="primary" disabled={!data.ready} title={data.ready ? "" : "Every item marked × must be resolved first"} onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}
      {data && step === 2 && (
        <div className="space-y-4">
          <ul className="space-y-2 text-xs text-prism-text">
            <CheckItem state="ok">{`Readers can no longer submit ${name} data.`}</CheckItem>
            <CheckItem state="ok">{`${name} becomes read-only and leaves readers' phones after their next sync.`}</CheckItem>
            <CheckItem state="ok">Reviewers can still finish its prices; anything not reviewed when the next month opens is approved automatically and marked as such.</CheckItem>
            <CheckItem state="ok">Its approved prices become the reference for the following month.</CheckItem>
            {period.period_type === "NORMAL" && <CheckItem state="ok">The next month can then be opened.</CheckItem>}
          </ul>
          {syncRisk > 0 && <Notice tone="warning">{`${syncRisk} reader(s) have not synced recently. Anything still on their phones for ${name} can no longer be sent once it is closed.`}</Notice>}
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">This cannot be reversed.</p>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy} onClick={() => setStep(1)}>Back</Button>
            <Button variant="danger" busy={busy} onClick={() => void close()}>{`Close ${name}`}</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- closed & special

function ClosedMonths({ periods }: { periods: Period[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between rounded-2xl px-1 py-1 text-left">
        <span>
          <span className="block text-base font-black text-prism-text">Closed months</span>
          <span className="text-xs text-prism-muted">{periods.length} closed · read-only</span>
        </span>
        <span className="text-xs font-bold text-prism-purple">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-3 divide-y divide-prism-border/60 overflow-hidden rounded-3xl border border-prism-border/70 bg-white">
          {periods.map((p) => (
            <li key={p.period_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="flex items-center gap-2 text-sm font-bold text-prism-text">{nameOf(p)} <Chip tone={p.period_type === "BACKFILL" ? "amber" : "teal"}>{p.period_type === "BACKFILL" ? "Backfill" : "Current"}</Chip></span>
              <span className="text-xs text-prism-muted">{number.format(p.market_plan_count)} markets · {number.format(p.total_outlets)} outlets</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A backfill month, or any month and type with explicit dates.
function SpecialPeriodForm({ existingMonths, onCancel, onCreated }: { existingMonths: Set<string>; onCancel: () => void; onCreated: () => void }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [type, setType] = useState<Period["period_type"]>("BACKFILL");
  const [weeks, setWeeks] = useState<DateRange[]>(() => suggestBackfillWindow(todayIso().slice(0, 7)));
  const [periodNumber, setPeriodNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refill = (nextType: Period["period_type"], nextMonth: string) => setWeeks(nextType === "NORMAL" ? suggestNormalWeeks(nextMonth) : suggestBackfillWindow(nextMonth));
  const setWeek = (index: number, field: keyof DateRange, value: string) => setWeeks((current) => current.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
  const problem = validateWeeks(type, month, weeks) || (existingMonths.has(month) ? `${monthLabel(month)} already exists.` : "");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      const [year, m] = month.split("-").map(Number);
      await rebasingApi("/periods", {
        method: "POST",
        body: {
          year,
          month: m,
          periodType: type,
          ...(periodNumber.trim() ? { periodNumber: Number(periodNumber) } : {}),
          weeks: weeks.map((w, i) => ({ ...(type === "NORMAL" ? { weekNo: i + 1 } : {}), startDate: w.startDate, endDate: w.endDate })),
        },
      });
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The month could not be created.");
      setBusy(false);
    }
  };

  return (
    <form method="post" onSubmit={submit} className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
      <div className="border-b border-prism-border/60 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Backfill or special month</p>
        <h3 className="mt-1 text-lg font-black text-prism-text">{month ? monthLabel(month) : "Choose a month"}</h3>
        <p className="mt-0.5 text-xs text-prism-muted">For the regular cycle, use &quot;Create {monthLabel(month)}&quot; at the top instead.</p>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-bold text-prism-muted">Observation month</span>
            <input type="month" value={month} required onChange={(e) => { setMonth(e.target.value); if (e.target.value) refill(type, e.target.value); }} className="mt-1.5 w-full rounded-xl border border-prism-border px-3 py-2.5 text-sm font-bold text-prism-text focus:border-prism-purple focus:outline-none focus:ring-2 focus:ring-prism-purple/20" />
          </label>
          <div>
            <span className="text-[11px] font-bold text-prism-muted">Type</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-prism-bg p-1">
              {(["BACKFILL", "NORMAL"] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setType(t); refill(t, month); }} className={clsx("rounded-lg px-3 py-2 text-xs font-bold transition", type === t ? "bg-white text-prism-text shadow-sm" : "text-prism-muted hover:text-prism-text")}>
                  {t === "NORMAL" ? "Current · 3 weeks" : "Backfill · catch-up"}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold text-prism-muted">Period number (optional)</span>
            <input type="number" min={1} value={periodNumber} onChange={(e) => setPeriodNumber(e.target.value)} placeholder="e.g. 1" className="mt-1.5 w-full rounded-xl border border-prism-border px-3 py-2.5 text-sm text-prism-text focus:border-prism-purple focus:outline-none focus:ring-2 focus:ring-prism-purple/20" />
          </label>
        </div>
        <div className={clsx("grid gap-3", weeks.length > 1 ? "md:grid-cols-3" : "md:max-w-md")}>
          {weeks.map((w, i) => (
            <div key={i} className="rounded-2xl border border-prism-border/70 p-4">
              <p className="text-sm font-black text-prism-text">{type === "NORMAL" ? `Week ${i + 1}` : "Catch-up window"}</p>
              <div className="mt-3 space-y-2">
                <DateField label="Starts" value={w.startDate} onChange={(v) => setWeek(i, "startDate", v)} />
                <DateField label="Ends" value={w.endDate} onChange={(v) => setWeek(i, "endDate", v)} />
              </div>
            </div>
          ))}
        </div>
        {(problem || error) && <p role="alert" className="text-xs font-semibold text-red-700">{error || problem}</p>}
      </div>
      <div className="flex flex-col gap-2 border-t border-prism-border/60 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Button variant="ghost" onClick={() => refill(type, month)}>Suggest dates</Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!!problem} busy={busy}>Create month</Button>
        </div>
      </div>
    </form>
  );
}

function MarketPlans({ period }: { period: Period }) {
  const plans = useRebasingQuery<{ plans: MarketPlan[] }>(`/periods/${period.period_id}/market-plans`);
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = plans.data?.plans || [];
    return term ? all.filter((p) => `${p.market_name} ${p.region_name} ${p.district_name} ${p.market_code ?? ""}`.toLowerCase().includes(term)) : all;
  }, [plans.data, search]);
  const backfill = period.period_type === "BACKFILL";
  return (
    <div className="overflow-hidden rounded-2xl border border-prism-border/70">
      <div className="flex flex-col gap-2 border-b border-prism-border/60 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-prism-text">{plans.loading ? "Loading market targets…" : `${number.format(rows.length)} markets · frozen when the month opened`}</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search market, district or region" className="rounded-xl border border-prism-border bg-white px-3 py-2 text-xs sm:w-64" />
      </div>
      {plans.error && <p className="p-3 text-xs text-red-700">{plans.error}</p>}
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-[0.12em] text-prism-muted shadow-[0_1px_0_#E5E7EB]">
            <tr>
              <th className="px-4 py-2.5">Market</th>
              <th className="px-4 py-2.5 text-right">Outlets</th>
              {!backfill && <><th className="px-4 py-2.5 text-right">Week 1</th><th className="px-4 py-2.5 text-right">Week 2</th><th className="px-4 py-2.5 text-right">Week 3</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((p) => (
              <tr key={p.plan_id} className="border-t border-prism-border/50">
                <td className="px-4 py-2.5"><p className="font-bold text-prism-text">{p.market_name}</p><p className="text-[10px] text-prism-muted">{p.district_name} · {p.region_name}</p></td>
                <td className="px-4 py-2.5 text-right font-black text-prism-text">{number.format(p.total_outlets)}</td>
                {!backfill && <><td className="px-4 py-2.5 text-right">{p.week1_target ?? "—"}</td><td className="px-4 py-2.5 text-right">{p.week2_target ?? "—"}</td><td className="px-4 py-2.5 text-right">{p.week3_target ?? "—"}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 300 && <p className="p-3 text-center text-[11px] text-prism-muted">Showing 300 of {number.format(rows.length)} - search to narrow down.</p>}
      </div>
    </div>
  );
}
